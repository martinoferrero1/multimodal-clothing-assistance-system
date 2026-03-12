from typing import Annotated, List
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
import operator
from core.settings import Settings

MessagesState = Annotated[List[BaseMessage], operator.add]

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

class BaseStateKeys:
    SETTINGS = "settings"
    MESSAGES = "messages"
    ERRORS = "errors"
    FINISHED = "finished"