"""Application settings loaded from environment via pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration.

    JWT_SECRET must be byte-identical to the gateway's — the gateway mints the
    tokens (HS256) and this service only verifies them.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/grubgroup"

    # Auth (shared with the gateway).
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
