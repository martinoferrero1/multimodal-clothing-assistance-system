from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from schemas.outfit_maker.product_solicitation import ItemSpecList
from schemas.outfit_maker.orchestation_answer import OrchestationAnswer
from state import State, StateKeys, SumaryKeys
from utils.product_solicitations import format_solicitation
from utils.prompts import build_prompt
from utils.error_handling import safe_node
from utils.models import get_llm_model
from langchain_core.messages import AIMessage, SystemMessage
from core.settings import settings
import json

class OutfitMakerGraph(BaseGraph):

    @safe_node("orchestator_node")
    def _orchestator_node(self, state: State) -> Command:
        print("llega al orquestador")
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/outfit_maker/orchestation/system_prompt.txt",
            examples_prompt_path="src/prompts/outfit_maker/orchestation/examples_system_prompt.txt",
            include_examples=settings.INCLUDE_PROMPT_EXAMPLES
        )
        llm = get_llm_model(is_supervisor=False).with_structured_output(OrchestationAnswer)
        context = {
            "current_solicitation": format_solicitation(state[StateKeys.CLOTH_SOLICITATIONS]) if state[StateKeys.CLOTH_SOLICITATIONS] else None,
            "summary": state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT]
        }
        recent_messages = state[StateKeys.MESSAGES][-5:] if len(state[StateKeys.MESSAGES]) >= 5 else state[StateKeys.MESSAGES]
        messages = [
            SystemMessage(content=sys_prompt),
            SystemMessage(content=f"Context for extraction: {json.dumps(context, indent=2)}"),
            *recent_messages
        ]
        response: OrchestationAnswer = llm.invoke(messages)
        if response.next_node is not None:
            return Command(goto=response.next_node)
        if response.custom_answer is not None:
            return Command(goto=END,
                           update={StateKeys.MESSAGES: [AIMessage(content=response.custom_answer)],
                                   StateKeys.PREVIOUS_SUMMARY: {
                                       SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                                       SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1
                                   }})
        if response.unclear_msg:
            return Command(goto=END, update={StateKeys.UNCLEAR_MSG: True})
        
        print("Error en la respuesta del agente, no se indicó ni next_node ni custom_answer, ni se indicó que el mensaje es poco claro. Respuesta completa: ", response)
        raise ValueError("Invalid response from orchestator_node, no next_node, custom_answer or unclear_msg indicated.")

    @safe_node("extract_cloth_solicitations")
    def _extract_cloth_solicitations_node(self, state: State) -> dict[StateKeys, any]:
        base_prompt_path = "src/prompts/outfit_maker/cloth_solicitations/system_prompt.txt"
        examples_prompt_path = "src/prompts/outfit_maker/cloth_solicitations/examples_system_prompt.txt"
        sys_prompt = build_prompt(
            base_prompt_path=base_prompt_path,
            examples_prompt_path=examples_prompt_path,
            include_examples=settings.INCLUDE_PROMPT_EXAMPLES
        )
        llm = get_llm_model(is_supervisor=False).with_structured_output(ItemSpecList)
        context = {
            "current_solicitation": state[StateKeys.CLOTH_SOLICITATIONS],
            "summary": state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT]
        }
        recent_messages = state[StateKeys.MESSAGES][-5:] if len(state[StateKeys.MESSAGES]) >= 5 else state[StateKeys.MESSAGES]
        messages = [
            SystemMessage(content=sys_prompt),
            SystemMessage(content=f"Context for extraction: {json.dumps(context, indent=2)}"),
            *recent_messages
        ]
        solicitations: ItemSpecList = llm.invoke(messages)
        #print("Solicitudes extraídas: ", solicitations)
        formatted_answer = "Ok! Here's a summary of your request, please confirm if it's what you are looking for:\n" + format_solicitation(solicitations)
        
        return Command(goto=END, update={
                StateKeys.CLOTH_SOLICITATIONS: solicitations,
                StateKeys.MESSAGES: [AIMessage(content=formatted_answer)],
                StateKeys.PREVIOUS_SUMMARY: {
                SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1
            }
            })
        
    @safe_node("search_clothes_in_db")
    def _search_clothes_in_db(self, state: State) -> dict[StateKeys, any]:
        return {StateKeys.MESSAGES: [AIMessage(content="Ok, I'm searching for the best options according to your request, please wait a moment...")]}

    # aca el state es el mismo ya que necesita los mismos datos el subgrafo, como lo trato como subgraph as a node, seria mas rebuscado para persistir los datos si tuviera uno especifico del subgraph
    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(State)
        workflow.add_node(
            "orchestator_node",
            self._orchestator_node
        )
        workflow.add_node(
            "extract_cloth_solicitations",
            self._extract_cloth_solicitations_node
        )
        workflow.add_node(
            "search_clothes_in_db",
            self._search_clothes_in_db
        )
        workflow.add_edge(START, "orchestator_node")

        return workflow.compile() # para este subgrafo no uso checkpointer ya que como lo modele con un estado totalmente compartido basta con el checkpointer del grafo padre

    def _get_graph_key(self) -> str:
        return "outfit_maker"