"""S7: trust & responsiveness, recomputed nightly.

Three signals, each a rate over the last 180 days:
- response: intros and messages answered within 7 days (a late or missing reply counts against);
- meetings: booked meetings that happened, where known (cancellations don't count against anyone);
- follow-through: mutual matches (older than 14 days) that led to a meeting.

The stored score is the mean of the daily raw scores over the last 30 days, so one bad week doesn't
swing it. Only categorical badges ever leave the API: numbers invite gaming.
"""

import logging
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import IntroRequest, Meeting, Message, TrustScore, TrustScoreHistory
from app.models.feedback import ConnectionStatus
from app.models.trust import TrustResponse
from app.services.badges import visible_profile

logger = logging.getLogger(__name__)

LOOKBACK = timedelta(days=180)
SMOOTHING_DAYS = 30
RESPONSE_DEADLINE = timedelta(days=7)
FOLLOW_THROUGH_AFTER = timedelta(days=14)
MIN_INTERACTIONS = 10
HIGH_TRUST = 0.75
LOW_TRUST = 0.4
FAST_RESPONSE_HOURS = 24.0
RESPONSE_WEIGHT = 0.5
MEETING_WEIGHT = 0.25
FOLLOW_THROUGH_WEIGHT = 0.25
# An intro request sent this long after the row was created answers the partner's earlier interest.
INTEREST_REPLY_GAP = timedelta(minutes=1)


@dataclass
class TrustInputs:
    responses_due: int = 0
    responded: int = 0
    response_hours: list[float] = field(default_factory=list)
    meetings_due: int = 0
    meetings_held: int = 0
    connections_due: int = 0
    connections_followed: int = 0

    @property
    def interactions(self) -> int:
        return self.responses_due + self.meetings_due + self.connections_due

    def record_response(
        self, asked_at: datetime, answered_at: datetime | None, now: datetime
    ) -> None:
        if answered_at is not None and answered_at >= asked_at:
            delay = answered_at - asked_at
            self.responses_due += 1
            self.response_hours.append(delay.total_seconds() / 3600)
            if delay <= RESPONSE_DEADLINE:
                self.responded += 1
        elif now - asked_at > RESPONSE_DEADLINE:
            self.responses_due += 1
        # Otherwise the reply isn't due yet.


@dataclass(frozen=True)
class TrustResult:
    raw_score: float | None
    interactions: int
    response_rate: float | None
    median_response_hours: float | None
    meeting_completion_rate: float | None
    follow_through_rate: float | None


def _rate(done: int, due: int) -> float | None:
    return done / due if due else None


def summarize(inputs: TrustInputs) -> TrustResult:
    response = _rate(inputs.responded, inputs.responses_due)
    meetings = _rate(inputs.meetings_held, inputs.meetings_due)
    follow_through = _rate(inputs.connections_followed, inputs.connections_due)
    parts = [
        (weight, value)
        for weight, value in (
            (RESPONSE_WEIGHT, response),
            (MEETING_WEIGHT, meetings),
            (FOLLOW_THROUGH_WEIGHT, follow_through),
        )
        if value is not None
    ]
    raw = sum(w * v for w, v in parts) / sum(w for w, _ in parts) if parts else None
    median = statistics.median(inputs.response_hours) if inputs.response_hours else None
    return TrustResult(raw, inputs.interactions, response, median, meetings, follow_through)


def badge_for(
    score: float | None, interactions: int, median_hours: float | None
) -> tuple[str | None, str | None]:
    """No badge below MIN_INTERACTIONS, so new users are never penalised (S7 AC4)."""
    if score is None or interactions < MIN_INTERACTIONS:
        return None, None
    if score < LOW_TRUST:
        return "low", "Response history: limited"
    fast = median_hours is not None and median_hours <= FAST_RESPONSE_HOURS
    if score >= HIGH_TRUST and (fast or median_hours is None):
        return "high", "Highly responsive"
    return "medium", "Usually responds within 24hr" if fast else "Response time varies"


