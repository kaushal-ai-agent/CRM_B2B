"""
AgentState — the TypedDict flowing through every LangGraph node.
"""

from __future__ import annotations

from typing import Any, TypedDict

from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """
    Mutable state bag carried across all LangGraph nodes.

    Every key here can be read and written by any node in the graph.
    """

    # ── Conversation ─────────────────────────────────────────────────────
    messages: list[BaseMessage]

    # ── Entity extraction ────────────────────────────────────────────────
    extracted_product_refs: list[str]

    # ── Database results ─────────────────────────────────────────────────
    retrieved_records: list[dict[str, Any]]
    alternative_records: list[dict[str, Any]]

    # ── Citations / provenance ───────────────────────────────────────────
    citations: list[dict[str, Any]]

    # ── Routing ──────────────────────────────────────────────────────────
    intent: str
    confidence: float
    escalation_flag: bool

    # ── Session metadata ─────────────────────────────────────────────────
    turn_id: str
    session_id: str
    customer_id: str

    # ── Guard counters ───────────────────────────────────────────────────
    iteration_count: int

    # ── Timing ───────────────────────────────────────────────────────────
    turn_start_time: float

    # ── Tool call log (for audit) ────────────────────────────────────────
    tool_call_log: list[dict[str, Any]]

    # ── Final response ───────────────────────────────────────────────────
    response_text: str

    # ── Token Tracking ───────────────────────────────────────────────────
    token_usage: dict[str, Any]

    # ── Execution Lifecycle Trace (for Observability) ──────────────────────
    execution_trace: list[dict[str, Any]]
