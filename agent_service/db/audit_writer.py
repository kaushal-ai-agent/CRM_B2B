"""
Audit Writer — persists turn-level audit records and CRM interaction logs.
"""

from __future__ import annotations

import uuid
import time
from datetime import datetime, timezone
from typing import Any

from agent_service.db.audit_models import AuditLog, ModelPricingConfig, get_audit_session
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
    execution_trace: list[dict[str, Any]] | None = None,
) -> str:
    """
    Write a single audit log row and return its ID.

    This is intentionally synchronous — called from the graph's audit node.
    """
    session = get_audit_session()
    try:
        # Calculate cost
        if token_usage:
            pricing = session.query(ModelPricingConfig).first()
            if pricing:
                p_tokens = token_usage.get("prompt_tokens", 0)
                c_tokens = token_usage.get("completion_tokens", 0)
                r_tokens = token_usage.get("reasoning_tokens", 0)
                
                cost = (p_tokens * pricing.input_price_per_1m / 1000000) + \
                       ((c_tokens - r_tokens) * pricing.output_price_per_1m / 1000000) + \
                       (r_tokens * pricing.thinking_price_per_1m / 1000000)
                token_usage["total_cost"] = cost
                token_usage["currency"] = pricing.currency

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
            execution_trace=execution_trace,
        )

        for attempt in range(3):
            try:
                session.add(log)
                session.commit()
                return log.id
            except Exception as e:
                session.rollback()
                if "database is locked" in str(e).lower() and attempt < 2:
                    time.sleep(0.5 * (attempt + 1))
                    continue
                raise
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

        logs = query.all()
        
        # Build set of unique customer IDs and IG session IDs
        cust_ids = set()
        ig_sids = set()
        for log in logs:
            if log.customer_id:
                cust_ids.add(log.customer_id)
            if log.session_id and log.session_id.startswith("ig_"):
                ig_sids.add(log.session_id.replace("ig_", ""))
                
        # Resolve names using CRM DB
        customer_names = {}
        ig_usernames = {}
        
        try:
            from agent_service.channels.instagram_client import _ensure_django
            _ensure_django()
            from crm.models import Customer, InstagramCustomerLink
            
            if cust_ids:
                customers = Customer.objects.filter(id__in=cust_ids)
                customer_names = {str(c.id): c.company_name for c in customers}
                
            if ig_sids:
                links = InstagramCustomerLink.objects.filter(instagram_id__in=ig_sids)
                ig_usernames = {link.instagram_id: link.instagram_username for link in links if link.instagram_username}
        except Exception as e:
            # Safe fallback if django resolution fails
            import logging
            logging.getLogger(__name__).warning("Failed to resolve CRM names for audit logs: %s", e)

        results = []
        for log in logs:
            customer_name = customer_names.get(str(log.customer_id)) if log.customer_id else None
            ig_username = None
            if log.session_id and log.session_id.startswith("ig_"):
                igsid = log.session_id.replace("ig_", "")
                ig_username = ig_usernames.get(igsid)
                
            results.append({
                "id": log.id,
                "turn_id": log.turn_id,
                "session_id": log.session_id,
                "customer_id": log.customer_id,
                "customer_name": customer_name,
                "instagram_username": ig_username,
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
                "execution_trace": log.execution_trace,
            })
        return results
    finally:
        session.close()
