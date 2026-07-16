"""Application settings loaded from environment via pydantic-settings."""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed settings. Reads from the ai_service .env file."""

    # Database (asyncpg driver). Schema is owned/migrated by Prisma in the
    # gateway; ai_service holds a read-side SQLModel mirror (no create_all).
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/grubgroup"

    # Embeddings (active): OpenRouter / Qwen, 1024-dim.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    embedding_model: str = "qwen/qwen3-embedding-8b"

    # Active LLM chat: Salesforce internal model gateway (OpenAI-compatible).
    salesforce_api_key: str = ""  # env SALESFORCE_API_KEY
    salesforce_base_url: str = (
        "https://eng-ai-model-gateway.sfproxy.devx-preprod.aws-esvc1-useast2.aws.sfdc.cl"
    )
    node_extra_ca_certs: str = ""  # env NODE_EXTRA_CA_CERTS (corporate CA bundle path)
    # Chat model name. Reads SALESFORCE_LLM_MODEL (active) first, then falls back
    # to LLM_MODEL (the commented OpenRouter/DeepSeek deploy path in llm/client.py).
    llm_model: str = Field(
        default="claude-sonnet-4-5-20250929",
        validation_alias=AliasChoices("SALESFORCE_LLM_MODEL", "LLM_MODEL"),
    )

    # Shared internal secret guarding service-to-service endpoints (must match
    # the gateway JWT_SECRET).
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"

    # Geocodio API key — turns a member's named location into lat/lon on the
    # conversational analyze path. Accepts either GEOCODIO_API_KEY or the
    # gateway's GEOCODIO_API name. Optional: absent key degrades to null coords.
    geocodio_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GEOCODIO_API_KEY", "GEOCODIO_API"),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
