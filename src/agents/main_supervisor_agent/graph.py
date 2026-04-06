from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command
from agents.outfit_maker_agent.graph import OutfitMakerGraph
from core.settings import settings
from schemas.supervisor_decision import SupervisorDecision
from state import State, StateKeys, SumaryKeys
from utils.models import get_llm_model
from utils.error_handling import safe_node
from utils.prompts import build_prompt
from langchain_core.messages import SystemMessage
from langchain_core.messages import AIMessage

class SupervisorGraph(BaseGraph):

    def __init__(self):
        self._outfit_maker_graph = OutfitMakerGraph().get_graph()
        #self._consultant_graph = None # TODO: implementar otros expertos y agregar sus grafos acá

    @safe_node("route_from_start")
    def _route_from_start_node(self, state: State) -> Command:
        print("\nRouting from start node ---")
        specialist = state.get(StateKeys.CURRENT_SPECIALIST)
        if not specialist:
            return Command(goto="decide_specialist")
        print(f"Routing to current specialist: {specialist}")
        return Command(goto=specialist)

    @safe_node("ask_for_feedback")
    def _ask_for_feedback_node(self, state: State):
        print("\nAsking for user feedback on the system response ---")

        return Command(goto="route_from_start")

    @safe_node("decide_specialist")
    def _decide_specialist_node(self, state: State) -> Command:
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/supervisor/system_prompt.txt",
            examples_prompt_path="src/prompts/supervisor/examples_system_prompt.txt",
            include_examples=settings.INCLUDE_PROMPT_EXAMPLES
        )
        supervisor_llm = get_llm_model(is_supervisor=True).with_structured_output(SupervisorDecision)
        messages = [SystemMessage(content=sys_prompt)] + state[StateKeys.MESSAGES]
        response: SupervisorDecision = supervisor_llm.invoke(messages) # ya es un AI Message
        #print("Supervisor decision: ", response)
        response = None
        if response.specialist is not None:
            return Command(goto=response.specialist,
                           update={StateKeys.UNCLEAR_MSG: False,
                                   StateKeys.CURRENT_SPECIALIST: response.specialist
                            })
        if response.custom_answer is not None:
            return Command(goto="ask_for_feedback",
                            update={StateKeys.UNCLEAR_MSG: False,
                                    StateKeys.MESSAGES: [AIMessage(content=response.custom_answer)],
                                    StateKeys.CURRENT_SPECIALIST: None,
                                    StateKeys.PREVIOUS_SUMMARY: {
                                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1
                            }})
        if response.use_default_clarification:
            return Command(goto="ask_for_feedback",
                           update={StateKeys.UNCLEAR_MSG: True,
                                   StateKeys.MESSAGES: [AIMessage(content="Sorry, but I didn't understand your last message. Could you clarify your answer a little?")],
                                   StateKeys.CURRENT_SPECIALIST: None,
                                   StateKeys.PREVIOUS_SUMMARY: {
                                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1
                            }})
        
        print("Error en la respuesta del agente, no se indicó ni specialist ni custom_answer ni use_default_clarification. Respuesta completa: ", response)
        raise ValueError("Invalid response from supervisor agent, no specialist, custom_answer or use_default_clarification indicated.")
    
    @safe_node("_consultant_graph")
    def _consultant_graph_node(self, state: State): # temporal!
        print("\nCalling consultant graph ---")

        return {StateKeys.UNCLEAR_MSG: True}


    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(State)
        workflow.add_node("route_from_start", self._route_from_start_node)
        workflow.add_node("ask_for_feedback", self._ask_for_feedback_node)
        workflow.add_node("decide_specialist", self._decide_specialist_node)
        workflow.add_node("outfit_expert", self._outfit_maker_graph)
        workflow.add_node("consultant_expert", self._consultant_graph_node)

        workflow.add_edge(START, "route_from_start")
        workflow.add_conditional_edges(
            "outfit_expert",
            lambda state: state.get(StateKeys.UNCLEAR_MSG, False),
            {
                True: "decide_specialist",
                False: "ask_for_feedback"
            }
        )
        workflow.add_conditional_edges(
            "consultant_expert",
            lambda state: state.get(StateKeys.UNCLEAR_MSG, False),
            {
                True: "decide_specialist",
                False: "ask_for_feedback"
            }
        )

        checkpointer = MemorySaver()

        return workflow.compile(
            checkpointer=checkpointer,
            interrupt_after=["ask_for_feedback"]
        )

    def _get_graph_key(self) -> str:
        return "supervisor"