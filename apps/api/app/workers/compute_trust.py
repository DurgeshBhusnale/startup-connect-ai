"""Nightly trust & responsiveness recompute (S7).

Schedule as a daily Railway cron job: `python -m app.workers.compute_trust`.
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.db.session import get_session_factory
from app.models.db import Profile, TrustScoreHistory, User
from app.services.trust import SMOOTHING_DAYS, recompute_profile

logger = logging.getLogger("startup_connect_api.compute_trust")

HISTORY_KEEP_DAYS = SMOOTHING_DAYS * 2


async def recompute_trust(now: datetime | None = None) -> int:
    moment = now or datetime.now(UTC)
    factory = get_session_factory()
    async with factory() as session:
        profile_ids = (
            await session.scalars(
                select(Profile.id)
                .join(User, Profile.user_id == User.id)
                .where(User.deleted_at.is_(None), Profile.kind == User.role)
            )
        ).all()
        await session.execute(
            delete(TrustScoreHistory).where(
                TrustScoreHistory.computed_on < moment.date() - timedelta(days=HISTORY_KEEP_DAYS)
            )
        )
        await session.commit()

    updated = 0
    for profile_id in profile_ids:
        # One short session per profile, so a failure affects only that profile.
        async with factory() as session:
            try:
                await recompute_profile(session, profile_id, moment)
                updated += 1
            except Exception:
                logger.exception("trust_recompute_failed profile_id=%s", profile_id)
                await session.rollback()
    logger.info("trust_recompute_finished profiles=%d", updated)
    return updated


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(recompute_trust())


if __name__ == "__main__":
    main()
