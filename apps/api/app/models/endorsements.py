import re
from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

# Founder facts shown as claims on S-10 / S-14 (item ids "l1.<field>").
ENDORSABLE_FIELDS: dict[str, str] = {
    "sector": "Sector",
    "stage": "Stage",
    "ask_amount_inr": "Raising",
    "team_size": "Team",
    "business_model": "Business model",
    "city": "City",
    "description": "Startup description",
}
_POST_ITEM = re.compile(r"^post:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


class EndorsementItemKind(StrEnum):
    PROFILE_FIELD = "profile_field"
    MILESTONE = "milestone"


def field_item_id(field: str) -> str:
    return f"l1.{field}"


def milestone_item_id(post_id: UUID) -> str:
    return f"post:{post_id}"


class EndorsementCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_profile_id: UUID
    target_item_id: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]
    target_item_kind: EndorsementItemKind

    @model_validator(mode="after")
    def known_claim(self) -> Self:
        item = self.target_item_id.lower()
        if self.target_item_kind == EndorsementItemKind.MILESTONE:
            if not _POST_ITEM.match(item):
                raise ValueError("Milestone claims look like post:<id>")
        elif item.removeprefix("l1.") not in ENDORSABLE_FIELDS or not item.startswith("l1."):
            raise ValueError("That profile detail can't be endorsed")
        self.target_item_id = item
        return self


class EndorsementCreatedResponse(BaseModel):
    endorsement_id: UUID


class EndorsementRevokedResponse(BaseModel):
    status: Literal["revoked"]


class EndorsementItem(BaseModel):
    endorsement_id: UUID
    item_id: str
    item_kind: EndorsementItemKind
    # "Endorser account inactive" once the endorser deactivated or deleted their account.
    endorser_name: str
    endorser_role: Literal["investor", "mentor"] | None
    endorser_active: bool
    is_mine: bool
    created_at: datetime


class ProfileEndorsements(BaseModel):
    # True when the viewer may endorse this founder (a mutual-match investor or mentor).
    can_endorse: bool
    endorser_count: int
    items: list[EndorsementItem]


class GivenEndorsement(BaseModel):
    endorsement_id: UUID
    founder_profile_id: UUID
    founder_name: str
    # The endorser's own match row, for linking to Match Detail; None if it's gone.
    match_id: UUID | None
    item_id: str
    item_label: str
    claim: str | None
    created_at: datetime
