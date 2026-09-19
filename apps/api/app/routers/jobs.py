"""Scheduled jobs over HTTP, for hosts that trigger work with a request (Vercel Cron).

Railway runs the same workers as commands (`python -m app.workers.<name>`); these endpoints exist so
a serverless deployment can run them too. They carry the cron secret instead of a Clerk session, so
the auth middleware lets /v1/jobs/* through and the secret is checked here.
"""

import hmac
import logging
from collections.abc import Awaitable, Callable
from typing import Annotated, Literal

from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.config import get_settings
from app.errors import ProblemError
from app.workers import compute_trust, meeting_notifications, purge_accounts, purge_posts

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/jobs", tags=["jobs"])


class JobResponse(BaseModel):
    job: str
    status: Literal["done"]


async def _meeting_notifications() -> None:
    await meeting_notifications.run()


async def _compute_trust() -> None:
    await compute_trust.recompute_trust()


async def _purge_accounts() -> None:
    await purge_accounts.purge_due_accounts()


async def _purge_posts() -> None:
    await purge_posts.purge_posts()


JOBS: dict[str, Callable[[], Awaitable[None]]] = {
    "meeting-notifications": _meeting_notifications,
    "compute-trust": _compute_trust,
    "purge-accounts": _purge_accounts,
    "purge-posts": _purge_posts,
}


def _not_found() -> ProblemError:
    # Same answer for a wrong secret and an unknown job: nothing to probe for.
    return ProblemError(status=404, slug="job-not-found", title="Not found", detail="Unknown job.")


@router.get("/{job}", response_model=JobResponse)
async def run_job(job: str, authorization: Annotated[str | None, Header()] = None) -> JobResponse:
    secret = get_settings().cron_secret
    provided = (authorization or "").removeprefix("Bearer ").strip()
    if not secret or not provided or not hmac.compare_digest(provided, secret):
        raise _not_found()
    runner = JOBS.get(job)
    if runner is None:
        raise _not_found()
    logger.info("scheduled_job_started job=%s", job)
    await runner()
    logger.info("scheduled_job_finished job=%s", job)
    return JobResponse(job=job, status="done")
