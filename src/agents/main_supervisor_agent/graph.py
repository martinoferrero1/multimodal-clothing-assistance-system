import json

from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
from shared.base_state import BaseStateKeys
from utils.models import get_llm_model
from utils.error_handling import safe_node
from utils.prompts import build_prompt
from langchain_core.messages import AIMessage, SystemMessage
from .state import FlowSnapshotKeys, SupervisorState, SupervisorStateKeys
from tools.supervisor_tools import supervisor_tools, RESULT_CONTENT_KEY, RESULT_FINISHED_KEY, RESULT_TOOL_KEY

class SupervisorGraph(BaseGraph):

    def __init__(self):
        self._tool_node = ToolNode(supervisor_tools)

    @safe_node("decide_expert")
    def _decide_expert_node(self, state: SupervisorState):
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/supervisor/system_prompt.txt",
            examples_prompt_path="src/prompts/supervisor/examples_system_prompt.txt",
            include_examples=state[BaseStateKeys.SETTINGS].INCLUDE_PROMPT_EXAMPLES
        )
        supervisor_llm = (
            get_llm_model(state[BaseStateKeys.SETTINGS], is_supervisor=True)
            .bind_tools(supervisor_tools)
        )
        messages = [SystemMessage(content=sys_prompt)] + state[BaseStateKeys.MESSAGES]
        response = supervisor_llm.invoke(messages) # ya es un AI Message

        return {BaseStateKeys.MESSAGES: [response],
                SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False}
    
    @safe_node("process_tool_result")
    def _process_tool_result_node(self, state: SupervisorState):
        last_message = state[BaseStateKeys.MESSAGES][-1]
        tool_result = json.loads(last_message.content)
        content = tool_result.get(RESULT_CONTENT_KEY)
        finished = tool_result.get(RESULT_FINISHED_KEY)
        stack = state[SupervisorStateKeys.FLOW_STACK]

        if finished:
            if stack:
                stack.pop()
                if stack:
                    msg = AIMessage(
                        content="Your previous request finished. Which task would you like to continue?"
                    )
                    return {
                        BaseStateKeys.MESSAGES: [msg],
                        SupervisorStateKeys.AWAITING_NEW_INTENT_CONFIRMATION: True,
                        SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False
                    }

            return {BaseStateKeys.FINISHED: True,
                    SupervisorStateKeys.AWAITING_NEW_INTENT_CONFIRMATION: False,
                    SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False
                    }

        if content:
            msg = AIMessage(content=content)
            return {BaseStateKeys.MESSAGES: [msg],
                    SupervisorStateKeys.AWAITING_NEW_INTENT_CONFIRMATION: False,
                    SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False}

        return {SupervisorStateKeys.AWAITING_NEW_INTENT_CONFIRMATION: False,
                SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: True}
    
    def _route_from_start(self, state: SupervisorState): # esta función de ruteo en realidad no hace referencia a una arquitectura router (ya que es supervisor), sino que se refiere a decidir si se reanuda un experto o si se decide a cual experto llamar en base a los mensajes
        stack = state[SupervisorStateKeys.FLOW_STACK]
        if stack:
            last_snapshot = stack[-1]
            if last_snapshot.get(FlowSnapshotKeys.AWAITING_USER_ANSWER, False) or state.get(SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG, False):
                return "resume_expert"
            #if state[SupervisorStateKeys.AWAITING_NEW_INTENT_CONFIRMATION]: # aca podria directamente no hacer este if pero quizas en caso de que se este esperando una confirmacion de cambio de intent se puede hacer algo especifico
                #return "call_expert_decision"

        return "call_expert_decision"

    def _should_continue(self, state: SupervisorState):
        last_message = state[BaseStateKeys.MESSAGES][-1]
        if getattr(last_message, "tool_calls", None):
            print("Estado del supervisor en el should continue:", state)
            return "continue_to_experts"

        return "end_turn"

    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(SupervisorState)
        workflow.add_node("decide_expert", self._decide_expert_node)
        workflow.add_node("expert_tools", self._tool_node)
        workflow.add_node("process_tool_result", self._process_tool_result_node)
        workflow.add_conditional_edges(
            START,
            self._route_from_start,
            {
                "call_expert_decision": "decide_expert",
                "resume_expert": "expert_tools"
            }
        )
        workflow.add_conditional_edges(
            "decide_expert",
            self._should_continue,
            {
                "continue_to_experts": "expert_tools",
                "end_turn": END
            }
        )
        workflow.add_edge("expert_tools", "process_tool_result")
        workflow.add_conditional_edges(
            "process_tool_result",
            lambda state: "end_turn" if not state.get(SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG, False) else "call_expert_decision",
            {
                "call_expert_decision": "decide_expert",
                "end_turn": END
            }
        )
        checkpointer = MemorySaver()

        return workflow.compile(checkpointer=checkpointer)

    def _get_graph_key(self) -> str:
        return "supervisor"