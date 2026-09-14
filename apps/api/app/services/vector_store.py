from functools import lru_cache
from pathlib import Path
from typing import Any, cast
from uuid import UUID

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    Filter,
    HasIdCondition,
    PointIdsList,
    PointStruct,
    VectorParams,
)

from app.config import get_settings
from app.services.embeddings import EMBEDDING_DIM

LOCAL_PATH = Path(__file__).resolve().parents[2] / ".qdrant-local"

_collection_ready = False


@lru_cache
def _client() -> AsyncQdrantClient:
    settings = get_settings()
    if settings.qdrant_url:
        return AsyncQdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key or None, timeout=5
        )
    # Local dev: embedded on-disk Qdrant — same engine and API as Qdrant Cloud (Wardley W1).
    return AsyncQdrantClient(path=str(LOCAL_PATH))


async def _collection() -> str:
    global _collection_ready
    name = get_settings().qdrant_collection
    if not _collection_ready:
        client = _client()
        if not await client.collection_exists(name):
            await client.create_collection(
                name, vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE)
            )
        _collection_ready = True
    return name


async def embedded_versions(profile_ids: list[UUID]) -> dict[UUID, int]:
    if not profile_ids:
        return {}
    name = await _collection()
    points = await _client().retrieve(
        name, ids=[str(profile_id) for profile_id in profile_ids], with_payload=True
    )
    versions: dict[UUID, int] = {}
    for point in points:
        version = (point.payload or {}).get("embedding_v")
        if isinstance(version, int):
            versions[UUID(str(point.id))] = version
    return versions


async def upsert_vectors(items: list[tuple[UUID, list[float], dict[str, Any]]]) -> None:
    if not items:
        return
    name = await _collection()
    await _client().upsert(
        name,
        points=[
            PointStruct(id=str(profile_id), vector=vector, payload=payload)
            for profile_id, vector, payload in items
        ],
    )


async def delete_vectors(profile_ids: list[UUID]) -> None:
    if not profile_ids:
        return
    name = await _collection()
    await _client().delete(
        name, points_selector=PointIdsList(points=[str(profile_id) for profile_id in profile_ids])
    )


async def similarities(query_profile_id: UUID, candidate_ids: list[UUID]) -> dict[UUID, float]:
    if not candidate_ids:
        return {}
    name = await _collection()
    query_points = await _client().retrieve(name, ids=[str(query_profile_id)], with_vectors=True)
    if not query_points or not isinstance(query_points[0].vector, list):
        return {}
    query_vector = cast(list[float], query_points[0].vector)
    response = await _client().query_points(
        name,
        query=query_vector,
        query_filter=Filter(
            must=[HasIdCondition(has_id=[str(candidate_id) for candidate_id in candidate_ids])]
        ),
        limit=len(candidate_ids),
    )
    return {UUID(str(point.id)): float(point.score) for point in response.points}
