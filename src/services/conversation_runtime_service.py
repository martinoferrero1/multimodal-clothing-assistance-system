from __future__ import annotations

import asyncio
from dataclasses import dataclass
from threading import Lock
from typing import Any, Iterable

from agents.main_supervisor_agent.graph import SupervisorGraph
from core.metaclasses.singleton_meta import SingletonMeta
from infra.db.chat_models import ChatMessage, Conversation, MessageRole
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langgraph.types import Command
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from state import StateKeys, SumaryKeys
from utils.models import get_llm_model


SUMMARY_PROMPT = """
You are a summarization agent.

Your task is to generate a concise summary of a conversation.

# INPUT CONTEXT

You receive:

- previous_summary: A summary of the conversation so far (may be empty or null).
- recent_messages: The last 6 messages of the conversation, alternating between Human and AI.

# OBJECTIVE

Create a short summary that captures:

- What the user asked or requested
- What the assistant responded
- The overall progression of the conversation

# IMPORTANT GUIDELINES

- Keep the summary under 400 characters
- Be concise but informative
- Do NOT include unnecessary details
- Do NOT repeat messages verbatim
- Use natural language

# CONTEXT HANDLING

- If previous_summary exists:
  - Use it to maintain continuity
  - Merge it with the new information naturally

- If there is no clear connection between previous_summary and recent_messages:
  - Focus primarily on recent_messages

# OUTPUT

Return only the summary as plain text.
""".strip()


@dataclass
class ChatTurnResult:
    conversation: Conversation
    user_message: ChatMessage
    assistant_message: ChatMessage


