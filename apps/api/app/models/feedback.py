from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

INTRO_MESSAGE_MIN = 20
INTRO_MESSAGE_MAX = 500


class RejectReason(StrEnum):
    WRONG_SECTOR = "wrong_sector"
    WRONG_STAGE = "wrong_stage"
    WRONG_GEO = "wrong_geo"
    NOT_RIGHT_PERSON = "not_right_person"
    OTHER = "other"


class ConnectionStatus(StrEnum):
    NONE = "none"
    INTERESTED = "interested"
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


MatchActionType = Literal["accept", "reject", "save", "unsave", "restore"]


class MatchActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: MatchActionType
    reason: RejectReason | None = None
    position: Annotated[int, Field(ge=0, le=100)] | None = None

    @model_validator(mode="after")
    def reason_only_for_reject(self) -> "MatchActionRequest":
        if self.reason is not None and self.action != "reject":
            raise ValueError("A reason can only be given with the 'reject' action")
        return self


class MatchState(BaseModel):
    saved_at: datetime | None
    rejected: bool
    connection: ConnectionStatus
    intro_id: UUID | None


class MatchActionResponse(BaseModel):
    status: Literal["ok"] = "ok"
    updated_match_state: MatchState


class IntroDraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attempt: Annotated[int, Field(ge=0, le=50)] = 0


class IntroDraftResponse(BaseModel):
    draft: str
    source: Literal["llm", "unavailable"]


IntroMessage = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=INTRO_MESSAGE_MIN, max_length=INTRO_MESSAGE_MAX
    ),
]


class IntroRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: IntroMessage
    # The AI draft the founder started from, used only for the edit-ratio analytics event.
    original_draft: Annotated[str, StringConstraints(max_length=INTRO_MESSAGE_MAX)] | None = None


class IntroCreatedResponse(BaseModel):
    intro_id: UUID
    status: ConnectionStatus


class IntroRespondRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["accept", "decline"]
    reason: RejectReason | None = None

    @model_validator(mode="after")
    def reason_only_for_decline(self) -> "IntroRespondRequest":
        if self.reason is not None and self.action != "decline":
            raise ValueError("A reason can only be given when declining")
        return self


class IntroRespondResponse(BaseModel):
    status: ConnectionStatus
    match_id: UUID
