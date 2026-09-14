"""Hard-deletes accounts whose 30-day deletion grace period has ended (PRD M10 AC6).

Run on a schedule, e.g. a daily Railway cron job: `python -m app.workers.purge_accounts`.
"""

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select

from app.db.session import get_session_factory
from app.models.db import User
from app.services.privacy import purge_account

logger = logging.getLogger("startup_connect_api.purge_accounts")


async def purge_due_accounts(now: datetime | None = None) -> int:
    cutoff = now or datetime.now(UTC)
    factory = get_session_factory()
    async with factory() as session:
        due = (
            await session.scalars(
                select(User.id).where(User.hard_delete_at <= cutoff, User.purged_at.is_(None))
            )
        ).all()

    purged = 0
    for user_id in due:
        async with factory() as session:
            user = await session.get(User, user_id)
            # Skip accounts restored since the query above.
            if user is None or user.hard_delete_at is None or user.hard_delete_at > cutoff:
                continue
            try:
                await purge_account(session, user)
            except Exception:  # one failure must not block the rest; it is retried next run
                logger.exception("Purging account %s failed", user_id)
                await session.rollback()
                continue
            purged += 1
    logger.info("accounts_purged count=%d due=%d", purged, len(due))
    return purged


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(purge_due_accounts())


if __name__ == "__main__":
    main()
