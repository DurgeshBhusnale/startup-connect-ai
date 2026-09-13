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

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
