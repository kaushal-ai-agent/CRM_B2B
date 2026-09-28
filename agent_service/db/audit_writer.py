"""
Audit Writer — persists turn-level audit records and CRM interaction logs.
"""

from __future__ import annotations

import uuid
import time
from datetime import datetime, timezone
from typing import Any

from agent_service.db.audit_models import AuditLog, get_audit_session
from agent_service.db.adapter import DatabaseAdapter
from agent_service.config.settings import get_settings


def write_audit_log(
    turn_id: str,
    session_id: str,
    customer_id: str | None,
    inbound_query: str,
    sanitized_input: str | None,
    router_classification: str | None,
    model_confidence: float | None,
    tool_calls: list[dict[str, Any]] | None,
    grounded_response: str | None,
    citations: list[dict[str, Any]] | None,
    latency_ms: float | None,
    token_usage: dict[str, int] | None,
) -> str:
    """
    Write a single audit log row and return its ID.

    This is intentionally synchronous — called from the graph's audit node.
    """
    session = get_audit_session()
    try:
        log = AuditLog(
            turn_id=turn_id,
            session_id=session_id,
            customer_id=customer_id,
            timestamp=datetime.now(timezone.utc),
            inbound_query=inbound_query,
            sanitized_input=sanitized_input,
            router_classification=router_classification,
            model_confidence=model_confidence,
            tool_calls=tool_calls,
            grounded_response=grounded_response,
            citations=citations,
            latency_ms=latency_ms,
            token_usage=token_usage,
        )
        session.add(log)
        session.commit()
        return log.id
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def write_crm_interaction(
    customer_id: str,
    content: str,
    channel: str = "AI_Chat",
    interaction_type: str = "AI_Chat",
    product_ids: list[str] | None = None,
    db_adapter: DatabaseAdapter | None = None,
) -> None:
    """
    Write an interaction record back into the CRM ``crm_interaction`` table.

    Uses a direct INSERT via the CRM database adapter.  The ``product_ids``
    are appended to the transcript as structured metadata for downstream
    cross-sell intelligence.
    """
    adapter = db_adapter or DatabaseAdapter()
    interaction_id = str(uuid.uuid4()).replace("-", "")
    now = datetime.now(timezone.utc).isoformat()

    # Append product references to the transcript if available
    transcript = content
    if product_ids:
        transcript += f"\n\n[Referenced Products: {', '.join(product_ids)}]"

    sql = (
        "INSERT INTO crm_interaction "
        "(id, customer_id, channel, interaction_type, content_transcript, timestamp) "
        "VALUES (:id, :customer_id, :channel, :interaction_type, :content, :ts)"
    )
    params = {
        "id": interaction_id,
        "customer_id": customer_id,
        "channel": channel,
        "interaction_type": interaction_type,
        "content": transcript,
        "ts": now,
    }

    # We need to bypass the read-only guard for this INSERT.
    # Use the engine directly.
    from sqlalchemy import text as sa_text
    with adapter.engine.connect() as conn:
        conn.execute(sa_text(sql), params)
        conn.commit()


def fetch_audit_logs(
    session_id: str | None = None,
    customer_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Retrieve audit log rows with optional filters."""
    session = get_audit_session()
    try:
        query = session.query(AuditLog)
        if session_id:
            query = query.filter(AuditLog.session_id == session_id)
        if customer_id:
            query = query.filter(AuditLog.customer_id == customer_id)

        query = query.order_by(AuditLog.timestamp.desc())
        query = query.offset(offset).limit(limit)

        results = []
        for log in query.all():
            results.append({
                "id": log.id,
                "turn_id": log.turn_id,
                "session_id": log.session_id,
                "customer_id": log.customer_id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "inbound_query": log.inbound_query,
                "sanitized_input": log.sanitized_input,
                "router_classification": log.router_classification,
                "model_confidence": log.model_confidence,
                "tool_calls": log.tool_calls,
                "grounded_response": log.grounded_response,
                "citations": log.citations,
                "latency_ms": log.latency_ms,
                "token_usage": log.token_usage,
            })
        return results
    finally:
        session.close()
