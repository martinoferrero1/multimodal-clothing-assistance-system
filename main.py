import json
import uuid
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from agents.main_supervisor_agent.graph import SupervisorGraph
from agents.main_supervisor_agent.state import SupervisorStateKeys
from shared.base_state import BaseStateKeys
from core.settings import Settings
from dotenv import load_dotenv
from tools.supervisor_tools import RESULT_RESPONSE_KEY

def main():
    load_dotenv()
    settings = Settings()
    graph = SupervisorGraph().get_graph()
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    print("Assistant ready. Type 'exit' to quit.\n")

    while True:
        user_input = input("User: ")
        if user_input.lower() in {"exit", "quit"}:
            break
        result = graph.invoke(
            {
                BaseStateKeys.SETTINGS: settings,
                BaseStateKeys.MESSAGES: [HumanMessage(content=user_input)],
                BaseStateKeys.ERRORS: [],
                BaseStateKeys.FINISHED: False,
                SupervisorStateKeys.FLOW_STACK: [],
                SupervisorStateKeys.AWAITING_NEW_INTENT_CONFIRMATION: False,
                SupervisorStateKeys.EVALUATING_UNCOMPREHENDED_MSG: False,
            },
            config=config,
        )
        print("Errors: ", result.get(BaseStateKeys.ERRORS, []))
        messages = result.get(BaseStateKeys.MESSAGES, [])
        content = None
        for msg in reversed(messages):
            content = getattr(msg, "content", None)
            if content and isinstance(msg, ToolMessage):
                print("el content es: ", content)
                content = json.loads(content).get(RESULT_RESPONSE_KEY, None)
            if content:
                break
        if content:
            print(f"Assistant:\n{content}\n")
        else:
            print("Assistant: (no response)\n")


if __name__ == "__main__":
    main()