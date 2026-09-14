import asyncio
import logging
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from time import perf_counter
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks
from pydantic import ValidationError
from sqlalchemy import and_, delete, exists, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_session_factory
from app.errors import ProblemError, UpstreamServiceError
from app.models.db import AppRole, IntroRequest, Match, PriorInvestment, Profile, User
from app.models.feedback import ConnectionStatus
from app.models.investor import PriorInvestmentItem
from app.models.matches import (
    ExplanationResponse,
    FeatureScore,
    FounderMatchDetails,
    InvestorMatchDetails,
    MatchDetailResponse,
    MatchExplanation,
    MatchItem,
    MentorMatchDetails,
    RecomputeResponse,
    SavedMatchItem,
    StoredExplanation,
)
from app.models.notifications import NotificationKind
from app.services import embeddings, vector_store
from app.services.badges import badges_for_profile
from app.services.clerk import ClerkIdentity, fetch_clerk_identity
from app.services.connections import (
    ROLE_NOUNS,
    display_name,
    states_for,
    viewer_unavailable_error,
)
from app.services.match_cards import profile_card
from app.services.match_explanations import (
    ExplanationError,
    ExplanationState,
    explanation_state,
    generate_llm_explanation,
)
from app.services.match_scoring import (
    ContentScore,
    investor_filter,
    mentor_filter,
    score_founder_investor,
    score_founder_mentor,
)
from app.services.meetings import upcoming_meeting
from app.services.notifications import notify
from app.services.profile_lookup import l1_text
from app.services.profile_snapshots import (
    ProfileSnapshot,
    document_text,
    load_by_ids,
    load_candidates,
    load_viewer,
)

logger = logging.getLogger(__name__)

MIN_VISIBLE_FIT = 0.5
MAX_VISIBLE_MATCHES = 8
MAX_SAVED_MATCHES = 50
COLD_START_FEEDBACK_EVENTS = 10
MAX_NAME_LOOKUPS = 25
EXPLANATION_CONCURRENCY = 4
# Bump when scoring features change so stored matches are recomputed on next view.
SCORING_VERSION = 2

# Match ids with an LLM explanation in flight in this process (avoids duplicate calls).
_explaining: set[UUID] = set()


def _unavailable() -> ProblemError:
    return ProblemError(
        status=503,
        slug="matching-unavailable",
        title="Matching unavailable",
        detail="Finding matches for you. Check back in a few minutes.",
    )


def unavailable_error() -> ProblemError:
    return _unavailable()


def _match_not_found() -> ProblemError:
    return ProblemError(
        status=404,
        slug="match-not-found",
        title="This profile is private",
        detail="Profiles are only visible to people who have been matched with each other.",
    )


def ranking_alpha(feedback_events: int) -> float:
    return 1.0 if feedback_events < COLD_START_FEEDBACK_EVENTS else 0.7


def _score_pair(
    viewer: ProfileSnapshot, candidate: ProfileSnapshot, similarity: float | None
) -> ContentScore | None:
    founder_side, partner = (
        (viewer, candidate) if viewer.kind == AppRole.FOUNDER else (candidate, viewer)
    )
    founder = founder_side.founder
    if founder is None:
        return None
    if partner.thesis is not None:
        if not investor_filter(founder, partner.thesis):
            return None
        return score_founder_investor(founder, partner.thesis, partner.deals, similarity)
    if partner.expertise is not None:
        if not mentor_filter(founder, partner.expertise):
            return None
        return score_founder_mentor(founder, partner.expertise, similarity)
    return None


async def _viewer_or_error(session: AsyncSession, clerk_user_id: str) -> ProfileSnapshot:
    viewer = await load_viewer(session, clerk_user_id)
    if viewer is None:
        raise await viewer_unavailable_error(session, clerk_user_id)
    return viewer


