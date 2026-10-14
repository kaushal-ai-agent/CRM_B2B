"""
Tests for Agent Service Golden Dataset and DeepEval Metrics.
"""

import pytest
from agent_service.db.audit_models import get_audit_session, GoldenTestCase
from agent_service.db.seed_defaults import seed_defaults_if_empty
from agent_service.eval.metrics import (
    FaithfulnessCheck,
    AnswerRelevancyCheck,
    HallucinationCheck,
    ToolCorrectnessCheck,
)


def test_golden_dataset_seeding():
    """Verify that golden test cases are populated with baseline queries."""
    counts = seed_defaults_if_empty()
    session = get_audit_session()
    try:
        cases = session.query(GoldenTestCase).filter_by(dataset_tag="default_v1").all()
        assert len(cases) >= 5
        intents = [c.expected_intent for c in cases]
        assert "PRODUCT_STOCK_QUERY" in intents
        assert "FAQ_QUERY" in intents
        assert "ESCALATION" in intents
    finally:
        session.close()


def test_hallucination_check_zero_tolerance():
    """Verify that claims with ungrounded prices fail hallucination checks."""
    retrieval_context = [{"sku_code": "QBE-751", "selling_price": 450.00}]
    
    # Grounded response
    grounded_resp = "SKU QBE-751 is available at $450.00."
    res = HallucinationCheck.evaluate(grounded_resp, retrieval_context)
    assert res["passed"] is True
    assert res["score"] == 1.0

    # Hallucinated response
    hallucinated_resp = "SKU QBE-751 is available at $120.00."
    res_bad = HallucinationCheck.evaluate(hallucinated_resp, retrieval_context)
    assert res_bad["passed"] is False
    assert res_bad["score"] == 0.0


def test_tool_correctness_check():
    """Verify tool correctness evaluation on product queries."""
    tool_calls = [{"tool_name": "query_live_product", "input_args": {"search_term": "QBE-751"}}]
    eval_res = ToolCorrectnessCheck.evaluate(
        tool_calls=tool_calls,
        intent="PRODUCT_STOCK_QUERY",
        expected_refs=["QBE-751"],
    )
    assert eval_res["passed"] is True
    assert eval_res["score"] == 1.0


def test_tool_correctness_check_string_calls():
    """Verify tool correctness evaluation when tool_calls is a list of strings."""
    tool_calls = ["query_live_product"]
    eval_res = ToolCorrectnessCheck.evaluate(
        tool_calls=tool_calls,
        intent="PRODUCT_STOCK_QUERY",
    )
    assert eval_res["passed"] is True
    assert eval_res["score"] == 1.0


def test_tool_correctness_with_expected_tools_and_refs():
    """Verify tool correctness evaluation with expected tools and refs."""
    tool_calls = [{"tool_name": "query_live_product", "input_args": {"search_term": "QBE-751"}}]
    
    # 1. Matching tool and matching ref -> 1.0
    res1 = ToolCorrectnessCheck.evaluate(
        tool_calls=tool_calls,
        intent="PRODUCT_STOCK_QUERY",
        expected_tools=["query_live_product"],
        expected_refs=["QBE-751"],
    )
    assert res1["passed"] is True
    assert res1["score"] == 1.0

    # 2. Missing tool -> 0.0
    res2 = ToolCorrectnessCheck.evaluate(
        tool_calls=tool_calls,
        intent="PRODUCT_STOCK_QUERY",
        expected_tools=["non_existent_tool"],
        expected_refs=["QBE-751"],
    )
    assert res2["passed"] is False
    assert res2["score"] == 0.0

    # 3. Matching tool but missing ref -> 0.5
    res3 = ToolCorrectnessCheck.evaluate(
        tool_calls=tool_calls,
        intent="PRODUCT_STOCK_QUERY",
        expected_tools=["query_live_product"],
        expected_refs=["UNMATCHED-SKU-999"],
    )
    assert res3["passed"] is False
    assert res3["score"] == 0.5


def test_audit_log_execution_trace_persistence():
    """Verify that execution_trace is correctly saved and retrieved in audit logs."""
    import uuid
    from agent_service.db.audit_writer import write_audit_log, fetch_audit_logs

    sess_id = f"test-trace-{uuid.uuid4()}"
    trace = [
        {"step": "router", "model": "test-router", "system_prompt": "classify", "latency_ms": 12.5},
        {"step": "synthesis", "model": "test-synth", "system_prompt": "answer", "latency_ms": 45.0},
    ]

    log_id = write_audit_log(
        turn_id=str(uuid.uuid4()),
        session_id=sess_id,
        customer_id=None,
        inbound_query="Test query",
        sanitized_input="Test query",
        router_classification="PRODUCT_STOCK_QUERY",
        model_confidence=0.95,
        tool_calls=[{"tool_name": "query_live_product"}],
        grounded_response="Test response",
        citations=None,
        latency_ms=100.0,
        token_usage=None,
        execution_trace=trace,
    )

    logs = fetch_audit_logs(session_id=sess_id)
    assert len(logs) == 1
    assert logs[0]["id"] == log_id
    assert logs[0]["execution_trace"] is not None
    assert len(logs[0]["execution_trace"]) == 2
    assert logs[0]["execution_trace"][0]["step"] == "router"
    assert logs[0]["execution_trace"][1]["step"] == "synthesis"
