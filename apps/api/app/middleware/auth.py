from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.errors import UpstreamServiceError, problem_response
from app.models.common import ProblemDetail
from app.services.clerk import InvalidSessionTokenError, verify_session_token

PUBLIC_PATHS = frozenset({"/health", "/docs", "/openapi.json"})
# Scheduled jobs carry the cron secret instead of a Clerk session (see routers/jobs.py).
PUBLIC_PREFIXES = ("/v1/jobs/",)


class ClerkAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if request.method == "OPTIONS" or path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        scheme, _, token = request.headers.get("authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            return _unauthorized(request, "Missing bearer token")

        try:
            claims = await verify_session_token(token)
        except InvalidSessionTokenError:
            return _unauthorized(request, "Invalid or expired session token")
        except UpstreamServiceError:
            return problem_response(
                ProblemDetail(
                    title="Service Unavailable",
                    status=503,
                    detail="Authentication service is unreachable. Try again shortly.",
                    instance=request.url.path,
                )
            )

        # Holds the Clerk user id (JWT sub); internal users.id is looked up where needed.
        request.state.user_id = claims.sub
        return await call_next(request)


def _unauthorized(request: Request, detail: str) -> Response:
    response = problem_response(
        ProblemDetail(title="Unauthorized", status=401, detail=detail, instance=request.url.path)
    )
    response.headers["WWW-Authenticate"] = "Bearer"
    return response