async def collect_inputs(session: AsyncSession, profile_id: UUID, now: datetime) -> TrustInputs:
    inputs = TrustInputs()
    since = now - LOOKBACK

    meetings = (
        await session.scalars(
            select(Meeting).where(
                or_(
                    Meeting.founder_profile_id == profile_id,
                    Meeting.partner_profile_id == profile_id,
                )
            )
        )
    ).all()
    met_pairs = {(m.founder_profile_id, m.partner_profile_id) for m in meetings}
    for meeting in meetings:
        if meeting.status != "scheduled" or meeting.ends_at < since:
            continue
        if meeting.completed_at is not None:
            inputs.meetings_due += 1
            inputs.meetings_held += 1
        elif meeting.outcome_unknown_at is not None:
            inputs.meetings_due += 1
        # No outcome yet, or reported as didn't happen: not counted.

    intros = (
        await session.scalars(
            select(IntroRequest).where(
                or_(
                    IntroRequest.founder_profile_id == profile_id,
                    IntroRequest.partner_profile_id == profile_id,
                ),
                IntroRequest.created_at >= since,
            )
        )
    ).all()
    for intro in intros:
        status = intro.status
        if status == ConnectionStatus.CANCELLED.value:
            continue
        interest_first = status == ConnectionStatus.INTERESTED.value or (
            intro.requested_at is not None
            and intro.requested_at - intro.created_at > INTEREST_REPLY_GAP
        )
        if intro.partner_profile_id == profile_id:
            # The founder asked; the investor or mentor is expected to accept or decline.
            if not interest_first and intro.requested_at is not None:
                answered = (
                    intro.responded_at
                    if status in (ConnectionStatus.ACCEPTED.value, ConnectionStatus.DECLINED.value)
                    else None
                )
                inputs.record_response(intro.requested_at, answered, now)
        elif interest_first:
            # The partner showed interest first; the founder is expected to send the intro.
            inputs.record_response(intro.created_at, intro.requested_at, now)

        if status == ConnectionStatus.ACCEPTED.value:
            stamps = [t for t in (intro.responded_at, intro.requested_at, intro.created_at) if t]
            if max(stamps) <= now - FOLLOW_THROUGH_AFTER:
                inputs.connections_due += 1
                if (intro.founder_profile_id, intro.partner_profile_id) in met_pairs:
                    inputs.connections_followed += 1

    rows = await session.execute(
        select(
            Message.founder_profile_id,
            Message.partner_profile_id,
            Message.sender_profile_id,
            Message.created_at,
        )
        .where(
            or_(Message.founder_profile_id == profile_id, Message.partner_profile_id == profile_id),
            Message.created_at >= since,
        )
        .order_by(Message.founder_profile_id, Message.partner_profile_id, Message.created_at)
    )
    threads: dict[tuple[UUID, UUID], list[tuple[UUID, datetime]]] = defaultdict(list)
    for founder_id, partner_id, sender_id, created_at in rows.tuples():
        threads[(founder_id, partner_id)].append((sender_id, created_at))
    # A turn starts with the other person's first message after the profile last spoke.
    for thread in threads.values():
        waiting_since: datetime | None = None
        for sender_id, created_at in thread:
            if sender_id != profile_id:
                waiting_since = waiting_since or created_at
            elif waiting_since is not None:
                inputs.record_response(waiting_since, created_at, now)
                waiting_since = None
        if waiting_since is not None:
            inputs.record_response(waiting_since, None, now)
    return inputs


async def recompute_profile(session: AsyncSession, profile_id: UUID, now: datetime) -> TrustScore:
    result = summarize(await collect_inputs(session, profile_id, now))
    today = now.date()
    if result.raw_score is not None:
        statement = insert(TrustScoreHistory).values(
            profile_id=profile_id,
            computed_on=today,
            raw_score=result.raw_score,
            interactions=result.interactions,
        )
        await session.execute(
            statement.on_conflict_do_update(
                index_elements=[TrustScoreHistory.profile_id, TrustScoreHistory.computed_on],
                set_={
                    "raw_score": statement.excluded.raw_score,
                    "interactions": statement.excluded.interactions,
                },
            )
        )
    smoothed = await session.scalar(
        select(func.avg(TrustScoreHistory.raw_score)).where(
            TrustScoreHistory.profile_id == profile_id,
            TrustScoreHistory.computed_on > today - timedelta(days=SMOOTHING_DAYS),
        )
    )
    score = float(smoothed) if smoothed is not None else None
    badge, message = badge_for(score, result.interactions, result.median_response_hours)

    row = await session.get(TrustScore, profile_id)
    if row is None:
        row = TrustScore(profile_id=profile_id)
        session.add(row)
    previous = row.score
    row.previous_score = previous
    row.score = score
    row.badge = badge
    row.message = message
    row.interactions = result.interactions
    row.response_rate = result.response_rate
    row.median_response_hours = result.median_response_hours
    row.meeting_completion_rate = result.meeting_completion_rate
    row.follow_through_rate = result.follow_through_rate
    row.computed_at = now
    await session.commit()
    delta = score - previous if score is not None and previous is not None else 0.0
    logger.info("trust_recomputed profile_id=%s badge=%s delta=%.3f", profile_id, badge, delta)
    return row


async def get_profile_trust(
    session: AsyncSession, clerk_user_id: str, profile_id: UUID
) -> TrustResponse:
    profile = await visible_profile(session, clerk_user_id, profile_id)
    row = await session.get(TrustScore, profile.id)
    if row is None or row.badge is None:
        return TrustResponse(badge=None, message=None)
    logger.info("trust_badge_viewed badge=%s", row.badge)
    return TrustResponse.model_validate({"badge": row.badge, "message": row.message})
