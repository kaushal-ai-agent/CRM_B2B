"""
Synthesis Node — grounded response generation with anti-hallucination guardrails.

The LLM is **strictly prohibited** from quoting any price, stock level, or
product detail that does not appear in ``retrieved_records``.  Deterministic
fallback templates are used when the database lookup yields zero results or
when an escalation is required.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from agent_service.config.llm_factory import get_synthesis_llm
from agent_service.config.settings import get_settings
from agent_service.graph.state import AgentState
from agent_service.db.audit_models import get_audit_session, PromptTemplate

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Fallback templates (deterministic — no LLM needed)
# ---------------------------------------------------------------------------

_FALLBACK_NO_RESULTS = (
    "I searched our live inventory but could not find a matching product. "
    "Could you double-check the product name or SKU code and try again? "
    "You can also contact our sales team for assistance."
)

_FALLBACK_DB_ERROR = (
    "I'm sorry, I'm having trouble accessing our inventory system right now. "
    "Please try again in a moment, or contact our sales team directly."
)

_FALLBACK_ESCALATION = (
    "I'll connect you with a member of our sales team who can help you "
    "with this request. A human agent will follow up shortly."
)

_FALLBACK_INJECTION = (
    "I can only assist with product enquiries, stock availability, and "
    "order-related questions.  I'm not able to modify prices or bypass "
    "our catalogue policies.  Here is the current catalogue information."
)


# ---------------------------------------------------------------------------
# Synthesis system prompt
# ---------------------------------------------------------------------------

_SYNTHESIS_SYSTEM_PROMPT = """\
You are the AI sales assistant for a B2B industrial-parts distributor.

## ABSOLUTE RULES — ZERO TOLERANCE
1. You MUST ONLY quote prices, stock quantities, and product details that
   appear **exactly** in the RETRIEVED DATA section below.
2. You MUST NEVER invent, estimate, round, or guess any price or stock number.
3. If a product is out of stock, state so plainly and present the alternative
   products from the ALTERNATIVES section.
4. Always mention the SKU code when referring to a product.
5. Be professional, concise, and helpful.
6. NEVER disclose landed_cost — that is internal confidential data.
7. Do NOT offer discounts or special pricing. Only quote catalogue prices.

## RETRIEVED DATA (from live database query)
{retrieved_data}

## ALTERNATIVES (in-stock substitutes, if primary product is out of stock)
{alternatives_data}

## CUSTOMER MESSAGE
{customer_message}