async def _ensure_display_names(session: AsyncSession, snapshots: list[ProfileSnapshot]) -> None:
    missing = [snapshot for snapshot in snapshots if not snapshot.display_name][:MAX_NAME_LOOKUPS]
    if not missing:
        return
    limiter = asyncio.Semaphore(5)

    async def lookup(snapshot: ProfileSnapshot) -> tuple[ProfileSnapshot, ClerkIdentity | None]:
        async with limiter:
            try:
                return snapshot, await fetch_clerk_identity(snapshot.clerk_id)
            except UpstreamServiceError:
                return snapshot, None

    for snapshot, identity in await asyncio.gather(*(lookup(item) for item in missing)):
        if identity is not None and identity.display_name:
            snapshot.display_name = identity.display_name
            await session.execute(
                update(User)
                .where(User.id == snapshot.user_id)
                .values(display_name=identity.display_name)
            )


async def _semantic_similarities(
    viewer: ProfileSnapshot, candidates: list[ProfileSnapshot]
) -> dict[UUID, float] | None:
    """None means the vector store or model is unavailable: rank on structured features only."""
    snapshots = [viewer, *candidates]
    try:
        versions = await vector_store.embedded_versions([item.profile_id for item in snapshots])
        stale = [item for item in snapshots if versions.get(item.profile_id) != item.embedding_v]
        if stale:
            vectors = await embeddings.embed_texts([document_text(item) for item in stale])
            await vector_store.upsert_vectors(
                [
                    (
                        item.profile_id,
                        vector,
                        {"kind": item.kind.value, "embedding_v": item.embedding_v},
                    )
                    for item, vector in zip(stale, vectors, strict=True)
                ]
            )
        return await vector_store.similarities(
            viewer.profile_id, [item.profile_id for item in candidates]
        )
    except Exception:  # any Qdrant or model failure degrades to structured-only scoring
        logger.warning("Semantic similarity unavailable; ranking without it", exc_info=True)
        return None


async def _notify_new_matches(
    session: AsyncSession,
    viewer: ProfileSnapshot,
    new_matches: list[tuple[UUID, ProfileSnapshot, float]],
) -> None:
    if not new_matches:
        return
    if len(new_matches) == 1:
        match_id, candidate, fit_score = new_matches[0]
        await notify(
            session,
            user_id=viewer.user_id,
            kind=NotificationKind.NEW_MATCH,
            title=(
                f"New match: {display_name(candidate)} ({ROLE_NOUNS[candidate.kind]}) · "
                f"{round(fit_score * 100)}% fit"
            ),
            action_label="View match",
            action_href=f"/matches/{match_id}",
        )
        return
    await notify(
        session,
        user_id=viewer.user_id,
        kind=NotificationKind.NEW_MATCHES,
        title=f"{len(new_matches)} new matches",
        body="Ranked by fit, each with a reason.",
        action_label="Browse matches",
        action_href="/matches",
    )


