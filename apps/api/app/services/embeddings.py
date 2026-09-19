"""MiniLM embeddings, either in-process (torch) or through a hosted embedding API.

Railway runs the model in-process. Serverless hosts (Vercel) can't carry torch, so setting
EMBEDDINGS_API_URL switches to a hosted API that returns vectors for the same model, keeping the
384-dimension vectors in Qdrant compatible either way. Callers already degrade to structured-only
ranking if this module raises (M7 AC "vector DB timeout" path).
"""

import asyncio
import json
import math
import urllib.error
import urllib.request
from functools import lru_cache
from typing import Any

from app.config import get_settings
from app.errors import UpstreamServiceError

EMBEDDING_DIM = 384
USER_AGENT = "startup-connect-api/0.1"


def uses_remote_api() -> bool:
    return bool(get_settings().embeddings_api_url)


@lru_cache
def _model() -> Any:
    from sentence_transformers import SentenceTransformer  # imported lazily: torch is optional

    return SentenceTransformer(get_settings().embedding_model, device="cpu")


def warm_up() -> None:
    """Loads the local model ahead of the first request; a no-op when a hosted API is used."""
    if not uses_remote_api():
        _model()


def _encode(texts: list[str]) -> list[list[float]]:
    vectors = _model().encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    return [[float(value) for value in row] for row in vectors]


def _normalize(vector: list[float]) -> list[float]:
    length = math.sqrt(sum(value * value for value in vector))
    return [value / length for value in vector] if length else vector


def _mean_pool(rows: list[Any]) -> list[float]:
    """Token vectors -> one sentence vector, for APIs that return per-token output."""
    columns = list(zip(*rows, strict=True))
    return [sum(float(value) for value in column) / len(column) for column in columns]


def _as_vector(item: Any) -> list[float]:
    if isinstance(item, list) and item and isinstance(item[0], list):
        return _normalize(_mean_pool(item))
    if isinstance(item, list):
        return _normalize([float(value) for value in item])
    raise UpstreamServiceError("Embedding API returned an unexpected shape")


def _request(texts: list[str]) -> list[list[float]]:
    settings = get_settings()
    payload = json.dumps({"inputs": texts, "options": {"wait_for_model": True}}).encode()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    if settings.embeddings_api_key:
        headers["Authorization"] = f"Bearer {settings.embeddings_api_key}"
    request = urllib.request.Request(  # noqa: S310 - URL comes from configuration
        settings.embeddings_api_url, data=payload, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(  # noqa: S310
            request, timeout=settings.embeddings_timeout_seconds
        ) as response:
            body = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise UpstreamServiceError("Embedding API is unavailable") from exc
    if not isinstance(body, list) or len(body) != len(texts):
        raise UpstreamServiceError("Embedding API returned an unexpected response")
    vectors = [_as_vector(item) for item in body]
    if any(len(vector) != EMBEDDING_DIM for vector in vectors):
        raise UpstreamServiceError("Embedding API returned the wrong vector size")
    return vectors


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if uses_remote_api():
        return await asyncio.to_thread(_request, texts)
    return await asyncio.to_thread(_encode, texts)
