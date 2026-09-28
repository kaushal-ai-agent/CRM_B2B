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

    # Build the LLM call with recent context
    context_window = messages[-(settings.MAX_CONTEXT_TURNS * 2):]
    llm_messages = [SystemMessage(content=_ROUTER_SYSTEM_PROMPT)] + context_window

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

    # Confidence gate
    escalation = intent == "ESCALATION" or confidence < settings.CONFIDENCE_THRESHOLD

    return {
        "intent": intent,
        "confidence": confidence,
        "extracted_product_refs": product_refs,
        "escalation_flag": escalation,
    }
