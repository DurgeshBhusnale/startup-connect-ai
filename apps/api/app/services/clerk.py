import asyncio
import urllib.error
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import quote

import jwt
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.errors import UpstreamServiceError

USER_AGENT = "startup-connect-api/0.1"


class InvalidSessionTokenError(Exception):
    pass


class SessionClaims(BaseModel):
    sub: str
    azp: str | None = None


class _ClerkEmailAddress(BaseModel):
    id: str
    email_address: str


class _ClerkUser(BaseModel):
    id: str
    primary_email_address_id: str | None = None
    email_addresses: list[_ClerkEmailAddress] = []
    first_name: str | None = None
    last_name: str | None = None


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    settings = get_settings()
    return jwt.PyJWKClient(
        f"{settings.clerk_api_url}/jwks",
        headers={
            "Authorization": f"Bearer {settings.clerk_secret_key}",
            "User-Agent": USER_AGENT,
        },
        cache_keys=True,
        lifespan=3600,
        timeout=10,
    )


async def verify_session_token(token: str) -> SessionClaims:
    settings = get_settings()
    try:
        signing_key = await asyncio.to_thread(_jwks_client().get_signing_key_from_jwt, token)
    except jwt.PyJWKClientConnectionError as exc:
        raise UpstreamServiceError("Could not reach Clerk to verify the session") from exc
    except (jwt.PyJWKClientError, jwt.InvalidTokenError) as exc:
        raise InvalidSessionTokenError from exc

    try:
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"require": ["exp", "iat", "sub"]},
            leeway=5,
        )
        claims = SessionClaims.model_validate(payload)
    except (jwt.InvalidTokenError, ValidationError) as exc:
        raise InvalidSessionTokenError from exc

    if claims.azp is not None and claims.azp not in settings.cors_origin_list:
        raise InvalidSessionTokenError
    return claims


def _get(url: str, secret_key: str) -> bytes:
    request = urllib.request.Request(  # noqa: S310 - URL is the configured https Clerk API
        url,
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(request, timeout=10) as response:  # noqa: S310
        body: bytes = response.read()
        return body


@dataclass(frozen=True)
class ClerkIdentity:
    email: str | None
    display_name: str | None


async def fetch_clerk_identity(clerk_user_id: str) -> ClerkIdentity:
    settings = get_settings()
    url = f"{settings.clerk_api_url}/users/{quote(clerk_user_id, safe='')}"
    try:
        raw = await asyncio.to_thread(_get, url, settings.clerk_secret_key)
        user = _ClerkUser.model_validate_json(raw)
    except (urllib.error.URLError, TimeoutError, ValidationError) as exc:
        raise UpstreamServiceError("Could not load the user from Clerk") from exc

    email = next(
        (
            address.email_address
            for address in user.email_addresses
            if address.id == user.primary_email_address_id
        ),
        None,
    )
    name = " ".join(
        part.strip() for part in (user.first_name, user.last_name) if part and part.strip()
    )
    return ClerkIdentity(email=email, display_name=name or None)