async def compute_matches(session: AsyncSession, clerk_user_id: str) -> RecomputeResponse:
    started = perf_counter()
    viewer = await _viewer_or_error(session, clerk_user_id)
    had_previous_run = isinstance(viewer.l1_data.get("matching"), dict)
    kinds = (
        [AppRole.INVESTOR, AppRole.MENTOR] if viewer.kind == AppRole.FOUNDER else [AppRole.FOUNDER]
    )
    candidates = [
        candidate
        for candidate in await load_candidates(session, kinds, viewer.user_id)
        if _score_pair(viewer, candidate, None) is not None
    ]
    await _ensure_display_names(session, [viewer, *candidates])
    similarities = await _semantic_similarities(viewer, candidates) if candidates else {}
    existing_explanations: dict[UUID, dict[str, Any]] = {
        row.to_profile_id: row.explanation
        for row in await session.execute(
            select(Match.to_profile_id, Match.explanation).where(
                Match.from_profile_id == viewer.profile_id
            )
        )
    }

    # Feedback events are recorded since M9, but the collaborative model that turns them into
    # collab_score isn't trained yet, so ranking stays content-only (alpha = 1.0).
    alpha = ranking_alpha(feedback_events=0)
    collab_score = 0.0
    rows: list[dict[str, Any]] = []
    for candidate in candidates:
        similarity = similarities.get(candidate.profile_id) if similarities is not None else None
        content = _score_pair(viewer, candidate, similarity)
        if content is None:
            continue
        features = content.breakdown()
        # Keeps a cached (LLM) explanation while the signals are unchanged; otherwise a template.
        state = explanation_state(
            existing_explanations.get(candidate.profile_id), features, viewer.kind
        )
        if state is None:
            continue
        rows.append(
            {
                "from_profile_id": viewer.profile_id,
                "to_profile_id": candidate.profile_id,
                "fit_score": round(alpha * content.score + (1 - alpha) * collab_score, 4),
                "content_score": content.score,
                "collab_score": collab_score,
                "explanation": state.stored.model_dump(mode="json"),
                "features": features,
            }
        )

    current_ids = [row["to_profile_id"] for row in rows]
    # Saved, hidden, or connected matches survive a refresh even if the candidate no longer fits.
    has_intro = exists().where(
        or_(
            and_(
                IntroRequest.founder_profile_id == Match.from_profile_id,
                IntroRequest.partner_profile_id == Match.to_profile_id,
            ),
            and_(
                IntroRequest.founder_profile_id == Match.to_profile_id,
                IntroRequest.partner_profile_id == Match.from_profile_id,
            ),
        )
    )
    await session.execute(
        delete(Match).where(
            Match.from_profile_id == viewer.profile_id,
            Match.to_profile_id.not_in(current_ids),
            Match.saved_at.is_(None),
            Match.rejected_at.is_(None),
            ~has_intro,
        )
    )
    if rows:
        statement = insert(Match).values(rows)
        upserted = await session.execute(
            statement.on_conflict_do_update(
                index_elements=[Match.from_profile_id, Match.to_profile_id],
                set_={
                    "fit_score": statement.excluded.fit_score,
                    "content_score": statement.excluded.content_score,
                    "collab_score": statement.excluded.collab_score,
                    "explanation": statement.excluded.explanation,
                    "features": statement.excluded.features,
                },
            ).returning(Match.id, Match.to_profile_id, Match.fit_score)
        )
        if had_previous_run:
            by_id = {candidate.profile_id: candidate for candidate in candidates}
            await _notify_new_matches(
                session,
                viewer,
                [
                    (row.id, by_id[row.to_profile_id], row.fit_score)
                    for row in upserted.all()
                    if row.to_profile_id not in existing_explanations
                    and row.fit_score >= MIN_VISIBLE_FIT
                    and row.to_profile_id in by_id
                ],
            )

    profile = await session.get(Profile, viewer.profile_id)
    if profile is not None:
        profile.l1_data = {
            **profile.l1_data,
            "matching": {
                "computed_at": datetime.now(UTC).isoformat(),
                "embedding_v": viewer.embedding_v,
                "scoring_v": SCORING_VERSION,
                "candidates": len(rows),
                "semantic": similarities is not None,
            },
        }
    await session.commit()
    logger.info(
        "match_computation_completed candidate_count=%d duration_ms=%d semantic=%s",
        len(rows),
        (perf_counter() - started) * 1000,
        similarities is not None,
    )
    return RecomputeResponse(count=len(rows))


def can_match(viewer: ProfileSnapshot, candidate: ProfileSnapshot) -> bool:
    """Whether the pair passes the basic filters (sector overlap, or stage overlap for mentors)."""
    return _score_pair(viewer, candidate, None) is not None


