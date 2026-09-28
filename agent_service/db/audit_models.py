"""
Audit Store ORM — SQLAlchemy models for the dedicated audit database.

Every agent conversation turn is persisted here with full provenance:
routing decisions, tool calls, SQL executed, grounded response, citations,
latencies, and token usage.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, JSON, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from agent_service.config.settings import get_settings

Base = declarative_base()


class AuditLog(Base):  # type: ignore[misc]
    """One row per agent conversation turn."""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    turn_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    customer_id = Column(String(36), nullable=True, index=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Inbound
    inbound_query = Column(Text, nullable=False)
    sanitized_input = Column(Text, nullable=True)

    # Routing
    router_classification = Column(String(50), nullable=True)
    model_confidence = Column(Float, nullable=True)

    # Tool calls  (stored as JSON list)
    tool_calls = Column(JSON, nullable=True)
    # Example element:
    # {
    #   "tool_name": "query_live_product",
    #   "input_args": {"search_term": "QBE-751"},
    #   "sql_executed": "SELECT ... WHERE sku_code = :sku",
    #   "raw_output": [{"product_name": "...", ...}]
    # }

    # Response
    grounded_response = Column(Text, nullable=True)
    citations = Column(JSON, nullable=True)
    # Example:
    # [{"source_table": "crm_product", "record_id": "abc-123",
    #   "field_values": {"selling_price": 3806.63}, "lookup_time": "2026-..."}]

    # Observability
    latency_ms = Column(Float, nullable=True)
    token_usage = Column(JSON, nullable=True)
    # Example: {"router_tokens": 150, "synthesis_tokens": 320}


# ---------------------------------------------------------------------------
# Engine / session helpers
# ---------------------------------------------------------------------------

_engine = None
_SessionLocal = None


def _get_audit_engine():
    global _engine
    if _engine is None:
        url = get_settings().AUDIT_DATABASE_URL
        connect_args = {}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        _engine = create_engine(url, connect_args=connect_args)
        Base.metadata.create_all(_engine)
    return _engine


def get_audit_session():
    """Return a new SQLAlchemy session bound to the audit database."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=_get_audit_engine())
    return _SessionLocal()


def init_audit_db() -> None:
    """Ensure the audit tables exist (idempotent)."""
    _get_audit_engine()
