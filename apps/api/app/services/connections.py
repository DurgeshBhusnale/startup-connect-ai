"""M9: match feedback (save / not a fit / accept) and founder <-> investor/mentor intro requests."""

import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from difflib import SequenceMatcher
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole, FeedbackEvent, IntroRequest, Match
from app.models.feedback import (
    ConnectionStatus,
    IntroCreatedResponse,
    IntroRequestBody,
    IntroRespondRequest,
    IntroRespondResponse,
    MatchActionRequest,
    MatchActionResponse,
    MatchState,
)
from app.models.intros import IntroQueueItem
from app.models.notifications import NotificationKind
from app.models.taxonomy import STAGE_LABELS
from app.services.match_cards import profile_card
from app.services.match_explanations import explanation_state
from app.services.notifications import notify
from app.services.profile_snapshots import ProfileSnapshot, load_by_ids, load_viewer

logger = logging.getLogger(__name__)

ROLE_NOUNS: dict[AppRole, str] = {
    AppRole.FOUNDER: "Founder",
    AppRole.INVESTOR: "Investor",
    AppRole.MENTOR: "Mentor",
}


def match_not_found() -> ProblemError:
    return ProblemError(
        status=404,
        slug="match-not-found",
        title="Match not found",
        detail="This match no longer exists. Your matches may have refreshed.",
    )


def founders_only() -> ProblemError:
    return ProblemError(
        status=403,
        slug="founders-only",
        title="Founders only",
        detail="Only founders can request intros.",
    )


def display_name(snapshot: ProfileSnapshot) -> str:
    if snapshot.display_name:
        return snapshot.display_name
    if snapshot.founder is not None:
        return snapshot.founder.startup_name
    return ROLE_NOUNS[snapshot.kind]


def first_name(snapshot: ProfileSnapshot) -> str:
    return display_name(snapshot).split()[0]


async def require_viewer(session: AsyncSession, clerk_user_id: str) -> ProfileSnapshot:
    viewer = await load_viewer(session, clerk_user_id)
    if viewer is None:
        raise ProblemError(
            status=409,
            slug="profile-incomplete",
            title="Profile incomplete",
            detail="Finish setting up your profile to act on matches.",
        )
    return viewer


async def owned_match(session: AsyncSession, viewer: ProfileSnapshot, match_id: UUID) -> Match:
    match: Match | None = await session.get(Match, match_id)
    if match is None:
        raise match_not_found()
    if match.from_profile_id != viewer.profile_id:
        raise ProblemError(
            status=403,
            slug="not-your-match",
            title="Not your match",
            detail="You can only act on your own matches.",
        )
    return match


def _pair(viewer: ProfileSnapshot, other_profile_id: UUID) -> tuple[UUID, UUID]:
    """(founder_profile_id, partner_profile_id) for the viewer and the other side of a match."""
    if viewer.kind == AppRole.FOUNDER:
        return viewer.profile_id, other_profile_id
    return other_profile_id, viewer.profile_id


async def _intro_for(
    session: AsyncSession, founder_profile_id: UUID, partner_profile_id: UUID
) -> IntroRequest | None:
    intro: IntroRequest | None = await session.scalar(
        select(IntroRequest).where(
            IntroRequest.founder_profile_id == founder_profile_id,
            IntroRequest.partner_profile_id == partner_profile_id,
        )
    )
    return intro


def match_state(match: Match, intro: IntroRequest | None) -> MatchState:
    return MatchState(
        saved_at=match.saved_at,
        rejected=match.rejected_at is not None,
        connection=ConnectionStatus(intro.status) if intro else ConnectionStatus.NONE,
        intro_id=intro.id if intro else None,
    )