async def ensure_pair_match(
    session: AsyncSession, viewer: ProfileSnapshot, candidate: ProfileSnapshot
) -> UUID | None:
    """S2 "Request match": stores match rows for both sides of one pair, whatever the fit.

    Returns the viewer's match id, or None when the pair fails the basic filters. The other side is
    notified, since the viewer can now see their profile (and they can see the viewer's).
    """
    existing: UUID | None = await session.scalar(
        select(Match.id).where(
            Match.from_profile_id == viewer.profile_id, Match.to_profile_id == candidate.profile_id
        )
    )
    if existing is not None:
        return existing
    similarities = await _semantic_similarities(viewer, [candidate])
    similarity = similarities.get(candidate.profile_id) if similarities is not None else None
    content = _score_pair(viewer, candidate, similarity)
    if content is None:
        return None
    features = content.breakdown()
    rows: list[dict[str, Any]] = []
    for source, target in ((viewer, candidate), (candidate, viewer)):
        state = explanation_state(None, features, source.kind)
        if state is None:
            return None
        rows.append(
            {
                "from_profile_id": source.profile_id,
                "to_profile_id": target.profile_id,
                "fit_score": content.score,
                "content_score": content.score,
                "collab_score": 0.0,
                "explanation": state.stored.model_dump(mode="json"),
                "features": features,
            }
        )
    await session.execute(
        insert(Match)
        .values(rows)
        .on_conflict_do_nothing(index_elements=[Match.from_profile_id, Match.to_profile_id])
    )
    ids = dict(
        (
            await session.execute(
                select(Match.from_profile_id, Match.id).where(
                    or_(
                        and_(
                            Match.from_profile_id == viewer.profile_id,
                            Match.to_profile_id == candidate.profile_id,
                        ),
                        and_(
                            Match.from_profile_id == candidate.profile_id,
                            Match.to_profile_id == viewer.profile_id,
                        ),
                    )
                )
            )
        )
        .tuples()
        .all()
    )
    candidate_match = ids.get(candidate.profile_id)
    if candidate_match is not None:
        await notify(
            session,
            user_id=candidate.user_id,
            kind=NotificationKind.NEW_MATCH,
            title=(
                f"New match: {display_name(viewer)} ({ROLE_NOUNS[viewer.kind]}) · "
                f"{round(content.score * 100)}% fit"
            ),
            body="They found you through search.",
            action_label="View match",
            action_href=f"/matches/{candidate_match}",
        )
    await session.commit()
    return ids.get(viewer.profile_id)


async def _refresh_explanations(
    session: AsyncSession, viewer: ProfileSnapshot, matches: Sequence[Match]
) -> dict[UUID, StoredExplanation]:
    """Generates LLM explanations where the stored one is a template; failures keep the template."""
    targets: list[tuple[Match, ExplanationState]] = []
    for match in matches:
        state = explanation_state(match.explanation, match.features, viewer.kind)
        if state is not None and state.needs_llm and match.id not in _explaining:
            targets.append((match, state))
    if not targets:
        return {}

    for match, _ in targets:
        _explaining.add(match.id)
    results: dict[UUID, StoredExplanation] = {}
    try:
        snapshots = await load_by_ids(session, [match.to_profile_id for match, _ in targets])
        limiter = asyncio.Semaphore(EXPLANATION_CONCURRENCY)

        async def explain(match: Match, state: ExplanationState) -> None:
            candidate = snapshots.get(match.to_profile_id)
            if candidate is None:
                return
            started = perf_counter()
            async with limiter:
                try:
                    result = await generate_llm_explanation(viewer, candidate, state)
                except ExplanationError as exc:
                    logger.warning("LLM explanation failed for match %s: %s", match.id, exc)
                    result = state.stored.model_copy(update={"llm_failed_at": datetime.now(UTC)})
            match.explanation = result.model_dump(mode="json")
            results[match.id] = result
            # Analytics event (PRD M8) until the analytics pipeline is wired in Week 6.
            logger.info(
                "explanation_generated match_id=%s source=%s duration_ms=%d",
                match.id,
                result.source,
                (perf_counter() - started) * 1000,
            )

        await asyncio.gather(*(explain(match, state) for match, state in targets))
        await session.commit()
    finally:
        for match, _ in targets:
            _explaining.discard(match.id)
    return results


async def _visible_matches(
    session: AsyncSession, viewer: ProfileSnapshot, limit: int
) -> Sequence[Match]:
    return (
        await session.scalars(
            select(Match)
            .where(
                Match.from_profile_id == viewer.profile_id,
                Match.fit_score >= MIN_VISIBLE_FIT,
                Match.rejected_at.is_(None),
            )
            .order_by(Match.fit_score.desc())
            .limit(limit)
        )
    ).all()


async def explain_in_background(clerk_user_id: str, match_ids: list[UUID] | None = None) -> None:
    try:
        async with get_session_factory()() as session:
            viewer = await load_viewer(session, clerk_user_id)
            if viewer is None:
                return
            if match_ids is None:
                matches = await _visible_matches(session, viewer, MAX_VISIBLE_MATCHES)
            else:
                matches = (
                    await session.scalars(
                        select(Match).where(
                            Match.id.in_(match_ids), Match.from_profile_id == viewer.profile_id
                        )
                    )
                ).all()
            await _refresh_explanations(session, viewer, matches)
    except Exception:  # background work must never crash the worker
        logger.exception("Background explanation generation failed")