Respond naturally to the customer.  If the data is empty, say you could not
find matching products and ask for clarification.
"""


# ---------------------------------------------------------------------------
# Node function
# ---------------------------------------------------------------------------

def synthesis_node(state: AgentState) -> dict[str, Any]:
    """
    Synthesise a grounded natural-language response.

    If escalation or empty results, uses deterministic templates.
    Otherwise calls the synthesis LLM with strict grounding prompt.

    Fail-safe: wraps all logic in try/except — on any unhandled error,
    returns a safe fallback response and sets escalation_flag.

    Updates:
        response_text, messages (appends AIMessage), escalation_flag
    """
    try:
        return _synthesis_inner(state)
    except Exception as exc:
        logger.exception("Synthesis node failed — triggering fail-safe: %s", exc)
        messages = list(state.get("messages", []))
        messages.append(AIMessage(content=_FALLBACK_DB_ERROR))
        return {
            "response_text": _FALLBACK_DB_ERROR,
            "messages": messages,
            "escalation_flag": True,
        }


def _synthesis_inner(state: AgentState) -> dict[str, Any]:
    """Inner synthesis logic (extracted for fail-safe wrapper)."""
    escalation = state.get("escalation_flag", False)
    retrieved = state.get("retrieved_records", [])
    alternatives = state.get("alternative_records", [])
    messages = list(state.get("messages", []))
    intent = state.get("intent", "GENERAL_CHAT")

    # ── Deterministic fast-paths ─────────────────────────────────────────

    # Escalation
    if escalation and intent == "ESCALATION":
        escalation_text = _FALLBACK_ESCALATION
        session = get_audit_session()
        try:
            active_prompt = session.query(PromptTemplate).filter_by(
                node_name="escalation_node", is_active=True
            ).first()
            if active_prompt and active_prompt.system_prompt:
                escalation_text = active_prompt.system_prompt
        except Exception as exc:
            logger.error("Failed to fetch escalation prompt: %s", exc)
        finally:
            session.close()
        return _deterministic_response(escalation_text, messages, state, "Escalation Triggered")

    # Product query but no data retrieved
    if intent in ("PRODUCT_STOCK_QUERY", "ORDERING_INTENT") and not retrieved:
        # Check if there were tool errors
        tool_log = state.get("tool_call_log", [])
        has_errors = any("error" in tc for tc in tool_log)
        if has_errors:
            return _deterministic_response(_FALLBACK_DB_ERROR, messages, state, "Database Error")
        return _deterministic_response(_FALLBACK_NO_RESULTS, messages, state, "Product Not Found")

    # General chat / FAQ — still use the LLM but without grounding data
    if intent in ("GENERAL_CHAT", "FAQ_QUERY") and not retrieved:
        return _llm_response_no_data(state)

    # ── Grounded LLM synthesis ───────────────────────────────────────────

    # Prepare data for the prompt
    safe_retrieved = _sanitise_for_prompt(retrieved)
    safe_alternatives = _sanitise_for_prompt(alternatives) if alternatives else "None"

    customer_msg = ""
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            customer_msg = m.content
            break

    # Fetch system prompt from DB
    session = get_audit_session()
    try:
        active_prompt = session.query(PromptTemplate).filter_by(
            node_name="synthesis_node", is_active=True
        ).first()
        system_prompt_template = active_prompt.system_prompt if active_prompt else _SYNTHESIS_SYSTEM_PROMPT
    except Exception as exc:
        logger.error("Failed to fetch synthesis prompt: %s", exc)
        system_prompt_template = _SYNTHESIS_SYSTEM_PROMPT
    finally:
        session.close()

    prompt = system_prompt_template.format(
        retrieved_data=safe_retrieved,
        alternatives_data=safe_alternatives,
        customer_message=customer_msg,
    )

    import time
    start_time = time.perf_counter()
    llm = None
    prompt_t = 0
    completion_t = 0
    reasoning_t = 0

    try:
        llm = get_synthesis_llm()
        response = llm.invoke([SystemMessage(content=prompt)])
        text = response.content.strip()
    except Exception as exc:
        logger.error("Synthesis LLM failed: %s", exc)
        text = _FALLBACK_DB_ERROR

    latency_ms = (time.perf_counter() - start_time) * 1000.0

    token_usage = state.get("token_usage", {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "reasoning_tokens": 0,
        "router_tokens": 0,
        "synthesis_tokens": 0,
    })
    if 'response' in locals() and hasattr(response, 'response_metadata'):
        usage_metadata = response.response_metadata.get("token_usage", {})
        prompt_t = usage_metadata.get("prompt_tokens", 0)
        completion_t = usage_metadata.get("completion_tokens", 0)
        reasoning_t = (
            usage_metadata.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
            or usage_metadata.get("reasoning_tokens", 0)
        )
        token_usage["prompt_tokens"] += prompt_t
        token_usage["completion_tokens"] += completion_t
        token_usage["reasoning_tokens"] += reasoning_t
        token_usage["synthesis_tokens"] += (prompt_t + completion_t)

    settings = get_settings()
    model_name = getattr(llm, "model_name", None) or getattr(llm, "model", None) or getattr(settings, "SYNTHESIS_MODEL_NAME", "openai/gpt-4o-mini")

    trace_step = {
        "step": "synthesis",
        "step_name": "Grounded Response Generation",
        "node": "synthesis_node",
        "type": "grounded_llm",
        "model": str(model_name),
        "system_prompt": prompt,
        "injected_data": {
            "retrieved_records": safe_retrieved,
            "alternative_records": safe_alternatives,
        },
        "customer_message": customer_msg,
        "raw_llm_output": text,
        "latency_ms": round(latency_ms, 2),
        "token_usage": {
            "prompt_tokens": prompt_t,
            "completion_tokens": completion_t,
            "reasoning_tokens": reasoning_t,
        },
    }

    execution_trace = list(state.get("execution_trace", [])) + [trace_step]
    messages.append(AIMessage(content=text))
    return {
        "response_text": text,
        "messages": messages,
        "token_usage": token_usage,
        "execution_trace": execution_trace,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _deterministic_response(text: str, messages: list, state: AgentState | None = None, reason: str = "Fallback") -> dict[str, Any]:
    messages = list(messages)
    messages.append(AIMessage(content=text))
    
    trace_step = {
        "step": "synthesis",
        "step_name": f"Deterministic Response ({reason})",
        "node": "synthesis_node",
        "type": "deterministic",
        "model": "rule_based_fallback",
        "system_prompt": None,
        "raw_llm_output": text,
        "latency_ms": 0.0,
        "token_usage": {"prompt_tokens": 0, "completion_tokens": 0, "reasoning_tokens": 0},
    }
    execution_trace = list(state.get("execution_trace", []) if state else []) + [trace_step]
    return {"response_text": text, "messages": messages, "execution_trace": execution_trace}


def _llm_response_no_data(state: AgentState) -> dict[str, Any]:
    """Handle general chat / FAQ without inventory data."""
    messages = list(state.get("messages", []))
    default_faq = (
        "You are a helpful B2B industrial-parts sales assistant. "
        "Answer general questions about shipping policies, payment terms, "
        "and company services. Be concise and professional. "
        "If the customer asks about specific product prices or stock, tell "
        "them you need a product name or SKU to look that up."
    )
    system = default_faq
    session = get_audit_session()
    try:
        active_prompt = session.query(PromptTemplate).filter_by(
            node_name="faq_node", is_active=True
        ).first()
        if active_prompt and active_prompt.system_prompt:
            system = active_prompt.system_prompt
    except Exception as exc:
        logger.error("Failed to fetch FAQ prompt: %s", exc)
    finally:
        session.close()

    import time
    start_time = time.perf_counter()
    llm = None
    prompt_t = 0
    completion_t = 0
    reasoning_t = 0

    try:
        llm = get_synthesis_llm()
        llm_messages = [SystemMessage(content=system)] + messages
        response = llm.invoke(llm_messages)
        text = response.content.strip()
    except Exception as exc:
        logger.error("FAQ LLM failed: %s", exc)
        text = "I'd be happy to help! Could you please provide more details about what you're looking for?"

    latency_ms = (time.perf_counter() - start_time) * 1000.0

    token_usage = state.get("token_usage", {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "reasoning_tokens": 0,
        "router_tokens": 0,
        "synthesis_tokens": 0,
    })
    if 'response' in locals() and hasattr(response, 'response_metadata'):
        usage_metadata = response.response_metadata.get("token_usage", {})
        prompt_t = usage_metadata.get("prompt_tokens", 0)
        completion_t = usage_metadata.get("completion_tokens", 0)
        reasoning_t = (
            usage_metadata.get("completion_tokens_details", {}).get("reasoning_tokens", 0)
            or usage_metadata.get("reasoning_tokens", 0)
        )
        token_usage["prompt_tokens"] += prompt_t
        token_usage["completion_tokens"] += completion_t
        token_usage["reasoning_tokens"] += reasoning_t
        token_usage["synthesis_tokens"] += (prompt_t + completion_t)

    settings = get_settings()
    model_name = getattr(llm, "model_name", None) or getattr(llm, "model", None) or getattr(settings, "SYNTHESIS_MODEL_NAME", "openai/gpt-4o-mini")

    trace_step = {
        "step": "synthesis",
        "step_name": "FAQ / General Conversation Synthesis",
        "node": "synthesis_node",
        "type": "faq_llm",
        "model": str(model_name),
        "system_prompt": system,
        "raw_llm_output": text,
        "latency_ms": round(latency_ms, 2),
        "token_usage": {
            "prompt_tokens": prompt_t,
            "completion_tokens": completion_t,
            "reasoning_tokens": reasoning_t,
        },
    }

    execution_trace = list(state.get("execution_trace", [])) + [trace_step]
    messages.append(AIMessage(content=text))
    return {
        "response_text": text,
        "messages": messages,
        "token_usage": token_usage,
        "execution_trace": execution_trace,
    }


def _sanitise_for_prompt(records: list[dict]) -> str:
    """Convert DB rows to a readable text block, hiding internal fields."""
    if not records:
        return "None"

    lines: list[str] = []
    for rec in records:
        parts: list[str] = []
        for key, val in rec.items():
            # Hide internal fields from the LLM
            if key in ("id", "landed_cost", "tally_item_id", "is_dead_stock"):
                continue
            parts.append(f"{key}: {val}")
        lines.append(" | ".join(parts))
    return "\n".join(lines)
