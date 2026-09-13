from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session


def get_clerk_user_id(request: Request) -> str:
    user_id: str = request.state.user_id
    return user_id


SessionDep = Annotated[AsyncSession, Depends(get_session)]
ClerkUserId = Annotated[str, Depends(get_clerk_user_id)]
