from agents.base_graph import BaseGraph
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command
from schemas.outfit_maker.products_solicitation import ItemSpecList
from schemas.outfit_maker.routing_intent import RoutingIntent, PROVIDE_SPECIFICATIONS_INTENT, REQUEST_MODIFICATION_INTENT, CONFIRM_INTENT, REJECT_INTENT, CANCEL_INTENT, UNCLEAR_INTENT
from shared.base_state import BaseStateKeys
from utils.product_solicitations import format_solicitation, build_modifications_extraction_input
from utils.prompts import build_prompt
from utils.error_handling import safe_node
from utils.models import get_llm_model
from .state import OutfitMakerState, OutfitMakerStateKeys
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import AIMessage, SystemMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

class OutfitMakerGraph(BaseGraph):

    @safe_node("route_flow")
    def _route_flow_node(self, state: OutfitMakerState):
        sys_prompt = build_prompt(
            base_prompt_path="src/prompts/outfit_maker/flow_routing_intent/system_prompt.txt",
            examples_prompt_path="src/prompts/outfit_maker/flow_routing_intent/examples_system_prompt.txt",
            include_examples=state[BaseStateKeys.SETTINGS].INCLUDE_PROMPT_EXAMPLES
        )
        llm = get_llm_model(
            state[BaseStateKeys.SETTINGS],
            is_supervisor=False
        ).with_structured_output(RoutingIntent)
        messages = [
            SystemMessage(content=sys_prompt),
            SystemMessage(content=f"Summary of previous conversation:\n{state[BaseStateKeys.PREVIOUS_SUMMARY]}"),
            SystemMessage(content=f"Has existing specs: {state[OutfitMakerStateKeys.CLOTH_SOLICITATIONS] is not None}"),
            *state[BaseStateKeys.LAST_MESSAGES_CONTEXT],  # ya son HumanMessage / AIMessage
            HumanMessage(content=state[BaseStateKeys.MESSAGES][-1]),
        ]

        routing_intent: RoutingIntent = llm.invoke(messages)
        new_state = {}
        if routing_intent.intent in {CONFIRM_INTENT, UNCLEAR_INTENT}: #modificar aca luego para continuar tras la confirmacion positiva
            next_node = END
        elif routing_intent.intent == PROVIDE_SPECIFICATIONS_INTENT:
            if routing_intent.has_enough_information:
                next_node = "extract_cloth_solicitations"
            else:
                msg = AIMessage(content="I understand you want to provide specifications, but I couldn't find enough information in your message to proceed. Could you please provide more details about the outfits you're looking for?")
                new_state = {BaseStateKeys.MESSAGES: [msg], BaseStateKeys.CURRENT_RESPONSE_MSG: msg}
                next_node = END
        elif routing_intent.intent == REQUEST_MODIFICATION_INTENT:
            if routing_intent.has_enough_information:
                next_node = "extract_cloth_solicitations"
            else:
                msg = AIMessage(content="I understand you want to modify the specifications, but I couldn't identify the changes you'd like to make. Could you please specify what modifications you'd like for the outfit suggestions?")
                new_state = {BaseStateKeys.MESSAGES: [msg], BaseStateKeys.CURRENT_RESPONSE_MSG: msg}
                next_node = END
        elif routing_intent.intent == CANCEL_INTENT:
            msg = AIMessage(content="Understood. If you want to start over or need assistance with something else, just let me know!")
            new_state = {BaseStateKeys.MESSAGES: [msg], BaseStateKeys.CURRENT_RESPONSE_MSG: msg}
            next_node = END
        else:
            msg = AIMessage(content="I'm sorry to hear that the suggestions didn't meet your expectations. If you could provide more details about what you're looking for or what aspects you didn't like, I'd be happy to try again and offer better recommendations.")
            new_state = {BaseStateKeys.MESSAGES: [msg], BaseStateKeys.CURRENT_RESPONSE_MSG: msg}
            next_node = END
        
        return Command(goto=next_node, update=new_state)

    @safe_node("extract_cloth_solicitations")
    def _extract_cloth_solicitations_node(self, state: OutfitMakerState):
        user_last_confirmation = state[OutfitMakerStateKeys.USER_CONFIRMATION]
        if user_last_confirmation and user_last_confirmation.intent == MODIFY:
            if user_last_confirmation.has_explicit_changes:
                base_prompt_path = "src/prompts/outfit_maker/modification_cloth_solicitations/system_prompt.txt"
                examples_prompt_path = "src/prompts/outfit_maker/modification_cloth_solicitations/examples_system_prompt.txt"
                print("Construyo el mensaje aca")
                content_msg = build_modifications_extraction_input(
                    solicitations_history=state[OutfitMakerStateKeys.OUTFIT_PREFERENCES],
                    current_extraction=state[OutfitMakerStateKeys.CLOTH_SOLICITATIONS],
                    current_msg=state[BaseStateKeys.MESSAGES][-1].content.strip()
                )
            else:
                modifications_not_specified_msg = AIMessage(content="Sorry, I couldn't identify the modifications you want to make. Could you please specify what changes you'd like to see in the outfit suggestions?")
                return {
                    BaseStateKeys.MESSAGES: [modifications_not_specified_msg],
                    BaseStateKeys.CURRENT_RESPONSE_MSG: modifications_not_specified_msg}
        else:
            base_prompt_path = "src/prompts/outfit_maker/cloth_solicitations/system_prompt.txt"
            examples_prompt_path = "src/prompts/outfit_maker/cloth_solicitations/examples_system_prompt.txt"
            content_msg = state[BaseStateKeys.MESSAGES][-1].content.strip()
        
        print("El content_msg para extracción de solicitudes es: ", content_msg)
        sys_prompt = build_prompt(
            base_prompt_path=base_prompt_path,
            examples_prompt_path=examples_prompt_path,
            include_examples=state[BaseStateKeys.SETTINGS].INCLUDE_PROMPT_EXAMPLES
        )
        llm = get_llm_model(
            state[BaseStateKeys.SETTINGS],
            is_supervisor=False
        ).with_structured_output(ItemSpecList)
        messages = [
            SystemMessage(content=sys_prompt),
            HumanMessage(content=content_msg)
        ]
        
        solicitations: ItemSpecList = llm.invoke(messages)
        #print("Solicitudes extraídas: ", solicitations)
        identified_solicitations_msg = AIMessage(content=format_solicitation(solicitations))

        return {
            OutfitMakerStateKeys.OUTFIT_PREFERENCES: [content_msg],
            OutfitMakerStateKeys.CLOTH_SOLICITATIONS: solicitations,
            BaseStateKeys.MESSAGES: [identified_solicitations_msg],
            BaseStateKeys.CURRENT_RESPONSE_MSG: identified_solicitations_msg
        }

    def _build_graph(self) -> CompiledStateGraph:
        workflow = StateGraph(OutfitMakerState)
        workflow.add_node(
            "extract_cloth_solicitations",
            self._extract_cloth_solicitations_node
        )
        workflow.add_node(
            "process_user_confirmation",
            self._process_user_confirmation_node
        )
        workflow.add_edge(START, "extract_cloth_solicitations")
        workflow.add_edge("extract_cloth_solicitations", "process_user_confirmation")
        workflow.add_conditional_edges(
            "process_user_confirmation",
            lambda state: "end_turn" if state[OutfitMakerStateKeys.USER_CONFIRMATION].intent in (CONFIRM, UNCLEAR) else "modify_preferences",
            {
                "end_turn": END,
                "modify_preferences": "extract_cloth_solicitations"
            }
        )
        checkpointer = MemorySaver()

        return workflow.compile(
            checkpointer=checkpointer,
            interrupt_before=["process_user_confirmation"]
        )

    def _get_graph_key(self) -> str:
        return "outfit_maker"