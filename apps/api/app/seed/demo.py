# ruff: noqa: E501, RUF001, S101 - dev-only script: demo copy as whole sentences, asserts for ids.
"""Demo data so every feature can be explored from a founder, an investor and a mentor account.

Real accounts must exist first: sign up in the app and choose a role on /onboarding. Their profiles
are filled only while still empty; everything else (15 demo people who can't sign in, plus all the
activity between them and you) is wiped and recreated on every run.

From apps/api (stop the local API first when QDRANT_URL is blank: embedded Qdrant is single-process):

    python -m app.seed.demo --founder you+founder@gmail.com --investor you+investor@gmail.com \
        --mentor you+mentor@gmail.com
    python -m app.seed.demo --remove --founder ... --investor ... --mentor ...

Any of the three accounts can be left out. --remove deletes the demo people and all activity on the
given accounts (their profiles stay).
"""

import argparse
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from io import BytesIO
from typing import Any
from uuid import UUID, uuid4

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_session_factory
from app.errors import ProblemError, UpstreamServiceError
from app.models.db import (
    AppRole,
    ConsentLog,
    ConsentScope,
    Endorsement,
    FeedbackEvent,
    IntroRequest,
    InvestorThesis,
    Match,
    Meeting,
    MeetingOutcome,
    MentorExpertise,
    Message,
    Notification,
    Post,
    PostMedia,
    Profile,
    SearchQuery,
    TrustScore,
    TrustScoreHistory,
    User,
)
from app.models.founder import SaveProfileRequest
from app.models.investor import PriorInvestmentsRequest, ThesisRequest
from app.models.mentor import LinkedInVerificationRequest, MentorExpertiseRequest
from app.models.taxonomy import STAGE_LABELS
from app.services import (
    founder_profile,
    investor_profile,
    matching,
    mentor_profile,
    posts,
    storage,
    vector_store,
)
from app.services.match_scoring import format_inr
from app.workers.compute_trust import recompute_trust

logger = logging.getLogger("startup_connect_api.seed")

GHOST_PREFIX = "seed_demo_"
GHOST_EMAIL_DOMAIN = "demo.startupconnect.invalid"
NOW = datetime.now(UTC).replace(microsecond=0)


def ago(days: float = 0, hours: float = 0) -> datetime:
    return NOW - timedelta(days=days, hours=hours)


def ahead(days: float = 0, hours: float = 0) -> datetime:
    start = NOW + timedelta(days=days, hours=hours)
    return start.replace(minute=30 if start.minute >= 30 else 0, second=0)


@dataclass
class Person:
    key: str
    role: AppRole
    name: str
    founder: dict[str, Any] | None = None
    thesis: dict[str, Any] | None = None
    deals: list[dict[str, Any]] = field(default_factory=list)
    expertise: dict[str, Any] | None = None
    bio: str | None = None
    website: str | None = None
    ask_pin: str | None = None
    linkedin: str | None = None
    real: bool = False
    clerk_id: str = ""
    user_id: UUID | None = None
    profile_id: UUID | None = None
    l1: dict[str, Any] = field(default_factory=dict)

    @property
    def first(self) -> str:
        return self.name.split()[0] if self.name.strip() else self.name

    @property
    def pid(self) -> UUID:
        assert self.profile_id is not None
        return self.profile_id

    @property
    def uid(self) -> UUID:
        assert self.user_id is not None
        return self.user_id


def founder_data(**values: Any) -> dict[str, Any]:
    return {"competitors": [], **values}


REAL_DEFAULTS: dict[AppRole, Person] = {
    AppRole.FOUNDER: Person(
        key="you_founder",
        role=AppRole.FOUNDER,
        name="",
        founder=founder_data(
            startup_name="Rupeez",
            sector="Fintech",
            stage="seed",
            city="Pune",
            business_model="B2B SaaS subscription",
            ask_amount_inr=4_000_000,
            team_size=3,
            description="AI-powered receivables management for D2C brands in India.",
            competitors=["CredFlow", "Chargebee", "Zoho Invoice"],
        ),
        bio="Building Rupeez to fix receivables for India's D2C brands. Ex-fintech product lead.",
        website="https://rupeez.in",
        ask_pin="Intros to D2C brands in Pune for our receivables pilot",
    ),
    AppRole.INVESTOR: Person(
        key="you_investor",
        role=AppRole.INVESTOR,
        name="",
        thesis={
            "sectors": ["Fintech", "SaaS", "AI/ML", "D2C"],
            "stages": ["pre-seed", "seed"],
            "cheque_min": 500_000,
            "cheque_max": 5_000_000,
            "geographies": ["pune", "bengaluru", "mumbai"],
            "no_gos": ["Gambling"],
        },
        deals=[
            {
                "company": "Beacon",
                "sector": "Fintech",
                "stage": "seed",
                "cheque": 1_000_000,
                "year": 2023,
            },
            {
                "company": "BuildKit",
                "sector": "SaaS",
                "stage": "pre-seed",
                "cheque": 500_000,
                "year": 2024,
            },
            {
                "company": "Rupiya",
                "sector": "Fintech",
                "stage": "seed",
                "cheque": 1_500_000,
                "year": 2025,
            },
        ],
        bio="Angel investor backing early fintech and B2B SaaS teams. Former founder.",
    ),
    AppRole.MENTOR: Person(
        key="you_mentor",
        role=AppRole.MENTOR,
        name="",
        expertise={
            "areas": ["GTM", "Fundraising", "Growth loops", "Pricing"],
            "stages": ["pre-seed", "seed"],
            "availability": "2-per-month",
            "session_fee": None,
        },
        bio="VP Growth at a Series B SaaS company. I mentor two founders a month on GTM.",
        linkedin="https://www.linkedin.com/in/demo-mentor-profile",
    ),
}


