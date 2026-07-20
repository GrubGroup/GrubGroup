"""Async LLM client — Salesforce model gateway (active) / OpenRouter DeepSeek (deploy)."""

from functools import lru_cache
from typing import Any

import httpx
from openai import AsyncOpenAI

from app.core.config import settings


@lru_cache(maxsize=1)
def get_llm_client() -> AsyncOpenAI:
    """Build the active LLM client — OpenRouter/DeepSeek (OpenAI-compatible).

    Local run routes LLM calls through OpenRouter (the only creds present in
    .env: OPENROUTER_API_KEY / OPENROUTER_BASE_URL). settings.llm_model falls back
    to LLM_MODEL (deepseek/deepseek-chat) when SALESFORCE_LLM_MODEL is unset.
    """
    return AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )

    # --- SALESFORCE internal gateway: comment out the OpenRouter client above and
    # --- uncomment this block to route LLM calls through the Salesforce gateway.
    # --- Uses the corporate CA bundle from NODE_EXTRA_CA_CERTS when set.
    # return AsyncOpenAI(
    #     api_key=settings.salesforce_api_key,
    #     base_url=settings.salesforce_base_url,
    #     http_client=httpx.AsyncClient(
    #         verify=settings.node_extra_ca_certs or True,
    #     ),
    # )


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    temperature: float = 0.2,
    response_format: dict[str, Any] | None = None,
) -> str:
    """Run a chat completion and return the assistant message content.

    `model` defaults to settings.llm_model. `response_format` (e.g. JSON mode) is
    passed through when provided; providers that ignore it simply return text.
    """
    kwargs: dict[str, Any] = {
        "model": model or settings.llm_model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format

    response = await get_llm_client().chat.completions.create(**kwargs)
    return response.choices[0].message.content
