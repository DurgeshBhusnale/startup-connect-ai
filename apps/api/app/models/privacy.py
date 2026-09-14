from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

from app.models.db import ConsentScope


class ConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scope: ConsentScope
    granted: bool
    policy_version: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]


class ConsentCreatedResponse(BaseModel):
    consent_id: UUID


class ConsentItem(BaseModel):
    scope: ConsentScope
    granted: bool
    granted_at: datetime | None
    policy_version: str | None
    # Terms & Privacy can only be withdrawn by deleting the account.
    withdrawable: bool


class NotificationPreferences(BaseModel):
    """In-app notification topics. Email and WhatsApp follow the consent scopes."""

    model_config = ConfigDict(extra="forbid")

    new_matches: bool = True
    intro_requests: bool = True
    mutual_matches: bool = True
    interest: bool = True


class DataExportResponse(BaseModel):
    export_id: UUID
    estimated_ready_at: datetime
    download_path: str


class DataExportItem(BaseModel):
    export_id: UUID
    requested_at: datetime
    downloaded_at: datetime | None


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm_email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)]


class DeleteAccountResponse(BaseModel):
    status: Literal["scheduled_deletion"] = "scheduled_deletion"
    hard_delete_at: datetime


class RestoreAccountResponse(BaseModel):
    status: Literal["active"] = "active"
