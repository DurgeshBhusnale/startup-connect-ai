import re
from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints, model_validator

_WEBSITE = re.compile(r"^(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})(/\S*)?$", re.IGNORECASE)


def normalize_website(value: str) -> str:
    match = _WEBSITE.match(value.strip())
    if match is None:
        raise ValueError("Enter a website like https://rupeez.in")
    return f"https://{match.group(1).lower()}{match.group(2) or ''}"


Bio = Annotated[str, StringConstraints(strip_whitespace=True, max_length=280)]
Website = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=200), AfterValidator(normalize_website)
]


class AboutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["founder", "investor", "mentor"]
    bio: Bio | None = None
    website: Website | None = None

    @model_validator(mode="after")
    def check_fields(self) -> Self:
        if self.bio == "":
            self.bio = None
        if self.website is not None and self.kind != "founder":
            raise ValueError("only founder profiles have a website")
        return self


class AboutResponse(BaseModel):
    profile_id: UUID


class EndorsedItem(BaseModel):
    item_id: str
    # None once the endorser's account is purged (shown as "Endorser account inactive").
    endorser_id: UUID | None
    endorser_name: str
    endorser_active: bool = True


class BadgesResponse(BaseModel):
    verified_items: list[str]
    endorsed_items: list[EndorsedItem]
    self_reported_stale: list[str]
    last_updated: dict[str, datetime]
