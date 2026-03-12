from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from schemas.products_solicitation import ItemSpecList
from shared.base_state import BaseStateKeys
from utils.prompts import build_prompt
from utils.error_handling import safe_node
from utils.models import get_llm_model
from .state import OutfitMakerState, OutfitMakerStateKeys
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import SystemMessage, HumanMessage

class OutfitMakerGraph(BaseGraph):

    @safe_node("extract_clothes_solicitations")
    def _extract_clothes_solicitations_node(self, state: OutfitMakerState):
        sys_prompt = build_prompt(
            base_prompt_path="../prompts/outfit_maker/system_prompt.txt",
            examples_prompt_path="../prompts/outfit_maker/examples_system_prompt.txt",
            include_examples=state[BaseStateKeys.SETTINGS].INCLUDE_PROMPT_EXAMPLES
        )
        llm = get_llm_model(
            state[BaseStateKeys.SETTINGS],
            is_supervisor=False
        ).with_structured_output(ItemSpecList)
        messages = [
            SystemMessage(content=sys_prompt),
            HumanMessage(content=state[OutfitMakerStateKeys.OUTFIT_PREFERENCES])
        ]
        solicitations: ItemSpecList = llm.invoke(messages)
        return {
            OutfitMakerStateKeys.CLOTHES_SOLICITATIONS: solicitations,
            BaseStateKeys.FINISHED: True
        }

    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(OutfitMakerState)
        workflow.add_node(
            func=self._extract_clothes_solicitations_node,
            name="extract_clothes_solicitations",
        )
        workflow.add_edge(START, "extract_clothes_solicitations")
        workflow.add_edge("extract_clothes_solicitations", END)
        checkpointer = MemorySaver()

        return workflow.compile(checkpointer=checkpointer)

    def _get_graph_key(self) -> str:
        return "outfit_maker"