async def states_for(
    session: AsyncSession, viewer: ProfileSnapshot, matches: Sequence[Match]
) -> dict[UUID, MatchState]:
    other_ids = [match.to_profile_id for match in matches]
    intros: dict[UUID, IntroRequest] = {}
    if other_ids and viewer.kind == AppRole.FOUNDER:
        for intro in await session.scalars(
            select(IntroRequest).where(
                IntroRequest.founder_profile_id == viewer.profile_id,
                IntroRequest.partner_profile_id.in_(other_ids),
            )
        ):
            intros[intro.partner_profile_id] = intro
    elif other_ids:
        for intro in await session.scalars(
            select(IntroRequest).where(
                IntroRequest.partner_profile_id == viewer.profile_id,
                IntroRequest.founder_profile_id.in_(other_ids),
            )
        ):
            intros[intro.founder_profile_id] = intro
    return {match.id: match_state(match, intros.get(match.to_profile_id)) for match in matches}


def _record(
    session: AsyncSession,
    match: Match,
    actor: ProfileSnapshot,
    action: str,
    *,
    reason: str | None = None,
    position: int | None = None,
) -> None:
    # Feedback events are the ranking training signal (PRD M9): every state change is kept.
    session.add(
        FeedbackEvent(
            match_id=match.id,
            actor_profile_id=actor.profile_id,
            target_profile_id=match.to_profile_id,
            action=action,
            reason=reason,
            fit_score=match.fit_score,
            position=position,
        )
    )
    logger.info(
        "match_action_taken action=%s reason=%s position=%s fit_score=%.3f",
        action,
        reason,
        position,
        match.fit_score,
    )


async def ensure_match_row(session: AsyncSession, mirror: Match, owner: ProfileSnapshot) -> Match:
    """Returns the owner's match row towards mirror.from_profile_id, copying the mirror's scores.

    Scoring is symmetric, so a founder's row and the investor's row carry the same features. This
    lets an investor open a founder's intro before their own matches were ever computed.
    """
    other_profile_id = mirror.from_profile_id
    query = select(Match).where(
        Match.from_profile_id == owner.profile_id, Match.to_profile_id == other_profile_id
    )
    existing: Match | None = await session.scalar(query)
    if existing is not None:
        return existing
    state = explanation_state(None, mirror.features, owner.kind)
    await session.execute(
        insert(Match)
        .values(
            from_profile_id=owner.profile_id,
            to_profile_id=other_profile_id,
            fit_score=mirror.fit_score,
            content_score=mirror.content_score,
            collab_score=mirror.collab_score,
            explanation=state.stored.model_dump(mode="json") if state else {},
            features=mirror.features,
        )
        .on_conflict_do_nothing(index_elements=[Match.from_profile_id, Match.to_profile_id])
    )
    created: Match | None = await session.scalar(query)
    if created is None:
        raise match_not_found()
    return created


def _notify_mutual(
    session: AsyncSession,
    *,
    founder: ProfileSnapshot,
    partner: ProfileSnapshot,
    founder_match: Match,
    partner_match: Match,
    founder_requested: bool,
) -> None:
    partner_name = display_name(partner)
    founder_name = display_name(founder)
    startup = founder.founder.startup_name if founder.founder is not None else None
    notify(
        session,
        user_id=founder.user_id,
        kind=NotificationKind.MUTUAL_MATCH,
        title=(
            f"{partner_name} accepted your intro request"
            if founder_requested
            else f"You're connected with {partner_name}"
        ),
        body="You're now a mutual match. Open the match to see their full profile.",
        action_label="View match",
        action_href=f"/matches/{founder_match.id}",
    )
    notify(
        session,
        user_id=partner.user_id,
        kind=NotificationKind.MUTUAL_MATCH,
        title=(
            f"You're connected with {founder_name} from {startup}"
            if startup and startup != founder_name
            else f"You're connected with {founder_name}"
        ),
        body="You're now a mutual match. Open the match to see their full profile.",
        action_label="View match",
        action_href=f"/matches/{partner_match.id}",
    )


async def _load_other(session: AsyncSession, profile_id: UUID) -> ProfileSnapshot:
    snapshot = (await load_by_ids(session, [profile_id])).get(profile_id)
    if snapshot is None or not snapshot.matchable:
        raise match_not_found()
    return snapshot


