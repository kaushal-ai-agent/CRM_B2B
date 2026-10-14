"""
Audit Node — final node in the graph that persists the full turn record.

Writes to:
1. The dedicated audit database (``agent_audit.db``)
2. The CRM interactions table (``crm_interaction``) when a customer_id is known
"""

from __future__ import annotations

import logging
import time
from typing import Any

from agent_service.db.audit_writer import write_audit_log, write_crm_interaction
from agent_service.graph.state import AgentState

logger = logging.getLogger(__name__)


def audit_node(state: AgentState) -> dict[str, Any]:
    """
    Persist audit + CRM interaction records.

    This is the terminal node — it does not modify the response.
    """
    turn_start = state.get("turn_start_time", time.perf_counter())
    latency_ms = (time.perf_counter() - turn_start) * 1000.0

    turn_id = state.get("turn_id", "")
    session_id = state.get("session_id", "")
    customer_id = state.get("customer_id", "")
    messages = state.get("messages", [])

    # Extract the original inbound query (first HumanMessage)
    inbound = ""
    for m in messages:
        if hasattr(m, "type") and m.type == "human":
            inbound = m.content
            break

    # ── 1. Write audit log ───────────────────────────────────────────────
    try:
        write_audit_log(
            turn_id=turn_id,
            session_id=session_id,
            customer_id=customer_id or None,
            inbound_query=inbound,
            sanitized_input=inbound,  # already sanitized by guardrails
            router_classification=state.get("intent"),
            model_confidence=state.get("confidence"),
            tool_calls=state.get("tool_call_log"),
            grounded_response=state.get("response_text", ""),
            citations=state.get("citations"),
            latency_ms=round(latency_ms, 2),
            token_usage=state.get("token_usage"),
            execution_trace=state.get("execution_trace"),
        )
    except Exception as exc:
        logger.error("Audit log write failed: %s", exc)

    # ── 2. Write CRM interaction (if customer_id is known) ───────────────
    if customer_id:
        try:
            # Collect product IDs from retrieved records
            product_ids = [
                str(r.get("id", ""))
                for r in state.get("retrieved_records", [])
                if r.get("id")
            ]

            response_text = state.get("response_text", "")
            transcript = f"Customer: {inbound}\nAgent: {response_text}"

            write_crm_interaction(
                customer_id=customer_id,
                content=transcript,
                channel="AI_Chat",
                interaction_type="AI_Chat",
                product_ids=product_ids if product_ids else None,
            )
        except Exception as exc:
            logger.error("CRM interaction write failed: %s", exc)

    return {}
