import uuid
from langgraph.types import Command
from langchain_core.messages import HumanMessage
from agents.main_supervisor_agent.graph import SupervisorGraph
from agents.main_supervisor_agent.state import SupervisorStateKeys
from shared.base_state import BaseStateKeys
from core.settings import Settings
from dotenv import load_dotenv


def main():
    load_dotenv()
    settings = Settings()
    graph = SupervisorGraph().get_graph()
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    print("Assistant ready. Type 'exit' to quit.\n")

    #user_input = input("User: ")
    user_input = "I want two special outfits (create an outfit). One of them is for my wedding, I need a blue dress from the last year. But also I want an outfit for playing tennis. It needs to have a pair of sneakers with red as main color but also blue in a secondary grade. And also it needs a t-shirt, but not much expensive, I can pay a maximum of 25 USD for that"
    if user_input.lower() not in {"exit", "quit"}:
        result = graph.invoke(
                {
                    BaseStateKeys.SETTINGS: settings,
                    BaseStateKeys.MESSAGES: [HumanMessage(content=user_input)],
                    BaseStateKeys.ERRORS: [],
                    BaseStateKeys.FINISHED: False,
                    BaseStateKeys.CURRENT_RESPONSE_MSG: None,
                    BaseStateKeys.LAST_MESSAGES_CONTEXT: [],
                    BaseStateKeys.PREVIOUS_SUMMARY: None,
                    SupervisorStateKeys.FLOW_STACK: [],
                    SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False
                },
                config=config
            )
        while True:
            print("Errors: ", result.get(BaseStateKeys.ERRORS, []))
            response = result.get(BaseStateKeys.CURRENT_RESPONSE_MSG)
            if response:
                print(f"Assistant:\n{response.content}\n")
            else:
                print("Assistant: (no response)\n")
            
            user_input = input("User: ")
            if user_input.lower() in {"exit", "quit"}:
                break
            
            #graph.update_state(config=config, values={
                #BaseStateKeys.MESSAGES: [HumanMessage(content=user_input)],
            #})
            print("el resultado del asistente es: ", result)
            result = graph.invoke(
                Command(update={BaseStateKeys.MESSAGES: [HumanMessage(content=user_input)]}),
                config=config
            )

if __name__ == "__main__":
    main()