import json
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Response
from fastapi.encoders import jsonable_encoder

from app.models.privacy import (
    ConsentCreatedResponse,
    ConsentItem,
    ConsentRequest,
    DataExportItem,
    DataExportResponse,
    DeleteAccountRequest,
    DeleteAccountResponse,
    NotificationPreferences,
    RestoreAccountResponse,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import privacy

router = APIRouter(prefix="/v1", tags=["privacy"])


@router.post("/consent", response_model=ConsentCreatedResponse, status_code=201)
async def record_consent(
    body: ConsentRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> ConsentCreatedResponse:
    return await privacy.record_consent(session, clerk_user_id, body)


@router.get("/me/consents", response_model=list[ConsentItem])
async def read_consents(session: SessionDep, clerk_user_id: ClerkUserId) -> list[ConsentItem]:
    return await privacy.list_consents(session, clerk_user_id)


@router.get("/me/notification-preferences", response_model=NotificationPreferences)
async def read_notification_preferences(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> NotificationPreferences:
    return await privacy.get_notification_preferences(session, clerk_user_id)


@router.put("/me/notification-preferences", response_model=NotificationPreferences)
async def save_notification_preferences(
    body: NotificationPreferences, session: SessionDep, clerk_user_id: ClerkUserId
) -> NotificationPreferences:
    return await privacy.save_notification_preferences(session, clerk_user_id, body)


@router.post("/me/data-export", response_model=DataExportResponse, status_code=202)
async def request_data_export(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> DataExportResponse:
    return await privacy.request_data_export(session, clerk_user_id)


@router.get("/me/data-exports", response_model=list[DataExportItem])
async def read_data_exports(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> list[DataExportItem]:
    return await privacy.list_data_exports(session, clerk_user_id)


@router.get("/me/data-export/{export_id}")
async def download_data_export(
    export_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> Response:
    payload = await privacy.build_data_export(session, clerk_user_id, export_id)
    filename = f"startup-connect-data-{datetime.now(UTC):%Y-%m-%d}.json"
    return Response(
        content=json.dumps(jsonable_encoder(payload), indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.delete("/me/account", response_model=DeleteAccountResponse)
async def delete_account(
    body: DeleteAccountRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> DeleteAccountResponse:
    return await privacy.schedule_account_deletion(session, clerk_user_id, body)


@router.post("/me/account/restore", response_model=RestoreAccountResponse)
async def restore_account(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> RestoreAccountResponse:
    return await privacy.restore_account(session, clerk_user_id)
