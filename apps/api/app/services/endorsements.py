"""S8: mutual-match investors and mentors vouch for specific claims on a founder's profile.

Verification (M6) isn't live yet, so a mutual match (accepted intro) is the bar for endorsing.
"""

import logging
from typing import Literal
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.errors import ProblemError
from app.models.db import AppRole, Endorsement, Match, Post, Profile, User
from app.models.endorsements import (
    EndorsementCreatedResponse,
    EndorsementCreateRequest,
    EndorsementItem,
    EndorsementItemKind,
    EndorsementRevokedResponse,
    GivenEndorsement,
    ProfileEndorsements,
)
from app.models.feedback import ConnectionStatus
from app.models.notifications import NotificationKind
from app.models.taxonomy import STAGE_LABELS
from app.services.badges import visible_profile
from app.services.connections import intro_for, load_other
from app.services.endorsement_cleanup import INACTIVE_ENDORSER, claim_label
from app.services.match_scoring import format_inr
from app.services.notifications import notify
from app.services.profile_snapshots import ProfileSnapshot

logger = logging.getLogger(__name__)

SNAPSHOT_CHARS = 300


async def _viewer_profile(session: AsyncSession, clerk_user_id: str) -> tuple[Profile, User]:
    row = (
        (
            await session.execute(
                select(Profile, User)
                .join(User, Profile.user_id == User.id)
                .where(
                    User.clerk_id == clerk_user_id,
                    Profile.kind == User.role,
                    User.deleted_at.is_(None),
                )
            )
        )
        .tuples()
        .first()
    )
    if row is None:
        raise ProblemError(
            status=404,
            slug="profile-not-found",
            title="Profile not found",
            detail="Finish setting up your profile first.",
        )
    return row


async def _mutual(session: AsyncSession, founder_id: UUID, partner_id: UUID) -> bool:
    intro = await intro_for(session, founder_id, partner_id)
    return intro is not None and intro.status == ConnectionStatus.ACCEPTED


async def _claim_snapshot(
    session: AsyncSession, founder: ProfileSnapshot, item_id: str
) -> str | None:
    """The claim as it reads now, or None if it doesn't exist."""
    if item_id.startswith("post:"):
        post: Post | None = await session.scalar(
            select(Post).where(
                Post.id == UUID(item_id.removeprefix("post:")),
                Post.profile_id == founder.profile_id,
                Post.kind == "milestone",
                Post.deleted_at.is_(None),
            )
        )
        value = (post.milestone or {}).get("value") if post is not None else None
        return str(value)[:SNAPSHOT_CHARS] if value else None
    l1 = founder.founder
    if l1 is None:
        return None
    field = item_id.removeprefix("l1.")
    if field == "ask_amount_inr":
        return f"Raising {format_inr(l1.ask_amount_inr)}"
    if field == "stage":
        return STAGE_LABELS[l1.stage.value]
    if field == "team_size":
        return f"{l1.team_size} {'person' if l1.team_size == 1 else 'people'}"
    raw = getattr(l1, field, None)
    if raw is None:
        return None
    return str(getattr(raw, "value", raw))[:SNAPSHOT_CHARS]


def _role(kind: AppRole | None) -> Literal["investor", "mentor"] | None:
    if kind == AppRole.INVESTOR:
        return "investor"
    if kind == AppRole.MENTOR:
        return "mentor"
    return None


async def create_endorsement(
    session: AsyncSession, clerk_user_id: str, body: EndorsementCreateRequest
) -> EndorsementCreatedResponse:
    viewer, viewer_user = await _viewer_profile(session, clerk_user_id)
    if body.target_profile_id == viewer.id:
        raise ProblemError(
            status=422,
            slug="own-claim",
            title="You can't endorse your own claim",
            detail="Endorsements come from investors and mentors who know your work.",
        )
    if viewer.kind == AppRole.FOUNDER:
        raise ProblemError(
            status=403,
            slug="endorsers-only",
            title="Only investors and mentors can endorse",
            detail="Endorsements come from investors and mentors you're connected with.",
        )
    founder = await load_other(session, body.target_profile_id)
    if founder.founder is None or not await _mutual(session, founder.profile_id, viewer.id):
        raise ProblemError(
            status=403,
            slug="not-mutual",
            title="Connect first",
            detail="You can endorse a founder's claims once you're a mutual match.",
        )

    existing: UUID | None = await session.scalar(
        select(Endorsement.id).where(
            Endorsement.endorser_profile_id == viewer.id,
            Endorsement.target_profile_id == founder.profile_id,
            Endorsement.target_item_id == body.target_item_id,
        )
    )
    if existing is not None:
        return EndorsementCreatedResponse(endorsement_id=existing)

    snapshot = await _claim_snapshot(session, founder, body.target_item_id)
    if snapshot is None:
        raise ProblemError(
            status=404,
            slug="claim-not-found",
            title="Claim not found",
            detail="That claim was changed or removed. Refresh and try again.",
        )
    name = viewer_user.display_name or ("Investor" if viewer.kind == AppRole.INVESTOR else "Mentor")
    endorsement = Endorsement(
        target_profile_id=founder.profile_id,
        endorser_profile_id=viewer.id,
        target_item_kind=body.target_item_kind.value,
        target_item_id=body.target_item_id,
        claim_snapshot=snapshot,
        endorser_name=name,
    )
    session.add(endorsement)
    await session.flush()
    endorsement_id = endorsement.id
    milestone = body.target_item_kind == EndorsementItemKind.MILESTONE
    await notify(
        session,
        user_id=founder.user_id,
        kind=NotificationKind.ENDORSEMENT_RECEIVED,
        title=f"{name} endorsed a claim on your profile",
        body=f"{claim_label(body.target_item_id)}: {snapshot}",
        action_label="View profile",
        action_href="/profile?tab=posts" if milestone else "/profile",
    )
    await session.commit()
    logger.info("endorsement_given target_item_kind=%s", body.target_item_kind.value)
    return EndorsementCreatedResponse(endorsement_id=endorsement_id)