async def recompute_in_background(clerk_user_id: str) -> None:
    try:
        async with get_session_factory()() as session:
            await compute_matches(session, clerk_user_id)
    except Exception:  # background refresh must never crash the worker
        logger.exception("Background match recompute failed")
        return
    await explain_in_background(clerk_user_id)


def _needs_recompute(viewer: ProfileSnapshot) -> bool:
    meta = viewer.l1_data.get("matching")
    if not isinstance(meta, dict) or meta.get("embedding_v") != viewer.embedding_v:
        return True
    if meta.get("scoring_v") != SCORING_VERSION:
        return True
    try:
        computed_at = datetime.fromisoformat(str(meta.get("computed_at")))
    except ValueError:
        return True
    return datetime.now(UTC) - computed_at > timedelta(hours=get_settings().match_refresh_hours)


async def _ensure_fresh(
    session: AsyncSession, viewer: ProfileSnapshot, clerk_user_id: str, background: BackgroundTasks
) -> None:
    if not _needs_recompute(viewer):
        return
    has_matches = (
        await session.scalar(
            select(Match.id).where(Match.from_profile_id == viewer.profile_id).limit(1)
        )
        is not None
    )
    if has_matches:
        background.add_task(recompute_in_background, clerk_user_id)
        return
    try:
        await compute_matches(session, clerk_user_id)
    except ProblemError:
        raise
    except Exception as exc:
        logger.exception("On-demand match computation failed")
        raise _unavailable() from exc


async def _match_items(
    session: AsyncSession,
    viewer: ProfileSnapshot,
    matches: Sequence[Match],
    clerk_user_id: str,
    background: BackgroundTasks,
) -> list[tuple[Match, MatchItem]]:
    snapshots = await load_by_ids(session, [match.to_profile_id for match in matches])
    states = await states_for(session, viewer, matches)
    items: list[tuple[Match, MatchItem]] = []
    pending: list[UUID] = []
    for match in matches:
        candidate = snapshots.get(match.to_profile_id)
        explanation = explanation_state(match.explanation, match.features, viewer.kind)
        if candidate is None or not candidate.matchable or explanation is None:
            continue
        if explanation.needs_llm and match.id not in _explaining:
            pending.append(match.id)
        items.append(
            (
                match,
                MatchItem(
                    match_id=match.id,
                    to_profile=profile_card(candidate),
                    fit_score=match.fit_score,
                    content_score=match.content_score,
                    collab_score=match.collab_score,
                    explanation=MatchExplanation(
                        source=explanation.stored.source,
                        short=explanation.stored.short,
                        features_used=explanation.stored.features_used,
                    ),
                    state=states[match.id],
                ),
            )
        )
    # Cards show the template sentence now; LLM explanations replace it on the next view (M8 AC4).
    if pending:
        background.add_task(explain_in_background, clerk_user_id, pending)
    return items


async def list_matches(
    session: AsyncSession, clerk_user_id: str, limit: int, background: BackgroundTasks
) -> list[MatchItem]:
    viewer = await _viewer_or_error(session, clerk_user_id)
    await _ensure_fresh(session, viewer, clerk_user_id, background)
    matches = await _visible_matches(session, viewer, limit)
    return [
        item for _, item in await _match_items(session, viewer, matches, clerk_user_id, background)
    ]


async def list_saved_matches(
    session: AsyncSession, clerk_user_id: str, background: BackgroundTasks
) -> list[SavedMatchItem]:
    viewer = await _viewer_or_error(session, clerk_user_id)
    matches = (
        await session.scalars(
            select(Match)
            .where(
                Match.from_profile_id == viewer.profile_id,
                Match.saved_at.is_not(None),
                Match.rejected_at.is_(None),
            )
            .order_by(Match.saved_at.desc())
            .limit(MAX_SAVED_MATCHES)
        )
    ).all()
    return [
        SavedMatchItem.model_validate({**item.model_dump(), "saved_at": match.saved_at})
        for match, item in await _match_items(session, viewer, matches, clerk_user_id, background)
        if match.saved_at is not None
    ]


