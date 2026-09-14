from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import AppRole
from app.models.profile import AboutRequest, AboutResponse
from app.services.profile_lookup import get_role_profile


async def save_about(
    session: AsyncSession, clerk_user_id: str, payload: AboutRequest
) -> AboutResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole(payload.kind))
    updated = {**profile.l1_data, "bio": payload.bio}
    if payload.kind == "founder":
        updated["website"] = payload.website
    profile.l1_data = updated
    await session.commit()
    return AboutResponse(profile_id=profile.id)
