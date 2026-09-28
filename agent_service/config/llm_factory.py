"""
LLM Factory — returns ChatOpenAI instances pre-configured for OpenRouter.

Two factory helpers:
* ``get_router_llm()``   → fast, deterministic model for intent classification
* ``get_synthesis_llm()`` → high-precision model for grounded response synthesis
"""

from __future__ import annotations

from langchain_openai import ChatOpenAI

from agent_service.config.settings import get_settings


def _build_llm(
    model_name: str,
    temperature: float,
    max_tokens: int | None = None,
) -> ChatOpenAI:
    """Internal helper that constructs a ``ChatOpenAI`` pointed at OpenRouter."""
    settings = get_settings()

    return ChatOpenAI(
        model=model_name,
        openai_api_key=settings.OPENROUTER_API_KEY,
        openai_api_base=settings.OPENROUTER_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens,
        request_timeout=settings.LLM_REQUEST_TIMEOUT,
        default_headers={
            "HTTP-Referer": settings.HTTP_REFERER,
            "X-Title": settings.X_TITLE,
        },
    )


def get_router_llm() -> ChatOpenAI:
    """Return the lightweight LLM used for intent classification."""
    settings = get_settings()
    return _build_llm(
        model_name=settings.ROUTER_MODEL_NAME,
        temperature=settings.ROUTER_TEMPERATURE,
        max_tokens=256,
    )


def get_synthesis_llm() -> ChatOpenAI:
    """Return the high-precision LLM used for grounded response synthesis."""
    settings = get_settings()
    return _build_llm(
        model_name=settings.SYNTHESIS_MODEL_NAME,
        temperature=settings.SYNTHESIS_TEMPERATURE,
        max_tokens=1024,
    )