async def _partner_accept(
    session: AsyncSession,
    partner: ProfileSnapshot,
    match: Match,
    intro: IntroRequest | None,
    now: datetime,
) -> tuple[IntroRequest, bool]:
    match.rejected_at = None
    match.reject_reason = None
    founder = await _load_other(session, match.to_profile_id)
    founder_match = await ensure_match_row(session, match, founder)

    if intro is None:
        intro = IntroRequest(
            founder_profile_id=founder.profile_id,
            partner_profile_id=partner.profile_id,
            status=ConnectionStatus.INTERESTED.value,
        )
        session.add(intro)
        await session.flush()
        partner_role = ROLE_NOUNS[partner.kind]
        notify(
            session,
            user_id=founder.user_id,
            kind=NotificationKind.MATCH_INTEREST,
            title=f"{display_name(partner)} ({partner_role}) is interested in connecting",
            body="Send an intro request to start the conversation.",
            action_label="Request intro",
            action_href=f"/matches/{founder_match.id}",
        )
        return intro, True

    if intro.status in (ConnectionStatus.INTERESTED, ConnectionStatus.ACCEPTED):
        return intro, False

    founder_requested = intro.requested_at is not None
    intro.status = ConnectionStatus.ACCEPTED.value
    intro.responded_at = now
    _notify_mutual(
        session,
        founder=founder,
        partner=partner,
        founder_match=founder_match,
        partner_match=match,
        founder_requested=founder_requested,
    )
    _log_response(intro, "accept", now)
    return intro, True


def _log_response(intro: IntroRequest, action: str, now: datetime) -> None:
    hours = (now - intro.requested_at).total_seconds() / 3600 if intro.requested_at else 0.0
    logger.info(
        "intro_responded intro_id=%s action=%s response_time_hr=%.2f", intro.id, action, hours
    )


async def apply_match_action(
    session: AsyncSession, clerk_user_id: str, match_id: UUID, body: MatchActionRequest
) -> MatchActionResponse:
    viewer = await require_viewer(session, clerk_user_id)
    match = await owned_match(session, viewer, match_id)
    intro = await _intro_for(session, *_pair(viewer, match.to_profile_id))
    now = datetime.now(UTC)
    changed = False

    if body.action == "save":
        if match.saved_at is None:
            match.saved_at, match.rejected_at, match.reject_reason = now, None, None
            changed = True
    elif body.action == "unsave":
        if match.saved_at is not None:
            match.saved_at = None
            changed = True
    elif body.action == "reject":
        in_progress = intro is not None and (
            intro.status == ConnectionStatus.ACCEPTED
            or (viewer.kind == AppRole.FOUNDER and intro.status == ConnectionStatus.PENDING)
        )
        if in_progress:
            raise ProblemError(
                status=409,
                slug="connection-in-progress",
                title="Can't hide this match",
                detail="You already have an intro in progress with this match.",
            )
        if match.rejected_at is None:
            match.rejected_at, match.saved_at = now, None
            match.reject_reason = body.reason.value if body.reason else None
            changed = True
            # "Not a fit" from an investor/mentor also declines a pending intro from that founder.
            if (
                intro is not None
                and viewer.kind != AppRole.FOUNDER
                and intro.status
                in (
                    ConnectionStatus.PENDING,
                    ConnectionStatus.INTERESTED,
                )
            ):
                intro.status = ConnectionStatus.DECLINED.value
                intro.decline_reason = match.reject_reason
                intro.responded_at = now
    elif body.action == "restore":
        if match.rejected_at is not None:
            match.rejected_at, match.reject_reason = None, None
            changed = True
    else:
        if viewer.kind == AppRole.FOUNDER:
            raise ProblemError(
                status=409,
                slug="request-intro-instead",
                title="Request an intro instead",
                detail="Founders connect with investors and mentors by requesting an intro.",
            )
        intro, changed = await _partner_accept(session, viewer, match, intro, now)

    # Repeated clicks change nothing and log nothing (PRD M9: dedupe server-side).
    if changed:
        _record(
            session,
            match,
            viewer,
            body.action,
            reason=match.reject_reason if body.action == "reject" else None,
            position=body.position,
        )
        if body.action == "save":
            logger.info("match_saved match_id=%s", match.id)
    await session.commit()
    return MatchActionResponse(updated_match_state=match_state(match, intro))