def ghosts() -> list[Person]:
    return [
        Person(
            "arjun",
            AppRole.FOUNDER,
            "Arjun Mehta",
            founder=founder_data(
                startup_name="PayLite",
                sector="Fintech",
                stage="pre-seed",
                city="Mumbai",
                business_model="Transaction fees",
                ask_amount_inr=2_500_000,
                team_size=2,
                description="UPI-based salary advances for gig workers, repaid automatically at payout.",
            ),
            bio="Second-time founder. Previously ran ops at a delivery startup.",
        ),
        Person(
            "sneha",
            AppRole.FOUNDER,
            "Sneha Kulkarni",
            founder=founder_data(
                startup_name="LedgerLoop",
                sector="SaaS",
                stage="seed",
                city="Pune",
                business_model="B2B SaaS subscription",
                ask_amount_inr=6_000_000,
                team_size=6,
                description="Practice management software for chartered accountant firms in India.",
            ),
            bio="Chartered accountant turned founder.",
        ),
        Person(
            "rohan",
            AppRole.FOUNDER,
            "Rohan Das",
            founder=founder_data(
                startup_name="ShelfSense",
                sector="AI/ML",
                stage="seed",
                city="Bengaluru",
                business_model="B2B SaaS subscription",
                ask_amount_inr=4_500_000,
                team_size=5,
                description="Computer vision that predicts stock-outs for kirana stores and FMCG brands.",
            ),
        ),
        Person(
            "fatima",
            AppRole.FOUNDER,
            "Fatima Sheikh",
            founder=founder_data(
                startup_name="Kindred Care",
                sector="Healthtech",
                stage="pre-seed",
                city="Hyderabad",
                business_model="B2C subscription",
                ask_amount_inr=3_000_000,
                team_size=4,
                description="At-home elder care plans with nurse visits and remote vitals monitoring.",
            ),
        ),
        Person(
            "vikram",
            AppRole.FOUNDER,
            "Vikram Rao",
            founder=founder_data(
                startup_name="GreenGrid",
                sector="Climate & Energy",
                stage="series-a",
                city="Chennai",
                business_model="Hardware",
                ask_amount_inr=30_000_000,
                team_size=18,
                description="Battery storage units that let small factories shift load to solar hours.",
            ),
        ),
        Person(
            "ananya",
            AppRole.FOUNDER,
            "Ananya Deshmukh",
            founder=founder_data(
                startup_name="VeriDoc AI",
                sector="AI/ML",
                stage="pre-seed",
                city="Pune",
                business_model="B2B SaaS subscription",
                ask_amount_inr=3_500_000,
                team_size=3,
                description="Document verification for lenders using OCR and fraud detection models.",
            ),
        ),
        Person(
            "nikhil",
            AppRole.INVESTOR,
            "Nikhil Bansal",
            thesis={
                "sectors": ["Fintech", "SaaS", "AI/ML"],
                "stages": ["pre-seed", "seed"],
                "cheque_min": 1_000_000,
                "cheque_max": 7_500_000,
                "geographies": ["bengaluru", "pune", "mumbai"],
                "no_gos": [],
            },
            deals=[
                {
                    "company": "Cashlane",
                    "sector": "Fintech",
                    "stage": "seed",
                    "cheque": 2_500_000,
                    "year": 2022,
                },
                {
                    "company": "TaxNest",
                    "sector": "SaaS",
                    "stage": "pre-seed",
                    "cheque": 1_000_000,
                    "year": 2024,
                },
                {
                    "company": "Visor AI",
                    "sector": "AI/ML",
                    "stage": "seed",
                    "cheque": 5_000_000,
                    "year": 2025,
                },
            ],
            bio="Early-stage angel. Replies to every founder within a day.",
        ),
        Person(
            "kavya",
            AppRole.INVESTOR,
            "Kavya Iyer",
            thesis={
                "sectors": ["Healthtech", "BioTech"],
                "stages": ["series-a", "series-b-plus"],
                "cheque_min": 20_000_000,
                "cheque_max": 90_000_000,
                "geographies": ["us", "global"],
                "no_gos": [],
            },
        ),
        Person(
            "rahul",
            AppRole.INVESTOR,
            "Rahul Menon",
            thesis={
                "sectors": ["D2C", "Consumer", "Fintech", "AI/ML", "SaaS"],
                "stages": ["seed", "series-a"],
                "cheque_min": 5_000_000,
                "cheque_max": 20_000_000,
                "geographies": ["mumbai", "delhi-ncr"],
                "no_gos": [],
            },
        ),
        Person(
            "priya",
            AppRole.INVESTOR,
            "Priya Nair",
            thesis={
                "sectors": ["Climate & Energy", "Mobility", "Hardware / IoT"],
                "stages": ["seed", "series-a"],
                "cheque_min": 10_000_000,
                "cheque_max": 50_000_000,
                "geographies": ["chennai", "bengaluru", "india"],
                "no_gos": [],
            },
        ),
        Person(
            "siddharth",
            AppRole.INVESTOR,
            "Siddharth Rao",
            thesis={
                "sectors": ["AI/ML", "SaaS", "Fintech"],
                "stages": ["pre-seed", "seed"],
                "cheque_min": 500_000,
                "cheque_max": 4_000_000,
                "geographies": ["india", "global"],
                "no_gos": [],
            },
        ),
        Person(
            "farhan",
            AppRole.INVESTOR,
            "Farhan Qureshi",
            thesis={
                "sectors": ["Fintech", "Insurtech"],
                "stages": ["series-a"],
                "cheque_min": 25_000_000,
                "cheque_max": 100_000_000,
                "geographies": ["mumbai", "pune"],
                "no_gos": [],
            },
        ),
        Person(
            "kavita",
            AppRole.MENTOR,
            "Kavita Joshi",
            expertise={
                "areas": ["GTM", "Growth loops", "Pricing"],
                "stages": ["seed", "series-a"],
                "availability": "2-per-month",
                "session_fee": None,
            },
            bio="Head of Growth at a consumer fintech. Loves pricing problems.",
            linkedin="https://www.linkedin.com/in/kavita-joshi-demo",
        ),
        Person(
            "amit",
            AppRole.MENTOR,
            "Amit Verma",
            expertise={
                "areas": ["Fundraising", "Product", "PMF"],
                "stages": ["pre-seed", "seed"],
                "availability": "4-per-month",
                "session_fee": 2000,
            },
            bio="Two exits. Helps first-time founders prepare seed rounds.",
        ),
        Person(
            "deepa",
            AppRole.MENTOR,
            "Deepa Raman",
            expertise={
                "areas": ["Engineering leadership", "Hiring"],
                "stages": ["seed", "series-a"],
                "availability": "1-per-month",
                "session_fee": None,
            },
        ),
    ]


def claim_value(l1: dict[str, Any], item: str) -> str:
    field_name = item.removeprefix("l1.")
    value = l1.get(field_name)
    if field_name == "ask_amount_inr" and isinstance(value, int):
        return f"Raising {format_inr(value)}"
    if field_name == "stage" and isinstance(value, str):
        return STAGE_LABELS.get(value, value)
    if field_name == "team_size" and isinstance(value, int):
        return f"{value} {'person' if value == 1 else 'people'}"
    return str(value)[:300]


def dashboard_png() -> bytes:
    image = Image.new("RGB", (1200, 675), (248, 250, 252))
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.load_default(size=34)
    label_font = ImageFont.load_default(size=24)
    draw.rectangle((40, 40, 1160, 635), fill=(255, 255, 255), outline=(226, 232, 240), width=3)
    draw.text(
        (80, 70), "Invoices collected per month (Rs lakh)", fill=(11, 15, 25), font=title_font
    )
    for index, (month, value) in enumerate(
        [("Apr", 38), ("May", 52), ("Jun", 61), ("Jul", 74), ("Aug", 88), ("Sep", 120)]
    ):
        left = 110 + index * 170
        top = 580 - value * 3
        draw.rectangle((left, top, left + 110, 580), fill=(5, 150, 105))
        draw.text((left + 35, top - 34), str(value), fill=(11, 15, 25), font=label_font)
        draw.text((left + 30, 592), month, fill=(100, 116, 139), font=label_font)
    buffer = BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


# ---------------------------------------------------------------------------------------------
# Accounts and profiles


