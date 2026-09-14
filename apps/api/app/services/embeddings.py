import asyncio
from functools import lru_cache

from sentence_transformers import SentenceTransformer

from app.config import get_settings

EMBEDDING_DIM = 384


@lru_cache
def _model() -> SentenceTransformer:
    return SentenceTransformer(get_settings().embedding_model, device="cpu")


def warm_up() -> None:
    _model()


def _encode(texts: list[str]) -> list[list[float]]:
    vectors = _model().encode(texts, normalize_embeddings=True, convert_to_numpy=True)
    return [[float(value) for value in row] for row in vectors]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    return await asyncio.to_thread(_encode, texts)
