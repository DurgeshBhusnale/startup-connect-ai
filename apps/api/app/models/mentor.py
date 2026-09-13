from datetime import datetime
from typing import Annotated, Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models.founder import LinkedInUrl
from app.models.taxonomy import ExpertiseArea, InvestmentStage, MentorAvailability

ReferenceEmail = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_lower=True, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    ),
]


class MentorExpertiseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    areas: list[ExpertiseArea] = Field(min_length=1, max_length=len(ExpertiseArea))
    stages: list[InvestmentStage] = Field(min_length=1, max_length=3)
    availability: MentorAvailability
    session_fee: Annotated[int, Field(ge=0, le=100_000)] | None = None

    @model_validator(mode="after")
    def normalize(self) -> Self:
        self.areas = list(dict.fromkeys(self.areas))
        self.stages = list(dict.fromkeys(self.stages))
        if self.session_fee == 0:
            self.session_fee = None
        return self


class MentorExpertiseResponse(BaseModel):
    mentor_id: UUID


class LinkedInVerificationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    linkedin_url: LinkedInUrl


class ReferencesVerificationPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reference_emails: list[ReferenceEmail] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def distinct_emails(self) -> Self:
        if len(set(self.reference_emails)) != len(self.reference_emails):
            raise ValueError("reference emails must be different")
        return self


class LinkedInVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    method: Literal["linkedin"]
    payload: LinkedInVerificationPayload


class ReferencesVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    method: Literal["references"]
    payload: ReferencesVerificationPayload


VerificationRequest = Annotated[
    LinkedInVerificationRequest | ReferencesVerificationRequest, Field(discriminator="method")
]


class VerificationResponse(BaseModel):
    status: Literal["pending"]


class MentorExpertiseData(BaseModel):
    areas: list[ExpertiseArea]
    stages: list[InvestmentStage]
    availability: MentorAvailability
    session_fee: int | None


class MentorVerificationState(BaseModel):
    method: Literal["linkedin", "references"]
    status: Literal["pending"]
    linkedin_url: str | None
    reference_count: int
    requested_at: datetime


class MentorProfileState(BaseModel):
    profile_id: UUID
    completed: bool
    expertise: MentorExpertiseData | None
    verification: MentorVerificationState | None