async def load_real(session: AsyncSession, email: str, role: AppRole) -> Person:
    user: User | None = await session.scalar(
        select(User).where(func.lower(User.email) == email.lower(), User.purged_at.is_(None))
    )
    if user is None:
        raise SystemExit(
            f"No account for {email}. Sign up in the app and choose the {role.value} role first."
        )
    if user.role != role:
        raise SystemExit(f"{email} chose the {user.role} role, not {role.value}.")
    profile_id = await session.scalar(
        select(Profile.id).where(Profile.user_id == user.id, Profile.kind == role)
    )
    template = REAL_DEFAULTS[role]
    return Person(
        key=template.key,
        role=role,
        name=user.display_name or email.split("@")[0],
        founder=template.founder,
        thesis=template.thesis,
        deals=template.deals,
        expertise=template.expertise,
        bio=template.bio,
        website=template.website,
        ask_pin=template.ask_pin,
        linkedin=template.linkedin,
        real=True,
        clerk_id=user.clerk_id,
        user_id=user.id,
        profile_id=profile_id,
    )


async def create_ghost(session: AsyncSession, person: Person) -> None:
    person.clerk_id = f"{GHOST_PREFIX}{person.key}"
    user = User(
        clerk_id=person.clerk_id,
        email=f"{person.key}@{GHOST_EMAIL_DOMAIN}",
        role=person.role,
        display_name=person.name,
        created_at=ago(70),
    )
    session.add(user)
    await session.flush()
    profile = Profile(user_id=user.id, kind=person.role, created_at=ago(70))
    session.add(profile)
    await session.flush()
    version = get_settings().consent_policy_version
    for scope, granted in (
        (ConsentScope.TERMS_PRIVACY, True),
        (ConsentScope.MATCH_PROCESSING, True),
        (ConsentScope.EMAIL_NOTIFICATIONS, True),
        (ConsentScope.WHATSAPP_NOTIFICATIONS, False),
    ):
        session.add(
            ConsentLog(user_id=user.id, scope=scope, granted=granted, policy_version=version)
        )
    person.user_id, person.profile_id = user.id, profile.id
    await session.commit()


async def merge_l1(session: AsyncSession, person: Person, values: dict[str, Any]) -> None:
    current = await session.scalar(select(Profile.l1_data).where(Profile.id == person.pid)) or {}
    missing = {key: value for key, value in values.items() if value and not current.get(key)}
    if missing:
        await session.execute(
            update(Profile).where(Profile.id == person.pid).values(l1_data={**current, **missing})
        )


async def fill_profile(session: AsyncSession, person: Person) -> None:
    profile = await session.get(Profile, person.pid)
    assert profile is not None
    if person.role == AppRole.FOUNDER and person.founder is not None:
        if profile.l1_completed_at is None:
            await founder_profile.save_founder_profile(
                session,
                person.clerk_id,
                SaveProfileRequest.model_validate({"kind": "founder", "l1_data": person.founder}),
            )
        await merge_l1(session, person, {"bio": person.bio, "website": person.website})
        if person.ask_pin:
            await session.execute(
                update(Profile)
                .where(Profile.id == person.pid, Profile.ask_pin.is_(None))
                .values(ask_pin=person.ask_pin)
            )
    elif person.role == AppRole.INVESTOR and person.thesis is not None:
        has_thesis = await session.scalar(
            select(InvestorThesis.id).where(InvestorThesis.profile_id == person.pid)
        )
        if has_thesis is None:
            await investor_profile.save_thesis(
                session, person.clerk_id, ThesisRequest.model_validate(person.thesis)
            )
            if len(person.deals) >= 3:
                await investor_profile.save_prior_investments(
                    session,
                    person.clerk_id,
                    PriorInvestmentsRequest.model_validate(
                        {"entries": person.deals, "hide_cheque_amounts": False}
                    ),
                )
            else:
                await investor_profile.skip_prior_investments(session, person.clerk_id)
        await merge_l1(session, person, {"bio": person.bio})
    elif person.role == AppRole.MENTOR and person.expertise is not None:
        has_expertise = await session.scalar(
            select(MentorExpertise.id).where(MentorExpertise.profile_id == person.pid)
        )
        if has_expertise is None:
            await mentor_profile.save_expertise(
                session, person.clerk_id, MentorExpertiseRequest.model_validate(person.expertise)
            )
            if person.linkedin:
                await mentor_profile.request_verification(
                    session,
                    person.clerk_id,
                    LinkedInVerificationRequest.model_validate(
                        {"method": "linkedin", "payload": {"linkedin_url": person.linkedin}}
                    ),
                )
        await merge_l1(session, person, {"bio": person.bio})
    await session.commit()
    person.l1 = await session.scalar(select(Profile.l1_data).where(Profile.id == person.pid)) or {}


# ---------------------------------------------------------------------------------------------
# Removal


async def remove(session: AsyncSession, real: list[Person]) -> None:
    ghost_profiles = list(
        (
            await session.scalars(
                select(Profile.id)
                .join(User, Profile.user_id == User.id)
                .where(User.clerk_id.like(f"{GHOST_PREFIX}%"))
            )
        ).all()
    )
    real_profiles = [person.pid for person in real if person.profile_id is not None]
    real_users = [person.uid for person in real]
    involved = ghost_profiles + real_profiles
    paths: list[str] = []
    if involved:
        media = await session.execute(
            select(PostMedia.storage_path, PostMedia.thumbnail_path).where(
                PostMedia.profile_id.in_(involved)
            )
        )
        paths = [path for row in media.tuples() for path in row]
        await session.execute(
            delete(Endorsement).where(
                or_(
                    Endorsement.endorser_profile_id.in_(involved),
                    Endorsement.target_profile_id.in_(involved),
                )
            )
        )
        for model in (Message, Meeting, IntroRequest):
            await session.execute(
                delete(model).where(
                    or_(
                        model.founder_profile_id.in_(involved),
                        model.partner_profile_id.in_(involved),
                    )
                )
            )
        await session.execute(
            delete(FeedbackEvent).where(
                or_(
                    FeedbackEvent.actor_profile_id.in_(involved),
                    FeedbackEvent.target_profile_id.in_(involved),
                )
            )
        )
        await session.execute(delete(PostMedia).where(PostMedia.profile_id.in_(involved)))
        await session.execute(delete(Post).where(Post.profile_id.in_(involved)))
        await session.execute(
            delete(Match).where(
                or_(Match.from_profile_id.in_(involved), Match.to_profile_id.in_(involved))
            )
        )
        await session.execute(delete(TrustScore).where(TrustScore.profile_id.in_(involved)))
        await session.execute(
            delete(TrustScoreHistory).where(TrustScoreHistory.profile_id.in_(involved))
        )
    if real_users:
        await session.execute(delete(Notification).where(Notification.user_id.in_(real_users)))
        await session.execute(delete(SearchQuery).where(SearchQuery.user_id.in_(real_users)))
    for profile_id in real_profiles:
        # Forget the last match run so the next Matches visit recomputes right away.
        current = await session.scalar(select(Profile.l1_data).where(Profile.id == profile_id))
        if isinstance(current, dict) and "matching" in current:
            cleaned = {key: value for key, value in current.items() if key != "matching"}
            await session.execute(
                update(Profile).where(Profile.id == profile_id).values(l1_data=cleaned)
            )
    ghost_users = select(User.id).where(User.clerk_id.like(f"{GHOST_PREFIX}%"))
    await session.execute(delete(ConsentLog).where(ConsentLog.user_id.in_(ghost_users)))
    await session.execute(delete(User).where(User.clerk_id.like(f"{GHOST_PREFIX}%")))
    await session.commit()
    if paths:
        try:
            await storage.delete_objects(paths)
        except UpstreamServiceError:
            logger.warning("Could not delete %d seeded image objects", len(paths))
    if ghost_profiles:
        try:
            await vector_store.delete_vectors(ghost_profiles)
        except Exception:  # vectors are cache: a leftover is re-embedded or ignored
            logger.warning("Could not delete demo vectors", exc_info=True)
    print(f"Removed {len(ghost_profiles)} demo people and activity on {len(real)} account(s).")


