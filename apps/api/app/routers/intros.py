from uuid import UUID

from fastapi import APIRouter

from app.models.feedback import IntroRespondRequest, IntroRespondResponse
from app.models.intros import IntroQueueItem
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import connections

router = APIRouter(prefix="/v1/intros", tags=["intros"])


@router.get("", response_model=list[IntroQueueItem])
async def read_intro_queue(session: SessionDep, clerk_user_id: ClerkUserId) -> list[IntroQueueItem]:
    return await connections.list_intro_queue(session, clerk_user_id)


@router.post("/{intro_id}/respond", response_model=IntroRespondResponse)
async def respond_to_intro(
    intro_id: UUID, body: IntroRespondRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> IntroRespondResponse:
    return await connections.respond_intro(session, clerk_user_id, intro_id, body)
