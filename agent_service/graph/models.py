"""
Pydantic request / response models for the Agent Service API.
"""

from __future__ import annotations

import enum
from typing import Any

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Intent Classification
# ---------------------------------------------------------------------------

class IntentClassification(str, enum.Enum):
    PRODUCT_STOCK_QUERY = "PRODUCT_STOCK_QUERY"
    FAQ_QUERY = "FAQ_QUERY"
    ORDERING_INTENT = "ORDERING_INTENT"
    ESCALATION = "ESCALATION"
    GENERAL_CHAT = "GENERAL_CHAT"


# ---------------------------------------------------------------------------
# API Request
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """Inbound customer message payload."""

    message_text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The customer's message text.",
    )
    session_id: str = Field(
        ...,
        description="Unique conversation session identifier.",
    )
    customer_id: str | None = Field(
        default=None,
        description="CRM customer UUID, if known.",
    )
    channel_type: str = Field(
        default="AI_Chat",
        description="Communication channel (AI_Chat, WhatsApp, Email).",
    )
    post_reference_id: str | None = Field(
        default=None,
        description="Optional reference to a social-media / catalogue post.",
    )


# ---------------------------------------------------------------------------
# API Response
# ---------------------------------------------------------------------------

class Citation(BaseModel):
    """Provenance record tying a response claim to a database record."""

    source_table: str
    record_id: str
    field_values: dict[str, Any]
    lookup_time: str


class ChatResponse(BaseModel):
    """Outbound agent response payload."""

    response_text: str
    citations: list[Citation] = Field(default_factory=list)
    session_id: str
    turn_id: str
    intent: str | None = None
    confidence: float | None = None
    escalation_flag: bool = False


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

class EvalRequest(BaseModel):
    """Request body for triggering a DeepEval run."""

    test_suite_path: str | None = Field(
        default=None,
        description="Optional path to a YAML/JSON test suite file.",
    )


class EvalResult(BaseModel):
    """Summary result from a DeepEval run."""

    total_tests: int
    passed: int
    failed: int
    details: list[dict[str, Any]] = Field(default_factory=list)