async def revoke_endorsement(
    session: AsyncSession, clerk_user_id: str, endorsement_id: UUID
) -> EndorsementRevokedResponse:
    viewer, _ = await _viewer_profile(session, clerk_user_id)
    endorsement = await session.get(Endorsement, endorsement_id)
    if endorsement is None or endorsement.endorser_profile_id != viewer.id:
        raise ProblemError(
            status=404,
            slug="endorsement-not-found",
            title="Endorsement not found",
            detail="This endorsement doesn't exist or isn't yours.",
        )
    await session.delete(endorsement)
    await session.commit()
    logger.info("endorsement_revoked endorsement_id=%s", endorsement_id)
    return EndorsementRevokedResponse(status="revoked")


async def profile_endorsements(
    session: AsyncSession, clerk_user_id: str, profile_id: UUID
) -> ProfileEndorsements:
    target = await visible_profile(session, clerk_user_id, profile_id)
    viewer, _ = await _viewer_profile(session, clerk_user_id)
    can_endorse = (
        target.kind == AppRole.FOUNDER
        and viewer.kind != AppRole.FOUNDER
        and viewer.id != target.id
        and await _mutual(session, target.id, viewer.id)
    )
    endorser, endorser_user = aliased(Profile), aliased(User)
    rows = await session.execute(
        select(Endorsement, endorser.kind, endorser_user.deleted_at)
        .outerjoin(endorser, Endorsement.endorser_profile_id == endorser.id)
        .outerjoin(endorser_user, endorser.user_id == endorser_user.id)
        .where(Endorsement.target_profile_id == target.id)
        .order_by(Endorsement.created_at)
    )
    items: list[EndorsementItem] = []
    endorsers: set[UUID] = set()
    for endorsement, kind, deleted_at in rows.tuples():
        active = endorsement.endorser_profile_id is not None and deleted_at is None
        endorsers.add(endorsement.endorser_profile_id or endorsement.id)
        items.append(
            EndorsementItem(
                endorsement_id=endorsement.id,
                item_id=endorsement.target_item_id,
                item_kind=EndorsementItemKind(endorsement.target_item_kind),
                endorser_name=(endorsement.endorser_name or "Investor")
                if active
                else INACTIVE_ENDORSER,
                endorser_role=_role(kind) if active else None,
                endorser_active=active,
                is_mine=endorsement.endorser_profile_id == viewer.id,
                created_at=endorsement.created_at,
            )
        )
    return ProfileEndorsements(can_endorse=can_endorse, endorser_count=len(endorsers), items=items)


async def given_endorsements(session: AsyncSession, clerk_user_id: str) -> list[GivenEndorsement]:
    viewer, _ = await _viewer_profile(session, clerk_user_id)
    founder, founder_user = aliased(Profile), aliased(User)
    rows = await session.execute(
        select(Endorsement, founder.l1_data, founder_user.display_name, Match.id)
        .join(founder, Endorsement.target_profile_id == founder.id)
        .join(founder_user, founder.user_id == founder_user.id)
        .outerjoin(
            Match, and_(Match.from_profile_id == viewer.id, Match.to_profile_id == founder.id)
        )
        .where(Endorsement.endorser_profile_id == viewer.id, founder_user.deleted_at.is_(None))
        .order_by(Endorsement.created_at.desc())
    )
    return [
        GivenEndorsement(
            endorsement_id=endorsement.id,
            founder_profile_id=endorsement.target_profile_id,
            founder_name=display_name or str(l1_data.get("startup_name") or "Founder"),
            match_id=match_id,
            item_id=endorsement.target_item_id,
            item_label=claim_label(endorsement.target_item_id),
            claim=endorsement.claim_snapshot,
            created_at=endorsement.created_at,
        )
        for endorsement, l1_data, display_name, match_id in rows.tuples()
    ]
