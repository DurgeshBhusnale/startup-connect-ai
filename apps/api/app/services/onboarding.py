from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.db import ConsentLog, Profile, User
from app.models.me import MeResponse, OnboardingRequest
from app.services.clerk import fetch_clerk_identity


class MissingEmailError(Exception):
    pass


async def get_me(session: AsyncSession, clerk_user_id: str) -> MeResponse:
    role = await session.scalar(select(User.role).where(User.clerk_id == clerk_user_id))
    return MeResponse(onboarded=role is not None, role=role)


async def complete_onboarding(
    session: AsyncSession, clerk_user_id: str, payload: OnboardingRequest
) -> MeResponse:
    current = await get_me(session, clerk_user_id)
    if current.onboarded:
        return current

    identity = await fetch_clerk_identity(clerk_user_id)
    if identity.email is None:
        raise MissingEmailError

    upsert_user = (
        insert(User)
        .values(
            clerk_id=clerk_user_id,
            email=identity.email,
            display_name=identity.display_name,
            role=payload.role,
        )
        .on_conflict_do_update(
            index_elements=[User.clerk_id],
            set_={
                "email": identity.email,
                "display_name": identity.display_name,
                "role": payload.role,
            },
            where=User.role.is_(None),
        )
        .returning(User.id)
    )
    user_id = await session.scalar(upsert_user)
    if user_id is None:
        # A concurrent request finished onboarding first; keep its choices.
        await session.rollback()
        return await get_me(session, clerk_user_id)

    await session.execute(
        insert(Profile)
        .values(user_id=user_id, kind=payload.role)
        .on_conflict_do_nothing(index_elements=[Profile.user_id, Profile.kind])
    )
    policy_version = get_settings().consent_policy_version
    session.add_all(
        ConsentLog(user_id=user_id, scope=scope, granted=granted, policy_version=policy_version)
        for scope, granted in payload.consents.as_scopes()
    )
    await session.commit()
    return MeResponse(onboarded=True, role=payload.role)
