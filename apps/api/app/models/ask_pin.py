import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

ASK_PIN_MAX = 140
_WHITESPACE = re.compile(r"\s+")


class AskPinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Collapsed to one line before the length check, so pasted line breaks don't count.
    text: Annotated[str, StringConstraints(min_length=1, max_length=ASK_PIN_MAX)]

    @field_validator("text", mode="before")
    @classmethod
    def one_line(cls, value: object) -> object:
        return _WHITESPACE.sub(" ", value).strip() if isinstance(value, str) else value


class AskPinResponse(BaseModel):
    status: Literal["saved", "cleared"]
    ask_pin: str | None