# ---------------------------------------------------------------------------------------------
# Activity


class Seeder:
    def __init__(self, session: AsyncSession, people: dict[str, Person]) -> None:
        self.session = session
        self.people = people
        self.skipped: list[str] = []

    def get(self, key: str) -> Person | None:
        return self.people.get(key)

    async def match(self, owner: Person, other: Person) -> Match | None:
        row: Match | None = await self.session.scalar(
            select(Match).where(
                Match.from_profile_id == owner.pid, Match.to_profile_id == other.pid
            )
        )
        return row

    async def href(self, owner: Person, other: Person, suffix: str = "") -> str:
        row = await self.match(owner, other)
        return f"/matches/{row.id}{suffix}" if row else "/matches"

    async def linked(self, founder: Person, partner: Person) -> bool:
        if await self.match(founder, partner) and await self.match(partner, founder):
            return True
        self.skipped.append(f"{founder.name} ↔ {partner.name} (no match: sectors or stages differ)")
        return False

    async def feedback(
        self, actor: Person, target: Person, action: str, when: datetime, reason: str | None = None
    ) -> None:
        row = await self.match(actor, target)
        self.session.add(
            FeedbackEvent(
                match_id=row.id if row else None,
                actor_profile_id=actor.pid,
                target_profile_id=target.pid,
                action=action,
                reason=reason,
                fit_score=row.fit_score if row else None,
                created_at=when,
            )
        )

    async def intro(
        self,
        founder: Person,
        partner: Person,
        status: str,
        *,
        requested: datetime | None,
        responded: datetime | None = None,
        created: datetime | None = None,
        message: str | None = None,
        decline_reason: str | None = None,
    ) -> bool:
        if not await self.linked(founder, partner):
            return False
        start = created or requested or NOW
        self.session.add(
            IntroRequest(
                founder_profile_id=founder.pid,
                partner_profile_id=partner.pid,
                status=status,
                message=message,
                decline_reason=decline_reason,
                requested_at=requested,
                responded_at=responded,
                created_at=start,
                updated_at=responded or requested or start,
            )
        )
        if requested is not None:
            await self.feedback(founder, partner, "request_intro", requested)
        if status == "accepted" and responded is not None and requested is not None:
            await self.feedback(partner, founder, "accept_intro", responded)
        if status == "declined" and responded is not None:
            await self.feedback(partner, founder, "decline_intro", responded, decline_reason)
        if status == "interested":
            await self.feedback(partner, founder, "accept", start)
        return True

    async def thread(
        self,
        founder: Person,
        partner: Person,
        lines: list[tuple[Person, str, datetime]],
        *,
        unread_last: bool = False,
    ) -> None:
        for index, (sender, body, when) in enumerate(lines):
            recipient = partner if sender is founder else founder
            is_last = index == len(lines) - 1
            following = lines[index + 1][2] if not is_last else None
            read_at = when + timedelta(minutes=15)
            if following is not None:
                read_at = min(read_at, following)
            self.session.add(
                Message(
                    founder_profile_id=founder.pid,
                    partner_profile_id=partner.pid,
                    sender_profile_id=sender.pid,
                    recipient_profile_id=recipient.pid,
                    body=body,
                    client_ref=uuid4(),
                    read_at=None if (is_last and unread_last) else min(read_at, NOW),
                    created_at=when,
                )
            )

    async def meeting(
        self,
        founder: Person,
        partner: Person,
        *,
        booked_by: Person,
        host: Person,
        start: datetime,
        created: datetime,
        minutes: int = 30,
        completed: bool = False,
        prompt_sent: bool = False,
        title: str = "Intro call",
    ) -> UUID:
        ends = start + timedelta(minutes=minutes)
        past = ends < NOW
        meeting = Meeting(
            founder_profile_id=founder.pid,
            partner_profile_id=partner.pid,
            booked_by_profile_id=booked_by.pid,
            host_profile_id=host.pid,
            cal_booking_uid=f"seed-demo-{uuid4().hex}",
            title=title,
            scheduled_at=start,
            ends_at=ends,
            status="scheduled",
            reminder_24h_sent_at=start - timedelta(hours=24) if past else None,
            reminder_1h_sent_at=start - timedelta(hours=1) if past else None,
            completed_at=ends + timedelta(hours=3) if completed else None,
            outcome_prompt_sent_at=ends + timedelta(hours=2)
            if (completed or prompt_sent)
            else None,
            created_at=created,
            updated_at=created,
        )
        self.session.add(meeting)
        await self.session.flush()
        return meeting.id

    def outcome(
        self, meeting_id: UUID, person: Person, outcome: str, notes: str | None, when: datetime
    ) -> None:
        self.session.add(
            MeetingOutcome(
                meeting_id=meeting_id,
                profile_id=person.pid,
                outcome=outcome,
                notes=notes,
                created_at=when,
                updated_at=when,
            )
        )

    def endorse(
        self, endorser: Person, target: Person, item: str, claim: str, when: datetime
    ) -> None:
        self.session.add(
            Endorsement(
                target_profile_id=target.pid,
                endorser_profile_id=endorser.pid,
                target_item_kind="milestone" if item.startswith("post:") else "profile_field",
                target_item_id=item,
                claim_snapshot=claim[:300],
                endorser_name=endorser.name,
                created_at=when,
            )
        )

    def notify(
        self,
        person: Person,
        kind: str,
        title: str,
        when: datetime,
        *,
        body: str | None = None,
        label: str | None = None,
        href: str | None = None,
        read: bool = True,
    ) -> None:
        if not person.real:
            return
        self.session.add(
            Notification(
                user_id=person.uid,
                kind=kind,
                title=title[:200],
                body=body[:300] if body else None,
                action_label=label,
                action_href=href,
                read_at=min(when + timedelta(hours=1), NOW) if read else None,
                created_at=when,
            )
        )

    def searched(self, person: Person, query: str, results: int, when: datetime) -> None:
        self.session.add(
            SearchQuery(user_id=person.uid, query=query, result_count=results, created_at=when)
        )

    async def set_state(
        self,
        owner: Person,
        other: Person,
        *,
        saved: datetime | None = None,
        rejected: datetime | None = None,
        reason: str | None = None,
    ) -> None:
        row = await self.match(owner, other)
        if row is None:
            self.skipped.append(f"{owner.name} → {other.name} (no match to save/hide)")
            return
        row.saved_at, row.rejected_at, row.reject_reason = saved, rejected, reason
        if saved:
            await self.feedback(owner, other, "save", saved)
        if rejected:
            await self.feedback(owner, other, "reject", rejected, reason)

    # -- scenarios ------------------------------------------------------------------------------

    async def run(self, milestones: dict[str, str]) -> None:
        await self.ghost_network(milestones)
        await self.founder_view(milestones)
        await self.investor_view(milestones)
        await self.mentor_view(milestones)
        await self.session.commit()

    async def ghost_network(self, milestones: dict[str, str]) -> None:
        p = self.people
        nikhil, rahul = p["nikhil"], p["rahul"]
        arjun, sneha, rohan, ananya = p["arjun"], p["sneha"], p["rohan"], p["ananya"]

        # Nikhil answers everyone within hours: enough history for a "Highly responsive" badge.
        if await self.intro(
            arjun,
            nikhil,
            "accepted",
            requested=ago(60),
            responded=ago(59, 21),
            message="Hi Nikhil, PayLite gives gig workers salary advances over UPI. Would love your view on our lending partnerships.",
        ):
            await self.thread(
                arjun,
                nikhil,
                [
                    (
                        nikhil,
                        "Thanks Arjun. How do you handle repayment when a worker switches platforms?",
                        ago(59, 20),
                    ),
                    (
                        arjun,
                        "Advances are deducted at payout through the fleet operator, so it follows the job.",
                        ago(59, 10),
                    ),
                    (nikhil, "Makes sense. What are defaults like so far?", ago(59, 6)),
                    (arjun, "Zero defaults across 1,800 advances.", ago(58)),
                    (nikhil, "Impressive. Let's meet next week.", ago(57, 20)),
                    (arjun, "Booked a slot for Tuesday.", ago(56)),
                    (nikhil, "See you then.", ago(55, 22)),
                ],
            )
            meeting = await self.meeting(
                arjun,
                nikhil,
                booked_by=arjun,
                host=nikhil,
                start=ago(50),
                created=ago(56),
                completed=True,
            )
            self.outcome(meeting, arjun, "great_fit", None, ago(49, 20))
            self.outcome(
                meeting, nikhil, "undecided", "Wants to see lender terms first.", ago(49, 18)
            )
        if await self.intro(
            sneha,
            nikhil,
            "accepted",
            requested=ago(45),
            responded=ago(44, 22),
            message="Hi Nikhil, LedgerLoop runs practice management for CA firms. We're raising a seed round.",
        ):
            await self.thread(
                sneha,
                nikhil,
                [
                    (
                        sneha,
                        "Thanks for accepting! Happy to share our pipeline of CA firms.",
                        ago(44, 20),
                    ),
                    (nikhil, "Please do. What's your average contract value?", ago(44, 16)),
                    (sneha, "₹30,000 a year per firm, growing with seats.", ago(44, 10)),
                    (nikhil, "Got it, thanks.", ago(44, 8)),
                ],
            )
        if await self.intro(
            rohan,
            nikhil,
            "accepted",
            requested=ago(35),
            responded=ago(34, 23),
            message="Hi Nikhil, ShelfSense predicts stock-outs for kirana stores with computer vision.",
        ):
            await self.thread(
                rohan,
                nikhil,
                [
                    (
                        rohan,
                        "Thanks Nikhil. We're live in 40 kirana stores in Bengaluru.",
                        ago(34, 22),
                    ),
                    (nikhil, "What's the reduction in stock-outs?", ago(34, 20)),
                    (rohan, "12% fewer stock-outs in the first quarter.", ago(34, 12)),
                    (nikhil, "Strong. Let's talk.", ago(34, 10)),
                    (rohan, "Booked for Monday.", ago(33)),
                    (nikhil, "Great.", ago(32, 23)),
                ],
            )
            meeting = await self.meeting(
                rohan,
                nikhil,
                booked_by=rohan,
                host=nikhil,
                start=ago(28),
                created=ago(33),
                completed=True,
            )
            self.outcome(meeting, rohan, "great_fit", None, ago(27, 20))
        if await self.intro(
            ananya,
            nikhil,
            "accepted",
            requested=ago(20),
            responded=ago(19, 22),
            message="Hi Nikhil, VeriDoc AI verifies loan documents for lenders. Would value your feedback.",
        ):
            await self.thread(
                ananya,
                nikhil,
                [
                    (
                        ananya,
                        "Thanks for connecting. Could I send you our fraud detection results?",
                        ago(19, 20),
                    ),
                    (nikhil, "Yes please.", ago(19, 18)),
                ],
            )

        # Rahul lets intros and messages sit for over a week: "Response history: limited".
        await self.intro(
            arjun,
            rahul,
            "pending",
            requested=ago(12),
            message="Hi Rahul, PayLite is raising a pre-seed round for UPI salary advances.",
        )
        await self.intro(
            sneha,
            rahul,
            "pending",
            requested=ago(14),
            message="Hi Rahul, LedgerLoop helps CA firms run their practice. Open to a quick call?",
        )
        if await self.intro(
            rohan,
            rahul,
            "accepted",
            requested=ago(29),
            responded=ago(20),
            message="Hi Rahul, ShelfSense reduces stock-outs for FMCG brands.",
        ):
            await self.thread(
                rohan,
                rahul,
                [
                    (
                        rohan,
                        "Thanks for accepting. Could we set up a call about our retail pilots?",
                        ago(19, 20),
                    ),
                    (rahul, "Sorry for the delay, busy quarter. Send me a summary.", ago(10, 10)),
                    (
                        rohan,
                        "Here's the summary: 40 kirana stores live, 12% fewer stock-outs.",
                        ago(10, 5),
                    ),
                    (rahul, "Will review.", ago(1)),
                    (rohan, "Following up. Would next week work for a call?", ago(0, 22)),
                ],
            )
        if await self.intro(
            ananya,
            rahul,
            "accepted",
            requested=ago(30),
            responded=ago(21),
            message="Hi Rahul, VeriDoc AI verifies loan documents for lenders.",
        ):
            await self.thread(
                ananya,
                rahul,
                [
                    (
                        ananya,
                        "Thanks Rahul. Which lenders in your portfolio could pilot this?",
                        ago(20, 20),
                    ),
                    (rahul, "Let me check and get back.", ago(11)),
                    (ananya, "Thank you! Happy to share a demo video too.", ago(10, 22)),
                    (rahul, "Send it over.", ago(2)),
                ],
            )

        # A few more connections so every list has variety.
        fatima, kavya, vikram, priya = p["fatima"], p["kavya"], p["vikram"], p["priya"]
        if await self.intro(
            fatima,
            kavya,
            "accepted",
            requested=ago(16),
            responded=ago(15),
            message="Hi Kavya, Kindred Care runs at-home elder care plans in Hyderabad.",
        ):
            await self.thread(
                fatima,
                kavya,
                [
                    (kavya, "Hi Fatima, how many families are on paid plans today?", ago(14, 20)),
                    (fatima, "120 families, with 91% renewing after three months.", ago(14, 10)),
                ],
            )
        await self.intro(
            vikram,
            priya,
            "pending",
            requested=ago(2),
            message="Hi Priya, GreenGrid is raising a Series A for factory battery storage.",
        )
        deepa, kavita = p["deepa"], p["kavita"]
        if await self.intro(
            rohan,
            deepa,
            "accepted",
            requested=ago(22),
            responded=ago(21, 12),
            message="Hi Deepa, I'd love advice on hiring our first engineering manager.",
        ):
            await self.thread(
                rohan,
                deepa,
                [
                    (deepa, "Happy to help. What's the team size today?", ago(21, 10)),
                    (rohan, "Five engineers, all reporting to me.", ago(21, 5)),
                    (
                        deepa,
                        "Then hire for coaching, not just architecture. Let's go through a scorecard.",
                        ago(21, 2),
                    ),
                ],
            )
        await self.intro(
            sneha, kavita, "interested", requested=None, created=ago(6), responded=ago(6)
        )

        for key, text, days in (
            (
                "arjun",
                "Now live with two delivery fleets in Mumbai. Workers get advances in under a minute.",
                20,
            ),
            ("rohan", "Our stock-out model now covers 1,200 SKUs across 40 stores.", 8),
            ("ananya", "Signed our second NBFC pilot for document verification.", 5),
            ("fatima", "Added remote vitals monitoring to our premium care plan.", 11),
        ):
            self.session.add(
                Post(
                    profile_id=p[key].pid,
                    kind="text",
                    body=text,
                    moderation_status="approved",
                    created_at=ago(days),
                    updated_at=ago(days),
                )
            )

    async def founder_view(self, milestones: dict[str, str]) -> None:
        founder = self.get("you_founder")
        if founder is None:
            return
        p = self.people
        nikhil, rahul, kavita, amit, deepa = (
            p["nikhil"],
            p["rahul"],
            p["kavita"],
            p["amit"],
            p["deepa"],
        )
        startup = str(founder.l1.get("startup_name") or "our startup")

        self.notify(
            founder,
            "new_matches",
            "7 new matches",
            ago(22),
            body="Ranked by fit, each with a reason.",
            label="Browse matches",
            href="/matches",
        )

        if await self.intro(
            founder,
            nikhil,
            "accepted",
            requested=ago(21),
            responded=ago(20, 20),
            message=f"Hi Nikhil, I'm building {startup}. Given your fintech portfolio, I'd value a 20-minute call about our seed round.",
        ):
            self.notify(
                founder,
                "mutual_match",
                "Nikhil Bansal accepted your intro request",
                ago(20, 20),
                label="View match",
                href=await self.href(founder, nikhil),
            )
            await self.thread(
                founder,
                nikhil,
                [
                    (
                        nikhil,
                        f"Hi {founder.first}, thanks for the intro. How do you acquire customers today?",
                        ago(20, 18),
                    ),
                    (
                        founder,
                        "Mostly founder-led sales, plus two marketplace partnerships.",
                        ago(20, 15),
                    ),
                    (nikhil, "Great. Let's do a 30-minute call this week.", ago(20, 14)),
                    (founder, "Booked a slot for Thursday. Thank you!", ago(15)),
                    (
                        nikhil,
                        "Good call today. Could you send the retention cohorts by customer size?",
                        ago(13, 20),
                    ),
                    (founder, "Sending the cohort breakdown this morning.", ago(0, 20)),
                    (
                        nikhil,
                        "Thanks. I'm taking this to our partner meeting on Friday and will update you.",
                        ago(0, 3),
                    ),
                ],
                unread_last=True,
            )
            self.notify(
                founder,
                "message_received",
                "New message from Nikhil Bansal",
                ago(0, 3),
                body="Thanks. I'm taking this to our partner meeting on Friday and will update you.",
                label="Reply",
                href=await self.href(founder, nikhil),
                read=False,
            )
            meeting = await self.meeting(
                founder,
                nikhil,
                booked_by=founder,
                host=nikhil,
                start=ago(14),
                created=ago(15),
                completed=True,
            )
            self.outcome(
                meeting,
                founder,
                "great_fit",
                "Nikhil wants cohort data by customer size before the partner meeting.",
                ago(13, 20),
            )
            self.outcome(meeting, nikhil, "great_fit", None, ago(13, 19))
            self.endorse(
                nikhil, founder, "l1.team_size", claim_value(founder.l1, "l1.team_size"), ago(12)
            )
            self.notify(
                founder,
                "endorsement_received",
                "Nikhil Bansal endorsed a claim on your profile",
                ago(12),
                body=f"Team: {claim_value(founder.l1, 'l1.team_size')}",
                label="View profile",
                href="/profile",
            )
            if "users" in milestones:
                self.endorse(
                    nikhil, founder, milestones["users"], "Crossed 500 paying D2C brands", ago(1, 6)
                )
                self.notify(
                    founder,
                    "endorsement_received",
                    "Nikhil Bansal endorsed a claim on your profile",
                    ago(1, 6),
                    body="Milestone: Crossed 500 paying D2C brands",
                    label="View profile",
                    href="/profile?tab=posts",
                    read=False,
                )

        await self.intro(
            founder,
            rahul,
            "pending",
            requested=ago(10),
            message=f"Hi Rahul, {startup} automates receivables for D2C brands. Could we talk about our seed round?",
        )
        if await self.intro(
            founder, kavita, "interested", requested=None, created=ago(1), responded=ago(1)
        ):
            self.notify(
                founder,
                "match_interest",
                "Kavita Joshi is interested in connecting",
                ago(1),
                body="Send an intro request to connect.",
                label="Request intro",
                href=await self.href(founder, kavita),
                read=False,
            )
        await self.set_state(founder, p["farhan"], rejected=ago(5), reason="wrong_stage")
        await self.set_state(founder, p["siddharth"], saved=ago(4))

        if await self.intro(
            founder,
            amit,
            "accepted",
            requested=ago(31),
            responded=ago(30, 20),
            message="Hi Amit, I'd love your help preparing our seed round narrative.",
        ):
            await self.thread(
                founder,
                amit,
                [
                    (amit, "Happy to help. Send me your current deck outline.", ago(30, 18)),
                    (founder, "Sent. The traction slide feels weak.", ago(30, 10)),
                    (
                        amit,
                        "Lead with monthly invoice volume, not brand count. Let's meet.",
                        ago(30, 6),
                    ),
                ],
            )
            self.endorse(
                amit,
                founder,
                "l1.ask_amount_inr",
                claim_value(founder.l1, "l1.ask_amount_inr"),
                ago(20),
            )
            meeting = await self.meeting(
                founder,
                amit,
                booked_by=founder,
                host=amit,
                start=ago(0, 3.5),
                created=ago(3),
                prompt_sent=True,
                title="Pitch review",
            )
            self.notify(
                founder,
                "meeting_outcome_prompt",
                "How did your meeting with Amit Verma go?",
                ago(0, 1),
                body="Log a quick outcome. Your notes stay private.",
                label="Log outcome",
                href=f"/meetings/{meeting}/outcome",
                read=False,
            )

        await self.intro(
            founder,
            deepa,
            "declined",
            requested=ago(6),
            responded=ago(5),
            message="Hi Deepa, could you advise on hiring our first engineers?",
            decline_reason="not_right_person",
        )

        self.searched(founder, "Investors who back fintech in Pune", 3, ago(2, 3))
        self.searched(founder, "Mentors for B2B GTM at seed stage", 3, ago(1, 5))
        self.searched(founder, "Seed investors in Bengaluru", 2, ago(0, 6))

    async def investor_view(self, milestones: dict[str, str]) -> None:
        investor = self.get("you_investor")
        if investor is None:
            return
        p = self.people
        arjun, sneha, rohan, ananya = p["arjun"], p["sneha"], p["rohan"], p["ananya"]
        founder = self.get("you_founder")

        self.notify(
            investor,
            "new_matches",
            "5 new matches",
            ago(17),
            body="Ranked by fit, each with a reason.",
            label="Browse matches",
            href="/matches",
        )
        if founder is not None:
            startup = str(founder.l1.get("startup_name") or "our startup")
            if await self.intro(
                founder,
                investor,
                "pending",
                requested=ago(3),
                message=f"Hi {investor.first}, {startup} automates receivables for D2C brands and we're raising our seed round. Given your fintech investments, I'd love a 20-minute call.",
            ):
                self.notify(
                    investor,
                    "intro_received",
                    f"{founder.name} from {startup} requested an intro",
                    ago(3),
                    label="Review intro",
                    href="/intros",
                    read=False,
                )
        for person, startup, days, text in (
            (
                sneha,
                "LedgerLoop",
                1,
                "Hi, LedgerLoop runs practice management for 40 CA firms in Pune. We're raising ₹60L and would value your SaaS experience.",
            ),
            (
                rohan,
                "ShelfSense",
                2,
                "Hi, ShelfSense predicts stock-outs for kirana stores. 12% fewer stock-outs in our pilots. Open to a quick call?",
            ),
        ):
            if await self.intro(person, investor, "pending", requested=ago(days), message=text):
                self.notify(
                    investor,
                    "intro_received",
                    f"{person.name} from {startup} requested an intro",
                    ago(days),
                    label="Review intro",
                    href="/intros",
                    read=False,
                )

        if await self.intro(
            arjun,
            investor,
            "accepted",
            requested=ago(16),
            responded=ago(15, 20),
            message="Hi, PayLite gives gig workers UPI salary advances. We're raising a ₹25L pre-seed round.",
        ):
            self.notify(
                investor,
                "mutual_match",
                "You're connected with Arjun Mehta from PayLite",
                ago(15, 20),
                label="View match",
                href=await self.href(investor, arjun),
            )
            await self.thread(
                arjun,
                investor,
                [
                    (
                        arjun,
                        "Thanks for accepting! We're live with two delivery fleets.",
                        ago(15, 18),
                    ),
                    (
                        investor,
                        "Interesting. What does repayment look like when workers switch platforms?",
                        ago(15, 10),
                    ),
                    (
                        arjun,
                        "Advances are deducted at payout, and we've had zero defaults across 1,800 advances.",
                        ago(15, 6),
                    ),
                    (investor, "Let's meet. Please book a slot next week.", ago(5)),
                    (arjun, "Booked for Tuesday. Looking forward to it.", ago(4, 20)),
                    (arjun, "Sharing our lender partnership terms before the call.", ago(0, 5)),
                ],
                unread_last=True,
            )
            self.notify(
                investor,
                "message_received",
                "New message from Arjun Mehta",
                ago(0, 5),
                body="Sharing our lender partnership terms before the call.",
                label="Reply",
                href=await self.href(investor, arjun),
                read=False,
            )
            await self.meeting(
                arjun, investor, booked_by=arjun, host=investor, start=ahead(4), created=ago(4, 20)
            )
            self.notify(
                investor,
                "meeting_booked",
                "Arjun Mehta booked a meeting with you",
                ago(4, 20),
                body="Intro call · 30 min",
                label="View meeting",
                href=await self.href(investor, arjun, "/schedule"),
            )
            if "arjun" in milestones:
                self.endorse(
                    investor,
                    arjun,
                    milestones["arjun"],
                    "Onboarded 1,800 gig workers across two fleets",
                    ago(3),
                )

        await self.intro(
            ananya,
            investor,
            "declined",
            requested=ago(9),
            responded=ago(8),
            message="Hi, VeriDoc AI verifies loan documents for lenders.",
            decline_reason="wrong_stage",
        )
        await self.set_state(investor, sneha, saved=ago(1))

        self.searched(investor, "Seed-stage fintech founders in Pune", 2, ago(1))
        self.searched(investor, "Founders raising Series A in AI", 1, ago(3))
        self.searched(investor, "D2C founders raising ₹50L", 2, ago(0, 2))

    async def mentor_view(self, milestones: dict[str, str]) -> None:
        mentor = self.get("you_mentor")
        if mentor is None:
            return
        p = self.people
        sneha, ananya = p["sneha"], p["ananya"]
        founder = self.get("you_founder")

        self.notify(
            mentor,
            "new_matches",
            "4 new matches",
            ago(26),
            body="Ranked by fit, each with a reason.",
            label="Browse matches",
            href="/matches",
        )
        if founder is not None:
            startup = str(founder.l1.get("startup_name") or "our startup")
            if await self.intro(
                founder,
                mentor,
                "accepted",
                requested=ago(9),
                responded=ago(8, 20),
                message=f"Hi {mentor.first}, I'd love your advice on pricing {startup} for mid-size D2C brands.",
            ):
                self.notify(
                    mentor,
                    "intro_received",
                    f"{founder.name} from {startup} requested an intro",
                    ago(9),
                    label="Review intro",
                    href="/intros",
                )
                self.notify(
                    founder,
                    "mutual_match",
                    f"{mentor.name} accepted your intro request",
                    ago(8, 20),
                    label="View match",
                    href=await self.href(founder, mentor),
                )
                await self.thread(
                    founder,
                    mentor,
                    [
                        (
                            founder,
                            f"Hi {mentor.first}, thanks for accepting! Our churn is highest on the starter plan.",
                            ago(8, 18),
                        ),
                        (mentor, "Send me your plans and churn by tier.", ago(8, 10)),
                        (
                            founder,
                            "Three tiers. Most churn is on the starter plan after month two.",
                            ago(7),
                        ),
                        (
                            mentor,
                            "That's a packaging problem more than a price problem. Let's go through it on a call.",
                            ago(6, 20),
                        ),
                        (founder, "Booked a slot for Thursday. Thank you!", ago(1, 2)),
                    ],
                    unread_last=True,
                )
                self.notify(
                    mentor,
                    "message_received",
                    f"New message from {founder.name}",
                    ago(1, 2),
                    body="Booked a slot for Thursday. Thank you!",
                    label="Reply",
                    href=await self.href(mentor, founder),
                    read=False,
                )
                await self.meeting(
                    founder,
                    mentor,
                    booked_by=founder,
                    host=mentor,
                    start=ahead(2),
                    created=ago(1, 2),
                    title="Pricing session",
                )
                self.notify(
                    mentor,
                    "meeting_booked",
                    f"{founder.name} booked a meeting with you",
                    ago(1, 2),
                    body="Pricing session · 30 min",
                    label="View meeting",
                    href=await self.href(mentor, founder, "/schedule"),
                    read=False,
                )
                self.endorse(
                    mentor,
                    founder,
                    "l1.description",
                    claim_value(founder.l1, "l1.description"),
                    ago(6),
                )
                self.notify(
                    founder,
                    "endorsement_received",
                    f"{mentor.name} endorsed a claim on your profile",
                    ago(6),
                    body=f"Startup description: {claim_value(founder.l1, 'l1.description')}",
                    label="View profile",
                    href="/profile",
                )

        if await self.intro(
            ananya,
            mentor,
            "pending",
            requested=ago(1),
            message="Hi, I'm preparing VeriDoc AI's pre-seed round and would love help with our fundraising story.",
        ):
            self.notify(
                mentor,
                "intro_received",
                "Ananya Deshmukh from VeriDoc AI requested an intro",
                ago(1),
                label="Review intro",
                href="/intros",
                read=False,
            )

        if await self.intro(
            sneha,
            mentor,
            "accepted",
            requested=ago(26),
            responded=ago(25, 22),
            message="Hi, LedgerLoop needs help choosing between direct sales and CA associations.",
        ):
            await self.thread(
                sneha,
                mentor,
                [
                    (
                        sneha,
                        "Thanks for connecting! Which channel would you test first?",
                        ago(25, 20),
                    ),
                    (
                        mentor,
                        "Start with three CA associations in Pune. Let's plan it together.",
                        ago(25, 14),
                    ),
                ],
            )
            meeting = await self.meeting(
                sneha,
                mentor,
                booked_by=sneha,
                host=mentor,
                start=ago(18),
                created=ago(24),
                completed=True,
                title="GTM planning",
            )
            self.outcome(
                meeting,
                mentor,
                "great_fit",
                "Narrow the ICP to firms with 5–20 staff. Follow up in a month.",
                ago(17, 20),
            )
            self.outcome(meeting, sneha, "undecided", None, ago(17, 10))
            if "sneha" in milestones:
                self.endorse(
                    mentor, sneha, milestones["sneha"], "Crossed ₹12L ARR from 40 CA firms", ago(10)
                )

        self.searched(mentor, "Pre-seed SaaS founders", 2, ago(2))
        self.searched(mentor, "Fintech founders in Pune", 2, ago(0, 4))