async def _owned_match(
    session: AsyncSession, clerk_user_id: str, match_id: UUID
) -> tuple[ProfileSnapshot, Match, ProfileSnapshot]:
    """Match Detail is visible only through the viewer's own match row (M10 AC7)."""
    viewer = await load_viewer(session, clerk_user_id)
    if viewer is None:
        raise _match_not_found()
    if _needs_recompute(viewer):
        await compute_matches(session, clerk_user_id)
    match: Match | None = await session.scalar(
        select(Match).where(Match.id == match_id, Match.from_profile_id == viewer.profile_id)
    )
    if match is None:
        raise _match_not_found()
    candidate = (await load_by_ids(session, [match.to_profile_id])).get(match.to_profile_id)
    if candidate is None or not candidate.matchable:
        raise _match_not_found()
    return viewer, match, candidate


async def _prior_investments(
    session: AsyncSession, candidate: ProfileSnapshot, hidden: bool
) -> list[PriorInvestmentItem]:
    items: list[PriorInvestmentItem] = []
    for row in await session.scalars(
        select(PriorInvestment)
        .where(PriorInvestment.profile_id == candidate.profile_id)
        .order_by(PriorInvestment.year.desc(), PriorInvestment.created_at)
    ):
        try:
            items.append(
                PriorInvestmentItem(
                    company=row.company_name,
                    sector=row.sector,
                    stage=row.stage,
                    cheque=None if hidden else row.cheque_inr,
                    year=row.year,
                    source=row.source,
                )
            )
        except ValidationError:
            logger.warning("Skipping invalid prior investment row %s", row.id)
    return items


async def get_match_detail(
    session: AsyncSession, clerk_user_id: str, match_id: UUID
) -> MatchDetailResponse:
    viewer, match, candidate = await _owned_match(session, clerk_user_id, match_id)
    details: FounderMatchDetails | InvestorMatchDetails | MentorMatchDetails
    if candidate.founder is not None:
        details = FounderMatchDetails(
            l1=candidate.founder, website=l1_text(candidate.l1_data, "website")
        )
    elif candidate.thesis is not None:
        hidden = bool(candidate.l1_data.get("hide_cheque_amounts", True))
        details = InvestorMatchDetails(
            thesis=candidate.thesis,
            prior_investments=await _prior_investments(session, candidate, hidden),
            cheques_hidden=hidden,
        )
    elif candidate.expertise is not None:
        details = MentorMatchDetails(expertise=candidate.expertise)
    else:
        raise _match_not_found()

    profile = await session.get(Profile, candidate.profile_id)
    if profile is None:
        raise _match_not_found()
    state = explanation_state(match.explanation, match.features, viewer.kind)
    scoring = (
        [
            FeatureScore(
                feature=name, label=feature.label, score=feature.score, weight=feature.weight
            )
            for name, feature in state.features.items()
        ]
        if state is not None
        else []
    )
    states = await states_for(session, viewer, [match])
    return MatchDetailResponse(
        match_id=match.id,
        fit_score=match.fit_score,
        content_score=match.content_score,
        collab_score=match.collab_score,
        updated_at=match.updated_at,
        to_profile=profile_card(candidate),
        details=details,
        scoring=scoring,
        badges=await badges_for_profile(session, profile),
        state=states[match.id],
        upcoming_meeting=(
            await upcoming_meeting(session, viewer, match)
            if states[match.id].connection == ConnectionStatus.ACCEPTED
            else None
        ),
    )


async def get_match_explanation(
    session: AsyncSession, clerk_user_id: str, match_id: UUID
) -> ExplanationResponse:
    viewer, match, _ = await _owned_match(session, clerk_user_id, match_id)
    state = explanation_state(match.explanation, match.features, viewer.kind)
    if state is None:
        raise _unavailable()
    stored = state.stored
    if state.needs_llm:
        # Generated inline on first open; a timeout or error falls back to the template (M8 AC4).
        stored = (await _refresh_explanations(session, viewer, [match])).get(match.id, stored)
    return ExplanationResponse(
        match_id=match.id,
        source=stored.source,
        short=stored.short,
        full=stored.full,
        features_used=stored.features_used,
        citations=stored.citations,
        generated_at=stored.generated_at,
    )
