"""Hard-deletes posts 30 days after soft delete (PRD M4 AC9) and removes abandoned uploads.

Run on a schedule, e.g. a daily Railway cron job: `python -m app.workers.purge_posts`.
"""

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import and_, delete, or_, select

from app.db.session import get_session_factory
from app.models.db import Post, PostMedia
from app.services import storage
from app.services.posts import DELETE_GRACE_PERIOD, ORPHAN_MEDIA_TTL

logger = logging.getLogger("startup_connect_api.purge_posts")


async def purge_posts(now: datetime | None = None) -> tuple[int, int]:
    cutoff = now or datetime.now(UTC)
    factory = get_session_factory()
    async with factory() as session:
        expired_posts = list(
            (
                await session.scalars(
                    select(Post.id).where(Post.deleted_at <= cutoff - DELETE_GRACE_PERIOD)
                )
            ).all()
        )
        media = (
            await session.execute(
                select(PostMedia.id, PostMedia.storage_path, PostMedia.thumbnail_path).where(
                    or_(
                        PostMedia.post_id.in_(expired_posts),
                        and_(
                            PostMedia.post_id.is_(None),
                            PostMedia.created_at <= cutoff - ORPHAN_MEDIA_TTL,
                        ),
                    )
                )
            )
        ).all()

    # Objects first: if Storage is down, rows stay and the whole run is retried tomorrow.
    await storage.delete_objects([path for row in media for path in (row[1], row[2])])
    async with factory() as session:
        if media:
            await session.execute(
                delete(PostMedia).where(PostMedia.id.in_([row[0] for row in media]))
            )
        if expired_posts:
            await session.execute(delete(Post).where(Post.id.in_(expired_posts)))
        await session.commit()
    logger.info("posts_purged posts=%d media=%d", len(expired_posts), len(media))
    return len(expired_posts), len(media)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(purge_posts())


if __name__ == "__main__":
    main()
