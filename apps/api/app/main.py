import logging
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.errors import UpstreamServiceError, problem_response
from app.middleware.auth import ClerkAuthMiddleware
from app.models.common import ProblemDetail
from app.routers import health, me

settings = get_settings()
logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger("startup_connect_api")

app = FastAPI(
    title="Startup Connect AI API",
    version="0.1.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Starlette runs the last-added middleware first: CORS must wrap auth so 401s carry CORS headers.
app.add_middleware(ClerkAuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    title = HTTPStatus(exc.status_code).phrase
    detail = str(exc.detail) if exc.detail and exc.detail != title else None
    return problem_response(
        ProblemDetail(title=title, status=exc.status_code, detail=detail, instance=request.url.path)
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return problem_response(
        ProblemDetail(
            title="Request validation failed",
            status=422,
            instance=request.url.path,
            errors=jsonable_encoder(exc.errors()),
        )
    )


@app.exception_handler(UpstreamServiceError)
async def upstream_exception_handler(request: Request, exc: UpstreamServiceError) -> JSONResponse:
    logger.warning("Upstream failure on %s: %s", request.url.path, exc)
    return problem_response(
        ProblemDetail(
            title="Service Unavailable",
            status=503,
            detail="A service we depend on is unavailable. Try again shortly.",
            instance=request.url.path,
        )
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s", request.url.path)
    return problem_response(
        ProblemDetail(
            title="Internal Server Error",
            status=500,
            detail=None if settings.is_production else repr(exc),
            instance=request.url.path,
        )
    )


app.include_router(health.router)
app.include_router(me.router)
