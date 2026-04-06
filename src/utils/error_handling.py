from functools import wraps
from langgraph.types import Command
from langgraph.graph import END
from state import State, StateKeys, SumaryKeys
from langchain_core.messages import AIMessage
from state import ErrorKeys

def safe_node(node_name: str):
    def decorator(func):
        @wraps(func)
        def wrapper(self, state: State):
            try:
                return func(self, state)
            except Exception as e:
                if node_name == "decide_specialist":
                    next = "ask_for_feedback"
                else:
                    next = END
                return Command(goto=next, update={
                        StateKeys.ERRORS: [{
                        ErrorKeys.NODE: node_name,
                        ErrorKeys.MESSAGE: str(e),
                        ErrorKeys.TYPE: type(e).__name__,
                    }],
                    StateKeys.MESSAGES: [AIMessage(content=f"An error occurred while answering your request, please try again.")],
                    StateKeys.UNCLEAR_MSG: False,
                    StateKeys.PREVIOUS_SUMMARY: {
                        SumaryKeys.CONTENT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.CONTENT],
                        SumaryKeys.POS_MSGS_COUNT: state[StateKeys.PREVIOUS_SUMMARY][SumaryKeys.POS_MSGS_COUNT] + 1
                    } 
                    }),
                
        return wrapper
    return decorator
