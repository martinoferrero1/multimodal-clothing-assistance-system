from pydantic import BaseModel, Field
from typing import Literal


class RoutingIntent(BaseModel):
    intent: Literal[
        "provide_specifications",
        "request_modification",
        "confirm",
        "reject",
        "cancel",
        "unclear"
    ] = Field(
        ...,
        description="Classified intent of the user message"
    )

    has_enough_information: bool = Field(
        ...,
        description="Whether the message contains enough information to proceed"
    )

PROVIDE_SPECIFICATIONS_INTENT = "provide_specifications"
REQUEST_MODIFICATION_INTENT = "request_modification"
CONFIRM_INTENT = "confirm"
REJECT_INTENT = "reject"
CANCEL_INTENT = "cancel"
UNCLEAR_INTENT = "unclear"