async def seed_posts(session: AsyncSession, people: dict[str, Person]) -> dict[str, str]:
    """Milestone and image posts; returns milestone item ids ("post:<id>") by owner key."""
    milestones: dict[str, str] = {}

    def add(
        owner: Person,
        kind: str,
        days: float,
        body: str = "",
        milestone: dict[str, Any] | None = None,
    ) -> Post:
        post = Post(
            profile_id=owner.pid,
            kind=kind,
            body=body,
            milestone=milestone,
            moderation_status="approved",
            created_at=ago(days),
            updated_at=ago(days),
        )
        session.add(post)
        return post

    def milestone_data(
        kind: str, value: str, days: int, description: str | None = None
    ) -> dict[str, Any]:
        return {
            "type": kind,
            "value": value,
            "achieved_on": ago(days).date().isoformat(),
            "description": description,
        }

    founder = people.get("you_founder")
    if founder is not None:
        add(
            founder,
            "text",
            25,
            "We just launched automated payment reminders on WhatsApp. Early customers are collecting invoices 9 days faster.",
        )
        users = add(
            founder,
            "milestone",
            18,
            milestone=milestone_data(
                "users",
                "Crossed 500 paying D2C brands",
                18,
                "Mostly through referrals from our first 50 brands.",
            ),
        )
        add(
            founder,
            "milestone",
            9,
            milestone=milestone_data("revenue", "Processing ₹1.2 Cr in invoices every month", 9),
        )
        await session.flush()
        milestones["users"] = f"post:{users.id}"
    arjun = add(
        people["arjun"],
        "milestone",
        10,
        milestone=milestone_data("users", "Onboarded 1,800 gig workers across two fleets", 10),
    )
    sneha = add(
        people["sneha"],
        "milestone",
        15,
        milestone=milestone_data("revenue", "Crossed ₹12L ARR from 40 CA firms", 15),
    )
    add(
        people["vikram"],
        "milestone",
        30,
        milestone=milestone_data("funding", "Closed ₹2 Cr pre-Series A from climate angels", 30),
    )
    await session.flush()
    milestones["arjun"], milestones["sneha"] = f"post:{arjun.id}", f"post:{sneha.id}"
    for key in ("you_founder", "arjun", "sneha", "vikram"):
        if key in people:
            await session.execute(
                update(Profile)
                .where(Profile.id == people[key].pid)
                .values(embedding_v=Profile.embedding_v + 1)
            )
    await session.commit()

    if founder is not None:
        try:
            upload = await posts.upload_media(session, founder.clerk_id, dashboard_png())
            image_post = add(
                founder,
                "image",
                2,
                "Our new collections dashboard is rolling out to every customer this week.",
            )
            await session.flush()
            await session.execute(
                update(PostMedia)
                .where(PostMedia.id == upload.media_id)
                .values(post_id=image_post.id, position=0)
            )
            await session.commit()
        except (ProblemError, UpstreamServiceError) as exc:
            await session.rollback()
            print(f"  Skipped the image post (storage unavailable: {exc})")
    return milestones


