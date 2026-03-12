from functools import wraps
from shared.base_state import BaseState

def safe_node(node_name: str):
    def decorator(func):
        @wraps(func)
        def wrapper(self, state: BaseState):
            try:
                return func(self, state)
            except Exception as e:
                return {
                    "errors": [{
                        "node": node_name,
                        "message": str(e),
                        "type": type(e).__name__,
                    }]
                }
        return wrapper
    return decorator
