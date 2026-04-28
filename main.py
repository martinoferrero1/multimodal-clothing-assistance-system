import uuid
from langgraph.types import Command
from langchain_core.messages import HumanMessage, SystemMessage
from agents.main_supervisor_agent.graph import SupervisorGraph
from state import StateKeys, SumaryKeys
from dotenv import load_dotenv
from utils.models import get_llm_model
from scripts.seed_db import seed_catalog


def main():
    load_dotenv()
    graph = SupervisorGraph().get_graph()
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    print("Assistant ready. Type 'exit' to quit.\n")

    #user_input = input("User: ")
    #user_input = "I want two special outfits. One of them is for my wedding, I need a blue dress from the last year. But also I want an outfit for playing tennis. It needs to have a pair of sneakers with red as main color but also blue in a secondary grade. And also it needs a t-shirt, but not much expensive, I can pay a maximum of 25 USD for that"
    #user_input = "I want men shoes, with grey as main color, and if possible, from FILA" # construir descripcion simil a Men,Footwear,Shoes,Sports Shoes,Grey,Fall,2011,Sports,Fila Men Destiny Grey Sports Shoes,FILA
    #user_input = "I want the men destiny pair of shoes, do you have it?"
    user_input = "I want two special outfits. One of them is for my wedding, where I need a dress, I prefered it to be red, and also a formal necklace. But also I want an outfit for playing tennis. It needs to have a pair of sneakers, a t-shirt from Nike or Puma, and a pair of shorts"
    if user_input.lower() not in {"exit", "quit"}:
        result = graph.invoke(
                {
                    StateKeys.MESSAGES: [HumanMessage(content=user_input)],
                    StateKeys.ERRORS: [],
                    StateKeys.PREVIOUS_SUMMARY: {SumaryKeys.CONTENT: None, SumaryKeys.POS_MSGS_COUNT: 1},
                    StateKeys.UNCLEAR_MSG: False,
                    StateKeys.PLAN: [],
                    StateKeys.CURRENT_STEP_INDEX: None,
                    StateKeys.BUSINESS_QA_QUERIES: None,
                    StateKeys.OUTFIT_SEARCH_INTENTS: None,
                    StateKeys.BUSINESS_ANSWERS: None,
                    StateKeys.CURRENT_OUTFIT_REQUEST: None,
                    StateKeys.PRODUCT_CANDIDATES: None,
                    StateKeys.CURRENT_OUTFIT: None,
                    StateKeys.FINAL_ANSWER: None
                },
                config=config
            )
        while True:
            print("Workflow errors: ", result.get(StateKeys.ERRORS, []))
            response = result.get(StateKeys.MESSAGES, [])[-1] if result.get(StateKeys.MESSAGES, []) else None
            print(response.content if response else "No response from the agent.")
            user_input = input("User: ")
            if user_input.lower() in {"exit", "quit"}:
                break
            pos_msgs = result[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT]
            if pos_msgs == 6:
                summarizer_sys_prompt = """
You are a summarization agent.

Your task is to generate a concise summary of a conversation.

# INPUT CONTEXT

You receive:

- previous_summary: A summary of the conversation so far (may be empty or null).
- recent_messages: The last 6 messages of the conversation, alternating between Human and AI (Human, AI, Human, AI, Human, AI).

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
  - You may briefly reference what was happening before
  - Merge it with the new information naturally

- If there is no clear connection between previous_summary and recent_messages:
  - Focus primarily on recent_messages

# BEHAVIOR RULES

- Summarize interactions as pairs when possible (user intent + assistant response)
- Focus on meaningful actions, decisions, and clarifications
- Avoid listing messages one by one
- Avoid redundancy

# OUTPUT

Return ONLY the summary as plain text. No JSON. No extra formatting.
"""
                llm = get_llm_model(is_supervisor=False).with_structured_output(str)
                recent_messages = result[StateKeys.MESSAGES][-6:]
                summary: str = llm.invoke(
                    SystemMessage(content=summarizer_sys_prompt),
                    SystemMessage(content=f"previous_summary: {result[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT]}"),
                    *recent_messages
                )
                result = graph.invoke(
                    Command(update={StateKeys.MESSAGES: [HumanMessage(content=user_input)],
                                    StateKeys.PREVIOUS_SUMMARY: {
                                        SumaryKeys.CONTENT: summary,
                                        SumaryKeys.POS_MSGS_COUNT: 1
                                    }}),
                    config=config
                )
            else:
                result = graph.invoke(
                    Command(update={StateKeys.MESSAGES: [HumanMessage(content=user_input)]}),
                    config=config
                )

if __name__ == "__main__":
    seed_catalog()
    main()