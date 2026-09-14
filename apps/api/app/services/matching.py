import asyncio
import logging
from datetime import UTC, datetime, timedelta
from time import perf_counter
from typing import Any
from uuid import UUID

from fastapi import BackgroundTasks
from pydantic import ValidationError
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_session_factory
from app.errors import ProblemError, UpstreamServiceError
from app.models.db import AppRole, Match, Profile, User
from app.models.matches import MatchExplanation, MatchItem, MatchProfileCard, RecomputeResponse
from app.models.taxonomy import AVAILABILITY_LABELS, GEOGRAPHY_LABELS, STAGE_LABELS
from app.services import embeddings, vector_store
from app.services.clerk import ClerkIdentity, fetch_clerk_identity
from app.services.match_scoring import (
    ContentScore,
    format_inr,
    investor_filter,
    mentor_filter,
    score_founder_investor,
    score_founder_mentor,
)
from app.services.profile_snapshots import (
    ProfileSnapshot,
    document_text,
    load_by_ids,
    load_candidates,
    load_viewer,
)

logger = logging.getLogger(__name__)

MIN_VISIBLE_FIT = 0.5
COLD_START_FEEDBACK_EVENTS = 10
MAX_NAME_LOOKUPS = 25


def _unavailable() -> ProblemError:
    return ProblemError(
        status=503,
        slug="matching-unavailable",
        title="Matching unavailable",
        detail="Finding matches for you. Check back in a few minutes.",
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
        return score_founder_investor(founder, partner.thesis, similarity)
    if partner.expertise is not None:
        if not mentor_filter(founder, partner.expertise):
            return None
        return score_founder_mentor(founder, partner.expertise, similarity)
    return None


async def _viewer_or_error(session: AsyncSession, clerk_user_id: str) -> ProfileSnapshot:
    viewer = await load_viewer(session, clerk_user_id)
    if viewer is None:
        raise ProblemError(
            status=409,
            slug="profile-incomplete",
            title="Profile incomplete",
            detail="Finish setting up your profile to see matches.",
        )
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


async def compute_matches(session: AsyncSession, clerk_user_id: str) -> RecomputeResponse:
    started = perf_counter()
    viewer = await _viewer_or_error(session, clerk_user_id)
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

    # Feedback events (M9) don't exist yet, so every viewer is cold-start: alpha = 1.0.
    alpha = ranking_alpha(feedback_events=0)
    collab_score = 0.0
    rows: list[dict[str, Any]] = []
    for candidate in candidates:
        similarity = similarities.get(candidate.profile_id) if similarities is not None else None
        content = _score_pair(viewer, candidate, similarity)
        if content is None:
            continue
        rows.append(
            {
                "from_profile_id": viewer.profile_id,
                "to_profile_id": candidate.profile_id,
                "fit_score": round(alpha * content.score + (1 - alpha) * collab_score, 4),
                "content_score": content.score,
                "collab_score": collab_score,
                "explanation": content.template_explanation(),
                "features": content.breakdown(),
            }
        )

    current_ids = [row["to_profile_id"] for row in rows]
    await session.execute(
        delete(Match).where(
            Match.from_profile_id == viewer.profile_id, Match.to_profile_id.not_in(current_ids)
        )
    )
    if rows:
        statement = insert(Match).values(rows)
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=[Match.from_profile_id, Match.to_profile_id],
                set_={
                    "fit_score": statement.excluded.fit_score,
                    "content_score": statement.excluded.content_score,
                    "collab_score": statement.excluded.collab_score,
                    "explanation": statement.excluded.explanation,
                    "features": statement.excluded.features,
                },
            )
        )

    profile = await session.get(Profile, viewer.profile_id)
    if profile is not None:
        profile.l1_data = {
            **profile.l1_data,
            "matching": {
                "computed_at": datetime.now(UTC).isoformat(),
                "embedding_v": viewer.embedding_v,
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


async def recompute_in_background(clerk_user_id: str) -> None:
    try:
        async with get_session_factory()() as session:
            await compute_matches(session, clerk_user_id)
    except Exception:  # background refresh must never crash the worker
        logger.exception("Background match recompute failed")


def _needs_recompute(viewer: ProfileSnapshot) -> bool:
    meta = viewer.l1_data.get("matching")
    if not isinstance(meta, dict) or meta.get("embedding_v") != viewer.embedding_v:
        return True
    try:
        computed_at = datetime.fromisoformat(str(meta.get("computed_at")))
    except ValueError:
        return True
    return datetime.now(UTC) - computed_at > timedelta(hours=get_settings().match_refresh_hours)


def _card(snapshot: ProfileSnapshot) -> MatchProfileCard:
    if snapshot.founder is not None:
        founder = snapshot.founder
        stage = STAGE_LABELS[founder.stage.value]
        return MatchProfileCard(
            profile_id=snapshot.profile_id,
            kind="founder",
            display_name=snapshot.display_name or founder.startup_name,
            headline=f"{founder.startup_name} · {founder.sector.value} · {stage}",
            location=founder.city,
            bio=snapshot.bio or founder.description,
            facts=[
                f"Raising {format_inr(founder.ask_amount_inr)}",
                founder.business_model.value,
                f"Team of {founder.team_size}",
            ],
        )
    if snapshot.thesis is not None:
        thesis = snapshot.thesis
        facts = [", ".join(STAGE_LABELS[stage.value] for stage in thesis.stages)]
        if thesis.cheque_min is not None and thesis.cheque_max is not None:
            low, high = format_inr(thesis.cheque_min), format_inr(thesis.cheque_max)
            facts.insert(0, f"{low} to {high} cheque")
        return MatchProfileCard(
            profile_id=snapshot.profile_id,
            kind="investor",
            display_name=snapshot.display_name or "Investor",
            headline=f"Investor · {' & '.join(sector.value for sector in thesis.sectors[:2])}",
            location=", ".join(GEOGRAPHY_LABELS[geo] for geo in thesis.geographies[:3]),
            bio=snapshot.bio,
            facts=facts,
        )
    expertise = snapshot.expertise
    areas = expertise.areas if expertise is not None else []
    return MatchProfileCard(
        profile_id=snapshot.profile_id,
        kind="mentor",
        display_name=snapshot.display_name or "Mentor",
        headline=f"Mentor · {' & '.join(area.value for area in areas[:2])}",
        location=None,
        bio=snapshot.bio,
        facts=(
            [
                AVAILABILITY_LABELS[expertise.availability],
                f"{format_inr(expertise.session_fee)} / session"
                if expertise.session_fee
                else "Free sessions",
            ]
            if expertise is not None
            else []
        ),
    )


def _explanation(raw: dict[str, Any]) -> MatchExplanation:
    try:
        return MatchExplanation.model_validate(raw)
    except ValidationError:
        return MatchExplanation(
            source="template", short="Matched on your stated criteria", features_used=[]
        )


async def list_matches(
    session: AsyncSession, clerk_user_id: str, limit: int, background: BackgroundTasks
) -> list[MatchItem]:
    viewer = await _viewer_or_error(session, clerk_user_id)
    if _needs_recompute(viewer):
        has_matches = (
            await session.scalar(
                select(Match.id).where(Match.from_profile_id == viewer.profile_id).limit(1)
            )
            is not None
        )
        if has_matches:
            background.add_task(recompute_in_background, clerk_user_id)
        else:
            try:
                await compute_matches(session, clerk_user_id)
            except ProblemError:
                raise
            except Exception as exc:
                logger.exception("On-demand match computation failed")
                raise _unavailable() from exc

    matches = (
        await session.scalars(
            select(Match)
            .where(Match.from_profile_id == viewer.profile_id, Match.fit_score >= MIN_VISIBLE_FIT)
            .order_by(Match.fit_score.desc())
            .limit(limit)
        )
    ).all()
    snapshots = await load_by_ids(session, [match.to_profile_id for match in matches])
    return [
        MatchItem(
            match_id=match.id,
            to_profile=_card(snapshots[match.to_profile_id]),
            fit_score=match.fit_score,
            content_score=match.content_score,
            collab_score=match.collab_score,
            explanation=_explanation(match.explanation),
        )
        for match in matches
        if match.to_profile_id in snapshots and snapshots[match.to_profile_id].matchable
    ]


def unavailable_error() -> ProblemError:
    return _unavailable()
