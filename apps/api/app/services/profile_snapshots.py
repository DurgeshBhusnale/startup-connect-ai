from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import (
    AppRole,
    InvestorThesis,
    MentorExpertise,
    Post,
    PriorInvestment,
    Profile,
    TrustScore,
    User,
)
from app.models.founder import FounderL1Data
from app.models.investor import ThesisData
from app.models.matches import TrustSummary
from app.models.mentor import MentorExpertiseData
from app.models.taxonomy import GEOGRAPHY_LABELS, STAGE_LABELS
from app.services.founder_profile import saved_founder_l1
from app.services.match_scoring import PriorDeal
from app.services.mentor_profile import expertise_data
from app.services.profile_lookup import l1_text


@dataclass
class ProfileSnapshot:
    profile_id: UUID
    user_id: UUID
    clerk_id: str
    kind: AppRole
    display_name: str | None
    embedding_v: int
    l1_data: dict[str, Any]
    founder: FounderL1Data | None = None
    thesis: ThesisData | None = None
    expertise: MentorExpertiseData | None = None
    deals: list[PriorDeal] = field(default_factory=list)
    recent_posts: list[str] = field(default_factory=list)
    ask_pin: str | None = None
    # S7 badge from the nightly recompute; None for new users (< 10 interactions).
    trust: TrustSummary | None = None

    @property
    def bio(self) -> str | None:
        return l1_text(self.l1_data, "bio")

    @property
    def matchable(self) -> bool:
        if self.kind == AppRole.FOUNDER:
            return self.founder is not None
        if self.kind == AppRole.INVESTOR:
            return self.thesis is not None
        return self.expertise is not None


RECENT_POSTS_IN_EMBEDDING = 5


def _post_text(post: Post) -> str:
    milestone = post.milestone or {}
    if post.kind == "milestone" and milestone:
        kind = milestone.get("type", "other")
        description = milestone.get("description") or ""
        return f"{kind} milestone: {milestone.get('value', '')}. {description}"
    return post.body


async def _build(session: AsyncSession, rows: list[tuple[Profile, User]]) -> list[ProfileSnapshot]:
    if not rows:
        return []
    # Only query role tables for kinds present: each round trip to the pooler is costly.
    investor_ids = [profile.id for profile, _ in rows if profile.kind == AppRole.INVESTOR]
    mentor_ids = [profile.id for profile, _ in rows if profile.kind == AppRole.MENTOR]
    theses: dict[UUID, InvestorThesis] = {}
    deals: dict[UUID, list[PriorDeal]] = {}
    if investor_ids:
        theses = {
            thesis.profile_id: thesis
            for thesis in await session.scalars(
                select(InvestorThesis).where(InvestorThesis.profile_id.in_(investor_ids))
            )
        }
        for deal in await session.scalars(
            select(PriorInvestment)
            .where(PriorInvestment.profile_id.in_(investor_ids))
            .order_by(PriorInvestment.year.desc())
        ):
            deals.setdefault(deal.profile_id, []).append(
                PriorDeal(company=deal.company_name, sector=deal.sector, stage=deal.stage)
            )
    expertise_rows: dict[UUID, MentorExpertise] = {}
    if mentor_ids:
        expertise_rows = {
            row.profile_id: row
            for row in await session.scalars(
                select(MentorExpertise).where(MentorExpertise.profile_id.in_(mentor_ids))
            )
        }

    founder_ids = [profile.id for profile, _ in rows if profile.kind == AppRole.FOUNDER]
    post_texts: dict[UUID, list[str]] = {}
    if founder_ids:
        for post in await session.scalars(
            select(Post)
            .where(Post.profile_id.in_(founder_ids), Post.deleted_at.is_(None))
            .order_by(Post.created_at.desc())
        ):
            texts = post_texts.setdefault(post.profile_id, [])
            if len(texts) < RECENT_POSTS_IN_EMBEDDING:
                texts.append(_post_text(post))

    trust: dict[UUID, TrustSummary] = {
        row.profile_id: TrustSummary.model_validate({"badge": row.badge, "message": row.message})
        for row in await session.scalars(
            select(TrustScore).where(
                TrustScore.profile_id.in_([profile.id for profile, _ in rows]),
                TrustScore.badge.is_not(None),
            )
        )
    }

    snapshots: list[ProfileSnapshot] = []
    for profile, user in rows:
        snapshot = ProfileSnapshot(
            profile_id=profile.id,
            user_id=user.id,
            clerk_id=user.clerk_id,
            kind=profile.kind,
            display_name=user.display_name,
            embedding_v=profile.embedding_v,
            l1_data=profile.l1_data,
            deals=deals.get(profile.id, []),
            recent_posts=post_texts.get(profile.id, []),
            ask_pin=profile.ask_pin,
            trust=trust.get(profile.id),
        )
        if profile.kind == AppRole.FOUNDER:
            snapshot.founder = saved_founder_l1(profile.l1_data)
        elif profile.kind == AppRole.INVESTOR and profile.id in theses:
            try:
                snapshot.thesis = ThesisData.model_validate(
                    theses[profile.id], from_attributes=True
                )
            except ValidationError:
                snapshot.thesis = None
        elif profile.kind == AppRole.MENTOR:
            snapshot.expertise = expertise_data(expertise_rows.get(profile.id))
        snapshots.append(snapshot)
    return snapshots


