from uuid import UUID

from fastapi import APIRouter

from app.models.meetings import (
    MeetingCreatedResponse,
    MeetingCreateRequest,
    MeetingOutcomeContext,
    MeetingOutcomeRequest,
    MeetingOutcomeResponse,
    NudgeResponse,
    SchedulingContext,
    SchedulingLinkRequest,
    SchedulingLinkResponse,
)
from app.routers.dependencies import ClerkUserId, SessionDep
from app.services import meeting_outcomes, meetings

router = APIRouter(tags=["meetings"])


@router.get("/v1/matches/{match_id}/scheduling", response_model=SchedulingContext)
async def read_scheduling_context(
    match_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> SchedulingContext:
    return await meetings.get_scheduling_context(session, clerk_user_id, match_id)


@router.post("/v1/matches/{match_id}/scheduling/nudge", response_model=NudgeResponse)
async def nudge_to_schedule(
    match_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> NudgeResponse:
    return await meetings.nudge_partner(session, clerk_user_id, match_id)


@router.post("/v1/meetings", response_model=MeetingCreatedResponse, status_code=201)
async def create_meeting(
    body: MeetingCreateRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> MeetingCreatedResponse:
    return await meetings.create_meeting(session, clerk_user_id, body)


@router.get("/v1/meetings/{meeting_id}/outcome", response_model=MeetingOutcomeContext)
async def read_meeting_outcome(
    meeting_id: UUID, session: SessionDep, clerk_user_id: ClerkUserId
) -> MeetingOutcomeContext:
    return await meeting_outcomes.get_outcome_context(session, clerk_user_id, meeting_id)


@router.post("/v1/meetings/{meeting_id}/outcome", response_model=MeetingOutcomeResponse)
async def submit_meeting_outcome(
    meeting_id: UUID,
    body: MeetingOutcomeRequest,
    session: SessionDep,
    clerk_user_id: ClerkUserId,
) -> MeetingOutcomeResponse:
    return await meeting_outcomes.submit_outcome(session, clerk_user_id, meeting_id, body)


@router.get("/v1/profiles/me/scheduling-link", response_model=SchedulingLinkResponse)
async def read_scheduling_link(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> SchedulingLinkResponse:
    return await meetings.get_scheduling_link(session, clerk_user_id)


@router.put("/v1/profiles/me/scheduling-link", response_model=SchedulingLinkResponse)
async def save_scheduling_link(
    body: SchedulingLinkRequest, session: SessionDep, clerk_user_id: ClerkUserId
) -> SchedulingLinkResponse:
    return await meetings.save_scheduling_link(session, clerk_user_id, body)


@router.delete("/v1/profiles/me/scheduling-link", response_model=SchedulingLinkResponse)
async def remove_scheduling_link(
    session: SessionDep, clerk_user_id: ClerkUserId
) -> SchedulingLinkResponse:
    return await meetings.remove_scheduling_link(session, clerk_user_id)
