"""
Router Node — lightweight intent classification using the fast LLM.

Classifies the customer message into one of five intents and extracts any
product name / SKU references.  If classification confidence falls below
the configured threshold the turn is routed to ESCALATION.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from agent_service.config.llm_factory import get_router_llm
from agent_service.config.settings import get_settings
from agent_service.graph.state import AgentState
from agent_service.db.audit_models import get_audit_session, PromptTemplate

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Router system prompt
# ---------------------------------------------------------------------------

_ROUTER_SYSTEM_PROMPT = """\
You are an intent classifier for a B2B industrial-parts CRM chat agent.

Given the customer's latest message (and optional prior context), output a
JSON object with exactly two keys:

{
  "intent": "<one of: PRODUCT_STOCK_QUERY, FAQ_QUERY, ORDERING_INTENT, ESCALATION, GENERAL_CHAT>",
  "confidence": <float between 0.0 and 1.0>,
  "product_refs": ["<product name or SKU mentioned, if any>"]
}

Classification guide:
• PRODUCT_STOCK_QUERY  — asks about price, availability, stock, variants, specifications of a product.
• FAQ_QUERY            — general knowledge question about policies, shipping, returns, payment terms.
• ORDERING_INTENT      — wants to place, modify, or track an order.
• ESCALATION           — abusive language, complaints, requests for a human agent, or anything you cannot classify.
• GENERAL_CHAT         — greetings, thanks, small-talk.

Output ONLY the JSON object.  No commentary.
"""


# ---------------------------------------------------------------------------
# Node function
# ---------------------------------------------------------------------------

def router_node(state: AgentState) -> dict[str, Any]:
    """
    Classify the latest user message and extract product references.

    Updates:
        intent, confidence, extracted_product_refs, escalation_flag
    """
    settings = get_settings()
    messages = state.get("messages", [])

    if not messages:
        return {
            "intent": "GENERAL_CHAT",
            "confidence": 0.0,
            "extracted_product_refs": [],
            "escalation_flag": True,
        }

    # Fetch system prompt from DB
    session = get_audit_session()
    try:
        active_prompt = session.query(PromptTemplate).filter_by(
            node_name="router_node", is_active=True
        ).first()
        system_prompt_text = active_prompt.system_prompt if active_prompt else _ROUTER_SYSTEM_PROMPT
    except Exception as exc:
        logger.error("Failed to fetch router prompt: %s", exc)
        system_prompt_text = _ROUTER_SYSTEM_PROMPT
    finally:
        session.close()

    # Build the LLM call with recent context
    context_window = messages[-(settings.MAX_CONTEXT_TURNS * 2):]
    llm_messages = [SystemMessage(content=system_prompt_text)] + context_window

    import time
    start_time = time.perf_counter()
    llm = None
    prompt_t = 0
    completion_t = 0
    reasoning_t = 0
    raw = ""

    try:
        llm = get_router_llm()
        response = llm.invoke(llm_messages)
        raw = response.content.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        parsed = json.loads(raw)
        intent = parsed.get("intent", "GENERAL_CHAT")
        confidence = float(parsed.get("confidence", 0.0))
        product_refs = parsed.get("product_refs", [])

    except Exception as exc:
        logger.warning("Router LLM failed, escalating: %s", exc)
        intent = "ESCALATION"
        confidence = 0.0
        product_refs = []

    latency_ms = (time.perf_counter() - start_time) * 1000.0

    # Confidence gate
    escalation = intent == "ESCALATION" or confidence < settings.CONFIDENCE_THRESHOLD

    # Update Token Usage
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
        token_usage["router_tokens"] += (prompt_t + completion_t)

    model_name = getattr(llm, "model_name", None) or getattr(llm, "model", None) or getattr(settings, "ROUTER_MODEL_NAME", "openai/gpt-4o-mini")

    trace_step = {
        "step": "router",
        "step_name": "Intent Classification & Entity Routing",
        "node": "router_node",
        "model": str(model_name),
        "system_prompt": system_prompt_text,
        "input_messages": [m.content if hasattr(m, "content") else str(m) for m in context_window],
        "raw_llm_output": raw,
        "parsed_output": {
            "intent": intent,
            "confidence": confidence,
            "product_refs": product_refs,
            "escalation_flag": escalation,
        },
        "latency_ms": round(latency_ms, 2),
        "token_usage": {
            "prompt_tokens": prompt_t,
            "completion_tokens": completion_t,
            "reasoning_tokens": reasoning_t,
        },
    }

    execution_trace = list(state.get("execution_trace", [])) + [trace_step]

    return {
        "intent": intent,
        "confidence": confidence,
        "extracted_product_refs": product_refs,
        "escalation_flag": escalation,
        "token_usage": token_usage,
        "execution_trace": execution_trace,
    }
