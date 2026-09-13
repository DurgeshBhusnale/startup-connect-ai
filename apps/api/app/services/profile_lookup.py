from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ProblemError
from app.models.db import AppRole, Profile, User


async def get_role_profile(session: AsyncSession, clerk_user_id: str, kind: AppRole) -> Profile:
    profile = await session.scalar(
        select(Profile)
        .join(User, Profile.user_id == User.id)
        .where(User.clerk_id == clerk_user_id, Profile.kind == kind)
    )
    if profile is None:
        raise ProblemError(
            status=404,
            slug=f"no-{kind.value}-profile",
            title="Profile not found",
            detail=f"Choose the {kind.value} role before setting up this profile.",
        )
    return profile
