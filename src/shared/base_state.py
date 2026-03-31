from typing import Annotated, List
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
import operator
from core.settings import Settings

MessagesState = Annotated[List[BaseMessage], operator.add]
LastMessagesContextState = Annotated[List[BaseMessage], lambda old, new: new]

class Error(TypedDict):
    node: str
    message: str
    type: str

ErrorState = Annotated[List[Error], operator.add]

class BaseState(TypedDict):
    settings: Settings
    messages: MessagesState
    errors: ErrorState
    finished: bool
    current_response_msg: BaseMessage
    last_messages_context: LastMessagesContextState
    previous_summary: str

class BaseStateKeys:
    SETTINGS = "settings"
    MESSAGES = "messages"
    ERRORS = "errors"
    FINISHED = "finished"
    CURRENT_RESPONSE_MSG = "current_response_msg"
    LAST_MESSAGES_CONTEXT = "last_messages_context"
    PREVIOUS_SUMMARY = "previous_summary"