async def request_intro(
    session: AsyncSession, clerk_user_id: str, match_id: UUID, body: IntroRequestBody
) -> IntroCreatedResponse:
    viewer = await require_viewer(session, clerk_user_id)
    founder = viewer.founder
    if founder is None:
        raise founders_only()
    match = await owned_match(session, viewer, match_id)
    intro = await _intro_for(session, viewer.profile_id, match.to_profile_id)
    if intro is not None and intro.status in (ConnectionStatus.PENDING, ConnectionStatus.ACCEPTED):
        return IntroCreatedResponse(intro_id=intro.id, status=ConnectionStatus(intro.status))
    if intro is not None and intro.status == ConnectionStatus.DECLINED:
        raise ProblemError(
            status=409,
            slug="intro-declined",
            title="Intro declined",
            detail="This intro request was declined, so it can't be sent again.",
        )

    partner = await _load_other(session, match.to_profile_id)
    partner_match = await ensure_match_row(session, match, partner)
    now = datetime.now(UTC)
    match.rejected_at, match.reject_reason = None, None

    if intro is None:
        intro = IntroRequest(
            founder_profile_id=viewer.profile_id,
            partner_profile_id=partner.profile_id,
            status=ConnectionStatus.PENDING.value,
            message=body.message,
            requested_at=now,
        )
        session.add(intro)
        await session.flush()
        notify(
            session,
            user_id=partner.user_id,
            kind=NotificationKind.INTRO_RECEIVED,
            title=f"{display_name(viewer)} from {founder.startup_name} requested an intro",
            body=(
                f"{round(match.fit_score * 100)}% fit · {founder.sector.value} · "
                f"{STAGE_LABELS[founder.stage.value]}"
            ),
            action_label="Review intro",
            action_href="/intros",
        )
    else:
        # The investor/mentor had already accepted this match: the intro makes it mutual.
        intro.status = ConnectionStatus.ACCEPTED.value
        intro.message = body.message
        intro.requested_at = now
        intro.responded_at = now
        _notify_mutual(
            session,
            founder=viewer,
            partner=partner,
            founder_match=match,
            partner_match=partner_match,
            founder_requested=False,
        )

    _record(session, match, viewer, "request_intro")
    logger.info("intro_requested match_id=%s message_length=%d", match.id, len(body.message))
    if body.original_draft:
        edit_ratio = 1 - SequenceMatcher(None, body.original_draft, body.message).ratio()
        logger.info("intro_draft_edited_before_send edit_ratio=%.3f", edit_ratio)
    await session.commit()
    return IntroCreatedResponse(intro_id=intro.id, status=ConnectionStatus(intro.status))


