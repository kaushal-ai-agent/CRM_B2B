"""
Agent Service Configuration — pydantic-settings loader.

Reads all tunables from environment variables or a `.env` file located
in the ``agent_service/`` directory.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------------------
# Resolve paths relative to the agent_service package root
# ---------------------------------------------------------------------------
_PACKAGE_DIR = Path(__file__).resolve().parent.parent          # agent_service/
_PROJECT_ROOT = _PACKAGE_DIR.parent                            # CRM_B2Btrader/


class AgentSettings(BaseSettings):
    """Central configuration for the Inventory-Grounded Agent."""

    model_config = SettingsConfigDict(
        env_file=str(_PACKAGE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── OpenRouter LLM Provider ──────────────────────────────────────────
    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Fast / cheap model for intent classification
    ROUTER_MODEL_NAME: str = "openai/gpt-4o-mini"
    # High-precision model for grounded response synthesis
    SYNTHESIS_MODEL_NAME: str = "openai/gpt-4o"

    # Custom headers recommended by OpenRouter docs
    HTTP_REFERER: str = "https://crm-b2btrader.local"
    X_TITLE: str = "CRM_B2Btrader Agent"

    # ── Database Connections ─────────────────────────────────────────────
    CRM_DATABASE_URL: str = f"sqlite:///{_PROJECT_ROOT / 'db.sqlite3'}"
    AUDIT_DATABASE_URL: str = f"sqlite:///{_PACKAGE_DIR / 'agent_audit.db'}"

    # Path to the YAML schema descriptor consumed by the schema-agnostic
    # database tools at runtime.
    SCHEMA_CONFIG_PATH: str = str(_PACKAGE_DIR / "db" / "schema_config.yaml")

    # ── Routing & Guardrails ─────────────────────────────────────────────
    CONFIDENCE_THRESHOLD: float = 0.80
    MAX_CONTEXT_TURNS: int = 5
    MAX_GRAPH_ITERATIONS: int = 3
    QUERY_TIMEOUT_SECONDS: int = 5

    # ── LLM Parameters ──────────────────────────────────────────────────
    ROUTER_TEMPERATURE: float = 0.0
    SYNTHESIS_TEMPERATURE: float = 0.1
    LLM_REQUEST_TIMEOUT: int = 30

    # ── Server ───────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8100

    # ── Instagram Channel ────────────────────────────────────────────────
    IG_ENABLED: bool = False
    IG_APP_ID: str
    IG_APP_SECRET: str
    IG_VERIFY_TOKEN: str
    IG_ACCESS_TOKEN: str
    IG_ACCOUNT_ID: str
    IG_API_BASE_URL: str = "https://graph.instagram.com"
    IG_API_VERSION: str = "v22.0"
    IG_ONBOARDING_REQUIRED: bool = True

    # ── Escalation ───────────────────────────────────────────────────────
    AGENT_CONFIDENCE_THRESHOLD: float = 0.70


@lru_cache(maxsize=1)
def get_settings() -> AgentSettings:
    """Return a cached singleton of the application settings."""
    return AgentSettings()
