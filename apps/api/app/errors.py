from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.models.common import ProblemDetail


class UpstreamServiceError(Exception):
    """A dependency (Clerk, database) failed in a way the client can retry."""


class ProblemError(Exception):
    """An expected failure the client should branch on via its problem `type`."""

    def __init__(self, *, status: int, slug: str, title: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.type = f"/problems/{slug}"
        self.title = title
        self.detail = detail


def problem_response(problem: ProblemDetail) -> JSONResponse:
    return JSONResponse(
        content=jsonable_encoder(problem, exclude_none=True),
        status_code=problem.status,
        media_type="application/problem+json",
    )
