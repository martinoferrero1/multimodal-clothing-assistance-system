from pydantic import BaseModel
from enum import Enum

class Action(str, Enum):
    outfit_expert = "call_outfit_expert"
    buy_expert = "call_buy_expert"
    order_expert = "call_order_expert"
    clarify_conversation = "clarify_conversation"
    end_conversation = "end_conversation"
    respond = "respond"

class SupervisorDecision(BaseModel):
    action: Action