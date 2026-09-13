from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.db import AppRole, ConsentScope


class ConsentChoices(BaseModel):
    model_config = ConfigDict(extra="forbid")

    terms_privacy: bool
    match_processing: bool
    email_notifications: bool
    whatsapp_notifications: bool

    @model_validator(mode="after")
    def require_mandatory_consents(self) -> Self:
        if not (self.terms_privacy and self.match_processing):
            raise ValueError("terms_privacy and match_processing consent are required")
        return self

    def as_scopes(self) -> list[tuple[ConsentScope, bool]]:
        return [
            (ConsentScope.TERMS_PRIVACY, self.terms_privacy),
            (ConsentScope.MATCH_PROCESSING, self.match_processing),
            (ConsentScope.EMAIL_NOTIFICATIONS, self.email_notifications),
            (ConsentScope.WHATSAPP_NOTIFICATIONS, self.whatsapp_notifications),
        ]


class OnboardingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: AppRole
    consents: ConsentChoices


class MeResponse(BaseModel):
    onboarded: bool
    role: AppRole | None
