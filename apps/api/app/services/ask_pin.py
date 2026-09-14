"""S9: a founder pins one "Currently asking for" line to the top of their profile."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ask_pin import AskPinRequest, AskPinResponse
from app.models.db import AppRole
from app.services.profile_lookup import get_role_profile

logger = logging.getLogger(__name__)


async def save_ask_pin(
    session: AsyncSession, clerk_user_id: str, body: AskPinRequest
) -> AskPinResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    profile.ask_pin = body.text
    await session.commit()
    logger.info("ask_pin_updated has_text=true")
    return AskPinResponse(status="saved", ask_pin=body.text)


async def clear_ask_pin(session: AsyncSession, clerk_user_id: str) -> AskPinResponse:
    profile = await get_role_profile(session, clerk_user_id, AppRole.FOUNDER)
    profile.ask_pin = None
    await session.commit()
    logger.info("ask_pin_updated has_text=false")
    return AskPinResponse(status="cleared", ask_pin=None)
