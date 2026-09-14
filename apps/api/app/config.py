from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# Local dev shares the repo-root .env; deployed environments inject real env vars.
REPO_ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(REPO_ROOT_ENV, ".env"), extra="ignore")

    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "info"
    cors_origins: str = "http://localhost:3000"

    database_url: str
    clerk_secret_key: str
    clerk_api_url: str = "https://api.clerk.com/v1"
    consent_policy_version: str = "2026-09-13"

    groq_api_key: str
    groq_model: str = "openai/gpt-oss-120b"
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_timeout_seconds: float = 45.0
    explanation_timeout_seconds: float = 12.0
    # Sent as reasoning_effort for reasoning models (gpt-oss); leave blank for models without it.
    llm_reasoning_effort: str = "low"

    # Blank QDRANT_URL uses embedded on-disk Qdrant (local dev); set it to use Qdrant Cloud.
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "profiles"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    match_refresh_hours: int = 12

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
