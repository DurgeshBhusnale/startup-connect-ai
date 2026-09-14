"""M10: DPDP controls - consents, notification topics, data export, and account deletion."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import Select, delete, func, inspect, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.errors import ProblemError
from app.models.db import (
    Base,
    ConsentLog,
    ConsentScope,
    DataExportRequest,
    FeedbackEvent,
    IntroRequest,
    InvestorThesis,
    Match,
    Meeting,
    MentorExpertise,
    Notification,
    Post,
    PostMedia,
    PriorInvestment,
    Profile,
    User,
)
from app.models.feedback import ConnectionStatus
from app.models.notifications import NotificationKind
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
from app.services import storage, vector_store
from app.services.clerk import delete_clerk_user, fetch_clerk_identity
from app.services.notifications import notify

logger = logging.getLogger(__name__)

GRACE_PERIOD = timedelta(days=30)
EXPORT_LINK_TTL = timedelta(hours=1)
MAX_EXPORTS_PER_DAY = 5
SCOPE_ORDER = (
    ConsentScope.TERMS_PRIVACY,
    ConsentScope.MATCH_PROCESSING,
    ConsentScope.EMAIL_NOTIFICATIONS,
    ConsentScope.WHATSAPP_NOTIFICATIONS,
)
# Withdrawing Terms & Privacy means leaving the platform, which is what account deletion does.
LOCKED_SCOPES = frozenset({ConsentScope.TERMS_PRIVACY})


async def require_user(session: AsyncSession, clerk_user_id: str) -> User:
    user: User | None = await session.scalar(
        select(User).where(User.clerk_id == clerk_user_id, User.purged_at.is_(None))
    )
    if user is None or user.role is None:
        raise ProblemError(
            status=409,
            slug="not-onboarded",
            title="Finish onboarding",
            detail="Finish setting up your account first.",
        )
    return user


async def _latest_consents(session: AsyncSession, user_id: UUID) -> dict[ConsentScope, ConsentLog]:
    rows = await session.scalars(
        select(ConsentLog)
        .where(ConsentLog.user_id == user_id)
        .distinct(ConsentLog.scope)
        .order_by(ConsentLog.scope, ConsentLog.created_at.desc())
    )
    return {row.scope: row for row in rows}


async def list_consents(session: AsyncSession, clerk_user_id: str) -> list[ConsentItem]:
    user = await require_user(session, clerk_user_id)
    latest = await _latest_consents(session, user.id)
    items: list[ConsentItem] = []
    for scope in SCOPE_ORDER:
        row = latest.get(scope)
        items.append(
            ConsentItem(
                scope=scope,
                granted=row.granted if row else False,
                granted_at=row.created_at if row else None,
                policy_version=row.policy_version if row else None,
                withdrawable=scope not in LOCKED_SCOPES,
            )
        )
    return items


async def record_consent(
    session: AsyncSession, clerk_user_id: str, body: ConsentRequest
) -> ConsentCreatedResponse:
    user = await require_user(session, clerk_user_id)
    policy_version = get_settings().consent_policy_version
    if body.policy_version != policy_version:
        raise ProblemError(
            status=409,
            slug="policy-version-outdated",
            title="Privacy policy updated",
            detail="The privacy policy has changed. Reload the page and review your choices.",
        )
    if body.scope in LOCKED_SCOPES and not body.granted:
        raise ProblemError(
            status=409,
            slug="consent-required",
            title="This consent is required",
            detail=(
                "The Terms of Service and Privacy Policy are required to use Startup Connect AI. "
                "To withdraw it, delete your account."
            ),
        )

    current = (await _latest_consents(session, user.id)).get(body.scope)
    if (
        current is not None
        and current.granted == body.granted
        and current.policy_version == policy_version
    ):
        return ConsentCreatedResponse(consent_id=current.id)

    # Append-only audit trail (PRD M10 AC2): a withdrawal is a new row, never an update.
    entry = ConsentLog(
        user_id=user.id, scope=body.scope, granted=body.granted, policy_version=policy_version
    )
    session.add(entry)
    if body.scope == ConsentScope.MATCH_PROCESSING:
        user.matching_enabled = body.granted
        if not body.granted:
            await notify(
                session,
                user_id=user.id,
                kind=NotificationKind.MATCHING_PAUSED,
                title="Matching paused",
                body=(
                    "You withdrew consent to use your profile data for matching, so your profile "
                    "is hidden and no matches are computed. Turn it back on in Privacy & Data."
                ),
                action_label="Privacy settings",
                action_href="/settings/privacy",
            )
    await session.flush()
    if body.granted:
        logger.info("consent_granted scope=%s at=settings", body.scope.value)
    else:
        logger.info("consent_withdrawn scope=%s", body.scope.value)
    await session.commit()
    return ConsentCreatedResponse(consent_id=entry.id)


def _preferences(user: User) -> NotificationPreferences:
    stored = user.notification_preferences or {}
    values = {
        name: value
        for name, value in stored.items()
        if name in NotificationPreferences.model_fields and isinstance(value, bool)
    }
    return NotificationPreferences.model_validate(values)


async def get_notification_preferences(
    session: AsyncSession, clerk_user_id: str
) -> NotificationPreferences:
    return _preferences(await require_user(session, clerk_user_id))


async def save_notification_preferences(
    session: AsyncSession, clerk_user_id: str, body: NotificationPreferences
) -> NotificationPreferences:
    user = await require_user(session, clerk_user_id)
    user.notification_preferences = body.model_dump()
    await session.commit()
    return body


async def request_data_export(session: AsyncSession, clerk_user_id: str) -> DataExportResponse:
    user = await require_user(session, clerk_user_id)
    now = datetime.now(UTC)
    recent: int | None = await session.scalar(
        select(func.count())
        .select_from(DataExportRequest)
        .where(
            DataExportRequest.user_id == user.id,
            DataExportRequest.requested_at >= now - timedelta(days=1),
        )
    )
    if (recent or 0) >= MAX_EXPORTS_PER_DAY:
        raise ProblemError(
            status=429,
            slug="export-limit-reached",
            title="Export limit reached",
            detail=f"You can export your data {MAX_EXPORTS_PER_DAY} times a day. Try tomorrow.",
        )
    export = DataExportRequest(user_id=user.id, requested_at=now)
    session.add(export)
    await session.flush()
    export_id = export.id
    await session.commit()
    logger.info("data_export_requested export_id=%s", export_id)
    # No job queue or email yet, so the export is generated on download, right away.
    return DataExportResponse(
        export_id=export_id,
        estimated_ready_at=now,
        download_path=f"/v1/me/data-export/{export_id}",
    )


async def list_data_exports(session: AsyncSession, clerk_user_id: str) -> list[DataExportItem]:
    user = await require_user(session, clerk_user_id)
    rows = (
        await session.scalars(
            select(DataExportRequest)
            .where(DataExportRequest.user_id == user.id)
            .order_by(DataExportRequest.requested_at.desc())
            .limit(5)
        )
    ).all()
    return [
        DataExportItem(
            export_id=row.id, requested_at=row.requested_at, downloaded_at=row.downloaded_at
        )
        for row in rows
    ]


def _columns(row: Base) -> dict[str, Any]:
    return {attr.key: getattr(row, attr.key) for attr in inspect(row).mapper.column_attrs}


async def _dump(session: AsyncSession, statement: Select[Any]) -> list[dict[str, Any]]:
    return [_columns(row) for row in (await session.scalars(statement)).all()]


async def build_data_export(
    session: AsyncSession, clerk_user_id: str, export_id: UUID
) -> dict[str, Any]:
    user = await require_user(session, clerk_user_id)
    export: DataExportRequest | None = await session.get(DataExportRequest, export_id)
    now = datetime.now(UTC)
    if export is None or export.user_id != user.id or now - export.requested_at > EXPORT_LINK_TTL:
        raise ProblemError(
            status=404,
            slug="export-not-found",
            title="Export not found",
            detail="This export has expired. Request a new one.",
        )

    profile_ids = list(
        (await session.scalars(select(Profile.id).where(Profile.user_id == user.id))).all()
    )
    payload: dict[str, Any] = {
        "generated_at": now,
        "privacy_policy_version": get_settings().consent_policy_version,
        "account": _columns(user),
        "consent_history": await _dump(
            session,
            select(ConsentLog).where(ConsentLog.user_id == user.id).order_by(ConsentLog.created_at),
        ),
        "profiles": await _dump(session, select(Profile).where(Profile.user_id == user.id)),
        "investor_thesis": await _dump(
            session, select(InvestorThesis).where(InvestorThesis.profile_id.in_(profile_ids))
        ),
        "mentor_expertise": await _dump(
            session, select(MentorExpertise).where(MentorExpertise.profile_id.in_(profile_ids))
        ),
        "prior_investments": await _dump(
            session, select(PriorInvestment).where(PriorInvestment.profile_id.in_(profile_ids))
        ),
        "matches": await _dump(
            session, select(Match).where(Match.from_profile_id.in_(profile_ids))
        ),
        "feedback_events": await _dump(
            session,
            select(FeedbackEvent).where(FeedbackEvent.actor_profile_id.in_(profile_ids)),
        ),
        "intro_requests": await _dump(
            session,
            select(IntroRequest).where(
                or_(
                    IntroRequest.founder_profile_id.in_(profile_ids),
                    IntroRequest.partner_profile_id.in_(profile_ids),
                )
            ),
        ),
        "meetings": await _dump(
            session,
            select(Meeting).where(
                or_(
                    Meeting.founder_profile_id.in_(profile_ids),
                    Meeting.partner_profile_id.in_(profile_ids),
                )
            ),
        ),
        "posts": await _dump(session, select(Post).where(Post.profile_id.in_(profile_ids))),
        "post_images": await _dump(
            session, select(PostMedia).where(PostMedia.profile_id.in_(profile_ids))
        ),
        "notifications": await _dump(
            session, select(Notification).where(Notification.user_id == user.id)
        ),
        "data_export_requests": await _dump(
            session, select(DataExportRequest).where(DataExportRequest.user_id == user.id)
        ),
    }
    export.downloaded_at = now
    await session.commit()
    return payload


async def _cancel_open_intros(session: AsyncSession, user: User, now: datetime) -> None:
    """PRD M10 edge case: pending intros are cancelled and the other party is told why."""
    own_ids = set(
        (await session.scalars(select(Profile.id).where(Profile.user_id == user.id))).all()
    )
    if not own_ids:
        return
    intros = (
        await session.scalars(
            select(IntroRequest).where(
                or_(
                    IntroRequest.founder_profile_id.in_(own_ids),
                    IntroRequest.partner_profile_id.in_(own_ids),
                ),
                IntroRequest.status.in_([ConnectionStatus.PENDING, ConnectionStatus.INTERESTED]),
            )
        )
    ).all()
    if not intros:
        return
    other_ids = [
        intro.partner_profile_id
        if intro.founder_profile_id in own_ids
        else intro.founder_profile_id
        for intro in intros
    ]
    owners = {
        profile_id: user_id
        for profile_id, user_id in (
            await session.execute(
                select(Profile.id, Profile.user_id).where(Profile.id.in_(other_ids))
            )
        ).tuples()
    }
    name = user.display_name or "A member"
    for intro, other_id in zip(intros, other_ids, strict=True):
        intro.status = ConnectionStatus.CANCELLED.value
        intro.responded_at = now
        other_user_id = owners.get(other_id)
        if other_user_id is not None:
            await notify(
                session,
                user_id=other_user_id,
                kind=NotificationKind.INTRO_CANCELLED,
                title="An intro request was cancelled",
                body=f"{name} closed their account, so this intro can't go ahead.",
                action_label="Browse matches",
                action_href="/matches",
            )


async def schedule_account_deletion(
    session: AsyncSession, clerk_user_id: str, body: DeleteAccountRequest
) -> DeleteAccountResponse:
    user = await require_user(session, clerk_user_id)
    identity = await fetch_clerk_identity(clerk_user_id)
    account_email = (identity.email or user.email).strip().casefold()
    if not account_email or body.confirm_email.casefold() != account_email:
        raise ProblemError(
            status=422,
            slug="email-mismatch",
            title="Email doesn't match",
            detail="Type the email address on your account to confirm.",
        )
    if user.hard_delete_at is not None:
        return DeleteAccountResponse(hard_delete_at=user.hard_delete_at)

    now = datetime.now(UTC)
    hard_delete_at = now + GRACE_PERIOD
    # Soft delete (PRD M10 AC6): profile_snapshots hides the account from matching immediately.
    user.deleted_at = now
    user.hard_delete_at = hard_delete_at
    await _cancel_open_intros(session, user, now)
    await session.commit()
    logger.info("account_deletion_requested hard_delete_at=%s", hard_delete_at.isoformat())
    return DeleteAccountResponse(hard_delete_at=hard_delete_at)


async def restore_account(session: AsyncSession, clerk_user_id: str) -> RestoreAccountResponse:
    user = await require_user(session, clerk_user_id)
    if user.hard_delete_at is not None:
        user.deleted_at = None
        user.hard_delete_at = None
        await session.commit()
        logger.info("account_deletion_cancelled")
    return RestoreAccountResponse()


async def purge_account(session: AsyncSession, user: User) -> None:
    """Erases an account after its grace period (PRD M10 AC6).

    Profiles, matches, intros, feedback, and notifications are deleted. The users row stays,
    anonymised, because consent_log is a DPDP audit record that references it (ON DELETE RESTRICT).
    """
    profile_ids = list(
        (await session.scalars(select(Profile.id).where(Profile.user_id == user.id))).all()
    )
    await vector_store.delete_vectors(profile_ids)
    media_paths = [
        path
        for row in (
            await session.execute(
                select(PostMedia.storage_path, PostMedia.thumbnail_path).where(
                    PostMedia.profile_id.in_(profile_ids)
                )
            )
        ).tuples()
        for path in row
    ]
    await storage.delete_objects(media_paths)
    await delete_clerk_user(user.clerk_id)
    await session.execute(delete(Notification).where(Notification.user_id == user.id))
    await session.execute(delete(DataExportRequest).where(DataExportRequest.user_id == user.id))
    await session.execute(delete(Profile).where(Profile.user_id == user.id))
    user.clerk_id = f"deleted:{user.id}"
    user.email = ""
    user.display_name = None
    user.role = None
    user.last_active_at = None
    user.notification_preferences = {}
    user.matching_enabled = False
    user.hard_delete_at = None
    user.purged_at = datetime.now(UTC)
    await session.commit()
