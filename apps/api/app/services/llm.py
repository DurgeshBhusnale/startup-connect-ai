from functools import lru_cache

from openai import AsyncOpenAI

from app.config import get_settings


# OpenAI-compatible client (Wardley W11): the provider is swapped via LLM_BASE_URL / GROQ_MODEL.
@lru_cache
def get_llm_client() -> AsyncOpenAI:
    settings = get_settings()
    return AsyncOpenAI(
        api_key=settings.groq_api_key,
        base_url=settings.llm_base_url,
        timeout=settings.llm_timeout_seconds,
        max_retries=1,
    )
