"""S8: an edited or deleted claim loses its endorsements, and each endorser is told.

Kept free of other service imports so profile and post services can call it without import cycles.
"""

import logging
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import Endorsement, Profile, User
from app.models.endorsements import ENDORSABLE_FIELDS
from app.models.notifications import NotificationKind
from app.services.notifications import notify

logger = logging.getLogger(__name__)

INACTIVE_ENDORSER = "Endorser account inactive"


def claim_label(item_id: str) -> str:
    if item_id.startswith("post:"):
        return "Milestone"
    return ENDORSABLE_FIELDS.get(item_id.removeprefix("l1."), "Profile detail")


async def strip_endorsements(
    session: AsyncSession,
    target_profile_id: UUID,
    item_ids: Sequence[str],
    *,
    founder_name: str,
) -> int:
    """Deletes endorsements on the given claims (not committed) and notifies active endorsers."""
    if not item_ids:
        return 0
    rows = (
        (
            await session.execute(
                select(Endorsement, Profile.user_id, User.deleted_at)
                .outerjoin(Profile, Endorsement.endorser_profile_id == Profile.id)
                .outerjoin(User, Profile.user_id == User.id)
                .where(
                    Endorsement.target_profile_id == target_profile_id,
                    Endorsement.target_item_id.in_(item_ids),
                )
            )
        )
        .tuples()
        .all()
    )
    for endorsement, user_id, deleted_at in rows:
        if user_id is not None and deleted_at is None:
            label = claim_label(endorsement.target_item_id)
            await notify(
                session,
                user_id=user_id,
                kind=NotificationKind.ENDORSEMENT_REMOVED,
                title=f"{founder_name} changed a claim you endorsed",
                body=f"Your endorsement of “{label}” was removed because the claim was edited.",
                action_label="View your endorsements",
                action_href="/profile",
            )
        await session.delete(endorsement)
    if rows:
        logger.info("endorsement_stripped count=%d", len(rows))
    return len(rows)
