from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.models.common import ProblemDetail


class UpstreamServiceError(Exception):
    """A dependency (Clerk, database) failed in a way the client can retry."""


def problem_response(problem: ProblemDetail) -> JSONResponse:
    return JSONResponse(
        content=jsonable_encoder(problem, exclude_none=True),
        status_code=problem.status,
        media_type="application/problem+json",
    )