async def respond_intro(
    session: AsyncSession, clerk_user_id: str, intro_id: UUID, body: IntroRespondRequest
) -> IntroRespondResponse:
    viewer = await require_viewer(session, clerk_user_id)
    intro: IntroRequest | None = await session.get(IntroRequest, intro_id)
    not_found = ProblemError(
        status=404,
        slug="intro-not-found",
        title="Intro not found",
        detail="This intro request no longer exists.",
    )
    if intro is None:
        raise not_found
    if intro.partner_profile_id != viewer.profile_id:
        raise ProblemError(
            status=403,
            slug="not-your-intro",
            title="Not your intro",
            detail="You can only respond to intros sent to you.",
        )
    founder = (await load_by_ids(session, [intro.founder_profile_id])).get(intro.founder_profile_id)
    if founder is None or not founder.matchable:
        raise not_found

    founder_match: Match | None = await session.scalar(
        select(Match).where(
            Match.from_profile_id == founder.profile_id, Match.to_profile_id == viewer.profile_id
        )
    )
    partner_match: Match | None = await session.scalar(
        select(Match).where(
            Match.from_profile_id == viewer.profile_id, Match.to_profile_id == founder.profile_id
        )
    )
    if founder_match is None and partner_match is None:
        raise not_found
    if partner_match is None and founder_match is not None:
        partner_match = await ensure_match_row(session, founder_match, viewer)
    if founder_match is None and partner_match is not None:
        founder_match = await ensure_match_row(session, partner_match, founder)
    if founder_match is None or partner_match is None:
        raise not_found

    now = datetime.now(UTC)
    if body.action == "accept":
        if intro.status != ConnectionStatus.ACCEPTED:
            intro.status = ConnectionStatus.ACCEPTED.value
            intro.responded_at = now
            partner_match.rejected_at, partner_match.reject_reason = None, None
            _notify_mutual(
                session,
                founder=founder,
                partner=viewer,
                founder_match=founder_match,
                partner_match=partner_match,
                founder_requested=intro.requested_at is not None,
            )
            _record(session, partner_match, viewer, "accept_intro")
            _log_response(intro, "accept", now)
    else:
        if intro.status == ConnectionStatus.ACCEPTED:
            raise ProblemError(
                status=409,
                slug="already-connected",
                title="Already connected",
                detail="You're already a mutual match with this founder.",
            )
        if intro.status != ConnectionStatus.DECLINED:
            intro.status = ConnectionStatus.DECLINED.value
            intro.decline_reason = body.reason.value if body.reason else None
            intro.responded_at = now
            _record(session, partner_match, viewer, "decline_intro", reason=intro.decline_reason)
            _log_response(intro, "decline", now)
    await session.commit()
    return IntroRespondResponse(status=ConnectionStatus(intro.status), match_id=partner_match.id)


async def list_intro_queue(session: AsyncSession, clerk_user_id: str) -> list[IntroQueueItem]:
    viewer = await require_viewer(session, clerk_user_id)
    if viewer.kind == AppRole.FOUNDER:
        raise ProblemError(
            status=403,
            slug="partners-only",
            title="Investors and mentors only",
            detail="The intro queue is for investors and mentors.",
        )
    intros = (
        await session.scalars(
            select(IntroRequest)
            .where(
                IntroRequest.partner_profile_id == viewer.profile_id,
                IntroRequest.status == ConnectionStatus.PENDING,
            )
            .order_by(IntroRequest.requested_at)
        )
    ).all()
    if not intros:
        return []

    founder_ids = [intro.founder_profile_id for intro in intros]
    founders = await load_by_ids(session, founder_ids)
    own_rows = {
        row.to_profile_id: row
        for row in (
            await session.scalars(
                select(Match).where(
                    Match.from_profile_id == viewer.profile_id, Match.to_profile_id.in_(founder_ids)
                )
            )
        ).all()
    }
    missing = [profile_id for profile_id in founder_ids if profile_id not in own_rows]
    if missing:
        mirrors = (
            await session.scalars(
                select(Match).where(
                    Match.from_profile_id.in_(missing), Match.to_profile_id == viewer.profile_id
                )
            )
        ).all()
        for mirror in mirrors:
            own_rows[mirror.from_profile_id] = await ensure_match_row(session, mirror, viewer)
        await session.commit()

    items: list[IntroQueueItem] = []
    for intro in intros:
        founder = founders.get(intro.founder_profile_id)
        row = own_rows.get(intro.founder_profile_id)
        if founder is None or founder.founder is None or row is None:
            continue
        items.append(
            IntroQueueItem(
                intro_id=intro.id,
                match_id=row.id,
                founder=profile_card(founder),
                sector=founder.founder.sector.value,
                message=intro.message or "",
                fit_score=row.fit_score,
                requested_at=intro.requested_at or intro.created_at,
            )
        )
    items.sort(key=lambda item: (-item.fit_score, item.requested_at))
    return items
