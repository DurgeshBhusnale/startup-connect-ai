"""Supabase Storage (REST) for post images: private bucket, service-role access, signed URLs."""

import asyncio
import json
import urllib.error
import urllib.request
from urllib.parse import quote

from app.config import get_settings
from app.errors import UpstreamServiceError

SIGNED_URL_TTL_SECONDS = 3600
USER_AGENT = "startup-connect-api/0.1"


def _call(
    method: str,
    url: str,
    key: str,
    body: bytes | None = None,
    content_type: str | None = None,
    extra_headers: dict[str, str] | None = None,
) -> bytes:
    headers = {"Authorization": f"Bearer {key}", "apikey": key, "User-Agent": USER_AGENT}
    if content_type:
        headers["Content-Type"] = content_type
    headers.update(extra_headers or {})
    request = urllib.request.Request(  # noqa: S310 - URL is the configured https Supabase project
        url, data=body, method=method, headers=headers
    )
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310
        data: bytes = response.read()
        return data


def _config() -> tuple[str, str, str]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise UpstreamServiceError("Supabase Storage is not configured")
    return (
        settings.supabase_url.rstrip("/"),
        settings.supabase_service_role_key,
        settings.post_media_bucket,
    )


def _encoded(path: str) -> str:
    return "/".join(quote(part, safe="") for part in path.split("/"))


async def upload_object(path: str, data: bytes, content_type: str) -> None:
    base, key, bucket = _config()
    url = f"{base}/storage/v1/object/{bucket}/{_encoded(path)}"
    try:
        await asyncio.to_thread(
            _call,
            "POST",
            url,
            key,
            data,
            content_type,
            {"x-upsert": "false", "cache-control": "3600"},
        )
    except (urllib.error.URLError, TimeoutError) as exc:
        raise UpstreamServiceError("Could not store the image") from exc


async def signed_urls(paths: list[str]) -> dict[str, str]:
    if not paths:
        return {}
    base, key, bucket = _config()
    body = json.dumps({"expiresIn": SIGNED_URL_TTL_SECONDS, "paths": paths}).encode()
    try:
        raw = await asyncio.to_thread(
            _call, "POST", f"{base}/storage/v1/object/sign/{bucket}", key, body, "application/json"
        )
        entries = json.loads(raw)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise UpstreamServiceError("Could not sign image URLs") from exc
    urls: dict[str, str] = {}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        path, signed = entry.get("path"), entry.get("signedURL")
        if isinstance(path, str) and isinstance(signed, str):
            urls[path] = f"{base}/storage/v1{signed}"
    return urls


async def delete_objects(paths: list[str]) -> None:
    if not paths:
        return
    base, key, bucket = _config()
    body = json.dumps({"prefixes": paths}).encode()
    try:
        await asyncio.to_thread(
            _call, "DELETE", f"{base}/storage/v1/object/{bucket}", key, body, "application/json"
        )
    except (urllib.error.URLError, TimeoutError) as exc:
        raise UpstreamServiceError("Could not delete stored images") from exc