class ConversationRuntimeService(metaclass=SingletonMeta):
    def __init__(self, checkpointer) -> None:
        self._graph = SupervisorGraph(checkpointer=checkpointer).get_graph()
        self._graph_lock = Lock()

    async def process_user_message(
        self,
        session: AsyncSession,
        conversation: Conversation,
        content: str,
    ) -> ChatTurnResult:
        clean_content = content.strip()
        if not clean_content:
            raise ValueError("Message content cannot be empty.")

        user_message = ChatMessage(
            conversation_id=conversation.id,
            role=MessageRole.USER.value,
            content=clean_content,
        )
        session.add(user_message)
        await session.flush()

        if not conversation.title or conversation.title == "New conversation":
            conversation.title = self._conversation_title_from_message(clean_content)

        config = {"configurable": {"thread_id": conversation.id}}
        if await self._has_prior_checkpointed_turn(session, conversation.id):
            workflow_input = await asyncio.to_thread(self._build_resume_command, config, clean_content)
        else:
            workflow_input = self._build_initial_state(clean_content)

        result = await asyncio.to_thread(self._invoke_graph, workflow_input, config)

        assistant_reply = self._extract_assistant_reply(result)
        response_payload = assistant_reply.additional_kwargs.get("final_response_payload")
        workflow_errors = result.get(StateKeys.ERRORS, [])

        assistant_message = ChatMessage(
            conversation_id=conversation.id,
            role=MessageRole.ASSISTANT.value,
            content=assistant_reply.content,
            final_response_payload=response_payload,
            workflow_errors=workflow_errors or None,
        )
        session.add(assistant_message)
        await session.flush()

        summary, summary_message_count = await asyncio.to_thread(
            self._load_conversation_state_from_checkpoint,
            config,
        )
        conversation.summary = summary
        conversation.summary_message_count = summary_message_count
        await session.commit()
        await session.refresh(conversation)
        await session.refresh(user_message)
        await session.refresh(assistant_message)

        return ChatTurnResult(
            conversation=conversation,
            user_message=user_message,
            assistant_message=assistant_message,
        )

    def _build_initial_state(self, content: str) -> dict:
        return {
            StateKeys.MESSAGES: [HumanMessage(content=content)],
            StateKeys.ERRORS: [],
            StateKeys.PREVIOUS_SUMMARY: {
                SumaryKeys.CONTENT: None,
                SumaryKeys.POS_MSGS_COUNT: 1,
            },
            StateKeys.UNCLEAR_MSG: False,
            StateKeys.PLAN: [],
            StateKeys.CURRENT_STEP_INDEX: None,
            StateKeys.BUSINESS_QA_QUERIES: None,
            StateKeys.OUTFIT_SEARCH_INTENTS: None,
            StateKeys.BUSINESS_ANSWERS: None,
            StateKeys.CURRENT_OUTFIT_REQUEST: None,
            StateKeys.PRODUCT_CANDIDATES: None,
            StateKeys.CURRENT_OUTFIT: None,
            StateKeys.FINAL_ANSWER: None,
            StateKeys.FINAL_RESPONSE_PAYLOAD: None,
        }

    def _build_resume_command(self, config: dict[str, Any], content: str) -> Command:
        with self._graph_lock:
            snapshot = self._graph.get_state(config)
        state_values = getattr(snapshot, "values", {}) or {}
        previous_summary = state_values.get(StateKeys.PREVIOUS_SUMMARY, {}) or {}
        pos_msgs_count = previous_summary.get(SumaryKeys.POS_MSGS_COUNT, 0)

        update = {
            StateKeys.MESSAGES: [HumanMessage(content=content)],
            StateKeys.PREVIOUS_SUMMARY: {
                SumaryKeys.CONTENT: previous_summary.get(SumaryKeys.CONTENT),
                SumaryKeys.POS_MSGS_COUNT: pos_msgs_count + 1,
            },
        }
        if pos_msgs_count == 6:
            summary = self._summarize_state_messages(
                previous_summary=previous_summary.get(SumaryKeys.CONTENT),
                messages=state_values.get(StateKeys.MESSAGES, []) or [],
            )
            update[StateKeys.PREVIOUS_SUMMARY] = {
                SumaryKeys.CONTENT: summary,
                SumaryKeys.POS_MSGS_COUNT: 1,
            }

        return Command(update=update)

    def _extract_assistant_reply(self, result: dict) -> AIMessage:
        messages = result.get(StateKeys.MESSAGES, [])
        if not messages:
            raise RuntimeError("The workflow completed without an assistant response.")

        assistant_reply = messages[-1]
        if not isinstance(assistant_reply, AIMessage):
            assistant_reply = AIMessage(
                content=getattr(assistant_reply, "content", str(assistant_reply)),
                additional_kwargs=getattr(assistant_reply, "additional_kwargs", {}),
            )
        return assistant_reply

    def _summarize_state_messages(
        self,
        previous_summary: str | None,
        messages: Iterable[BaseMessage],
    ) -> str | None:
        llm = get_llm_model(is_supervisor=False)
        response = llm.invoke(
            [
                SystemMessage(content=SUMMARY_PROMPT),
                SystemMessage(content=f"previous_summary: {previous_summary or 'None'}"),
                *list(messages)[-6:],
            ]
        )
        content = getattr(response, "content", None)
        if content is None:
            return None
        return str(content).strip()[:400] or None

    async def _has_prior_checkpointed_turn(self, session: AsyncSession, conversation_id: str) -> bool:
        assistant_count = await session.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.conversation_id == conversation_id,
                ChatMessage.role == MessageRole.ASSISTANT.value,
            )
        )
        return bool(assistant_count)

    def _invoke_graph(self, workflow_input: dict | Command, config: dict[str, Any]) -> dict:
        with self._graph_lock:
            return self._graph.invoke(workflow_input, config=config)

    def _load_conversation_state_from_checkpoint(
        self,
        config: dict[str, Any],
    ) -> tuple[str | None, int]:
        with self._graph_lock:
            snapshot = self._graph.get_state(config)
        state_values = getattr(snapshot, "values", {}) or {}
        previous_summary = state_values.get(StateKeys.PREVIOUS_SUMMARY, {}) or {}
        return (
            previous_summary.get(SumaryKeys.CONTENT),
            previous_summary.get(SumaryKeys.POS_MSGS_COUNT, 0),
        )

    def _conversation_title_from_message(self, content: str) -> str:
        compact = " ".join(content.split())
        if len(compact) <= 60:
            return compact
        return f"{compact[:57].rstrip()}..."
