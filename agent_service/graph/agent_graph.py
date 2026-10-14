"""
Agent Graph — LangGraph StateGraph definition.

Topology:
    ingestion → router_node → (conditional) → tool_node → synthesis_node → audit_node
                                            ↘ synthesis_node (FAQ/General/Escalation)
                                               → audit_node

Max-iteration guard prevents infinite tool-calling loops.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

from langchain_core.messages import HumanMessage
from langgraph.graph import END, StateGraph

from agent_service.config.settings import get_settings
from agent_service.db.audit_models import get_audit_session, PromptTemplate
from agent_service.graph.guardrails import check_input
from agent_service.graph.nodes.audit_node import audit_node
from agent_service.graph.nodes.router_node import router_node
from agent_service.graph.nodes.synthesis_node import synthesis_node
from agent_service.graph.nodes.tool_node import tool_node
from agent_service.graph.state import AgentState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Ingestion node (entry point)
# ---------------------------------------------------------------------------

def ingestion_node(state: AgentState) -> dict[str, Any]:
    """
    First node — validates input via guardrails and initialises turn metadata.
    """
    messages = state.get("messages", [])
    if not messages:
        return {
            "escalation_flag": True,
            "intent": "ESCALATION",
            "response_text": "No message received.",
            "turn_start_time": time.perf_counter(),
        }

    last_msg = messages[-1]
    raw_text = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    result = check_input(raw_text)

    if not result.is_safe:
        logger.warning("Input guardrail triggered: %s", result.reason)
        guardrail_msg = (
            "I can only assist with product enquiries, stock availability, "
            "and order-related questions. I'm not able to modify prices or "
            "bypass our catalogue policies."
        )
        session = get_audit_session()
        try:
            active_prompt = session.query(PromptTemplate).filter_by(
                node_name="guardrail_node", is_active=True
            ).first()
            if active_prompt and active_prompt.system_prompt:
                guardrail_msg = active_prompt.system_prompt
        except Exception as exc:
            logger.error("Failed to fetch guardrail prompt: %s", exc)
        finally:
            session.close()

        return {
            "escalation_flag": True,
            "intent": "ESCALATION",
            "response_text": guardrail_msg,
            "turn_start_time": time.perf_counter(),
        }

    return {
        "turn_start_time": time.perf_counter(),
        "iteration_count": state.get("iteration_count", 0),
        "tool_call_log": state.get("tool_call_log", []),
        "retrieved_records": state.get("retrieved_records", []),
        "alternative_records": state.get("alternative_records", []),
        "citations": state.get("citations", []),
    }


# ---------------------------------------------------------------------------
# Conditional edge: route after ingestion
# ---------------------------------------------------------------------------

def _after_ingestion(state: AgentState) -> str:
    """If guardrails already set a response, skip to audit."""
    if state.get("response_text"):
        return "audit_node"
    return "router_node"


# ---------------------------------------------------------------------------
# Conditional edge: route after router
# ---------------------------------------------------------------------------

def _after_router(state: AgentState) -> str:
    """Decide whether the turn needs a tool call or goes straight to synthesis."""
    intent = state.get("intent", "GENERAL_CHAT")
    escalation = state.get("escalation_flag", False)

    # Escalation → deterministic synthesis
    if escalation:
        return "synthesis_node"

    # Product / ordering queries → live DB lookup
    if intent in ("PRODUCT_STOCK_QUERY", "ORDERING_INTENT"):
        # Iteration guard
        iterations = state.get("iteration_count", 0)
        settings = get_settings()
        if iterations >= settings.MAX_GRAPH_ITERATIONS:
            logger.warning("Max iterations reached (%d), skipping tool", iterations)
            return "synthesis_node"
        return "tool_node"

    # FAQ / General → synthesis without tools
    return "synthesis_node"


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_agent_graph() -> StateGraph:
    """Build and compile the LangGraph state machine."""

    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("ingestion_node", ingestion_node)
    graph.add_node("router_node", router_node)
    graph.add_node("tool_node", tool_node)
    graph.add_node("synthesis_node", synthesis_node)
    graph.add_node("audit_node", audit_node)

    # Set entry point
    graph.set_entry_point("ingestion_node")

    # Conditional edge after ingestion
    graph.add_conditional_edges(
        "ingestion_node",
        _after_ingestion,
        {"router_node": "router_node", "audit_node": "audit_node"},
    )

    # Conditional edge after router
    graph.add_conditional_edges(
        "router_node",
        _after_router,
        {
            "tool_node": "tool_node",
            "synthesis_node": "synthesis_node",
        },
    )

    # Linear edges
    graph.add_edge("tool_node", "synthesis_node")
    graph.add_edge("synthesis_node", "audit_node")
    graph.add_edge("audit_node", END)

    return graph


# ---------------------------------------------------------------------------
# Compiled graph singleton
# ---------------------------------------------------------------------------

_compiled_graph = None


def get_compiled_graph():
    """Return the compiled graph (singleton)."""
    global _compiled_graph
    if _compiled_graph is None:
        graph = build_agent_graph()
        _compiled_graph = graph.compile()
    return _compiled_graph


def run_agent_turn(
    message_text: str,
    session_id: str,
    customer_id: str | None = None,
    prior_messages: list | None = None,
) -> AgentState:
    """
    Execute a single agent turn and return the final state.

    Parameters
    ----------
    message_text : str
        The customer's message.
    session_id : str
        Session identifier for multi-turn context.
    customer_id : str, optional
        CRM customer UUID if known.
    prior_messages : list, optional
        Previous conversation messages for multi-turn context.

    Returns
    -------
    AgentState
        The final state after all nodes have executed.
    """
    compiled = get_compiled_graph()

    messages = list(prior_messages or [])
    messages.append(HumanMessage(content=message_text))

    initial_state: AgentState = {
        "messages": messages,
        "turn_id": str(uuid.uuid4()),
        "session_id": session_id,
        "customer_id": customer_id or "",
        "extracted_product_refs": [],
        "retrieved_records": [],
        "alternative_records": [],
        "citations": [],
        "escalation_flag": False,
        "intent": "",
        "confidence": 0.0,
        "iteration_count": 0,
        "turn_start_time": time.perf_counter(),
        "tool_call_log": [],
        "response_text": "",
    }

    final_state = compiled.invoke(initial_state)
    return final_state