async def run(args: argparse.Namespace) -> None:
    factory = get_session_factory()
    real: list[Person] = []
    async with factory() as session:
        for email, role in (
            (args.founder, AppRole.FOUNDER),
            (args.investor, AppRole.INVESTOR),
            (args.mentor, AppRole.MENTOR),
        ):
            if email:
                real.append(await load_real(session, email, role))
    async with factory() as session:
        await remove(session, real)
    if args.remove:
        return

    people: dict[str, Person] = {person.key: person for person in real}
    demo = ghosts()
    async with factory() as session:
        for person in demo:
            await create_ghost(session, person)
            people[person.key] = person
    print(f"Created {len(demo)} demo people.")

    for person in people.values():
        async with factory() as session:
            await fill_profile(session, person)
    print("Profiles filled.")

    async with factory() as session:
        milestones = await seed_posts(session, people)
    print("Posts added.")

    for person in people.values():
        async with factory() as session:
            try:
                result = await matching.compute_matches(session, person.clerk_id)
                if person.real:
                    print(
                        f"  {person.name} ({person.role.value}): {result.count} candidates scored"
                    )
            except ProblemError as exc:
                print(f"  Matching skipped for {person.name}: {exc.detail}")
    print("Matches computed.")

    async with factory() as session:
        seeder = Seeder(session, people)
        await seeder.run(milestones)
    for note in seeder.skipped:
        print(f"  Skipped {note}")
    print("Intros, messages, meetings, outcomes, endorsements, notifications and searches added.")

    updated = await recompute_trust(NOW)
    print(f"Trust recomputed for {updated} profiles.")
    print(
        "\nDone. Sign in as each account and open Home, Matches, Intro queue, Messages, Notifications, "
        "Profile and search (Ctrl+K)."
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--founder", help="email of your founder account")
    parser.add_argument("--investor", help="email of your investor account")
    parser.add_argument("--mentor", help="email of your mentor account")
    parser.add_argument(
        "--remove", action="store_true", help="delete demo data instead of creating it"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