# M10: accounts pending deletion or with matching consent withdrawn are invisible and unmatched.
_VISIBLE_USER = (User.deleted_at.is_(None), User.matching_enabled.is_(True))


async def load_viewer(session: AsyncSession, clerk_user_id: str) -> ProfileSnapshot | None:
    result = await session.execute(
        select(Profile, User)
        .join(User, Profile.user_id == User.id)
        .where(
            User.clerk_id == clerk_user_id,
            Profile.kind == User.role,
            Profile.l1_completed_at.is_not(None),
            *_VISIBLE_USER,
        )
    )
    row = result.first()
    if row is None:
        return None
    snapshots = await _build(session, [(row[0], row[1])])
    return snapshots[0] if snapshots[0].matchable else None


async def load_candidates(
    session: AsyncSession, kinds: list[AppRole], exclude_user_id: UUID
) -> list[ProfileSnapshot]:
    result = await session.execute(
        select(Profile, User)
        .join(User, Profile.user_id == User.id)
        .where(
            Profile.kind.in_(kinds),
            Profile.l1_completed_at.is_not(None),
            User.id != exclude_user_id,
            *_VISIBLE_USER,
        )
    )
    snapshots = await _build(session, [(row[0], row[1]) for row in result.all()])
    return [snapshot for snapshot in snapshots if snapshot.matchable]


async def load_by_ids(
    session: AsyncSession, profile_ids: list[UUID]
) -> dict[UUID, ProfileSnapshot]:
    if not profile_ids:
        return {}
    result = await session.execute(
        select(Profile, User)
        .join(User, Profile.user_id == User.id)
        .where(Profile.id.in_(profile_ids), *_VISIBLE_USER)
    )
    snapshots = await _build(session, [(row[0], row[1]) for row in result.all()])
    return {snapshot.profile_id: snapshot for snapshot in snapshots}


def document_text(snapshot: ProfileSnapshot) -> str:
    """The L1 text that gets embedded; L2 momentum and L3 posts join this once M5/M4 ship."""
    parts: list[str] = []
    if snapshot.founder is not None:
        founder = snapshot.founder
        parts = [
            f"{founder.startup_name}: {founder.description}",
            f"Sector: {founder.sector.value}. Stage: {STAGE_LABELS[founder.stage.value]}.",
            f"Business model: {founder.business_model.value}. Based in {founder.city}.",
        ]
        if founder.competitors:
            parts.append(f"Competitors: {', '.join(founder.competitors)}.")
        if snapshot.recent_posts:
            parts.append(f"Recent updates: {' '.join(snapshot.recent_posts)}")
    elif snapshot.thesis is not None:
        thesis = snapshot.thesis
        parts = [
            f"Invests in {', '.join(sector.value for sector in thesis.sectors)} startups",
            f"at {', '.join(STAGE_LABELS[stage.value] for stage in thesis.stages)} stage,",
            f"in {', '.join(GEOGRAPHY_LABELS[geo] for geo in thesis.geographies)}.",
        ]
        if snapshot.deals:
            deals = ", ".join(f"{deal.company} ({deal.sector})" for deal in snapshot.deals[:10])
            parts.append(f"Past investments: {deals}.")
        if thesis.no_gos:
            parts.append(f"Avoids: {', '.join(thesis.no_gos)}.")
    elif snapshot.expertise is not None:
        expertise = snapshot.expertise
        stages = ", ".join(STAGE_LABELS[stage.value] for stage in expertise.stages)
        parts = [
            f"Mentor with expertise in {', '.join(area.value for area in expertise.areas)}.",
            f"Helps {stages} stage founders.",
        ]
    if snapshot.bio:
        parts.append(snapshot.bio)
    return " ".join(parts)
