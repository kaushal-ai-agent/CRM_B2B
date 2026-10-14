"""
DeepEval Evaluation Runner — fetches GoldenDataset and executes on-demand evals.
"""

import json
import logging
import time
from typing import Any

from agent_service.db.audit_models import (
    get_audit_session,
    GoldenTestCase,
    EvaluationRun,
    EvaluationCaseResult,
    PromptTemplate
)
from agent_service.graph.models import EvalResult
from agent_service.eval.metrics import (
    AnswerRelevancyCheck,
    FaithfulnessCheck,
    HallucinationCheck,
    ToolCorrectnessCheck,
)
from agent_service.graph.agent_graph import run_agent_turn

logger = logging.getLogger(__name__)

def run_evaluation_suite(dataset_tag: str = "default_v1") -> dict[str, Any]:
    # ── Phase 1: Load test cases & initialize run record ────────────────
    session = get_audit_session()
    try:
        raw_test_cases = session.query(GoldenTestCase).filter_by(dataset_tag=dataset_tag, is_active=True).all()
        if not raw_test_cases:
            return {"status": "error", "detail": f"No active test cases found for tag {dataset_tag}"}
        
        test_cases_data = [
            {
                "id": tc.id,
                "query": tc.query,
                "expected_intent": tc.expected_intent,
                "expected_tools": tc.expected_tools,
                "expected_entities": tc.expected_entities or {},
            }
            for tc in raw_test_cases
        ]

        # Determine next version tag
        last_run = session.query(EvaluationRun).order_by(EvaluationRun.run_timestamp.desc()).first()
        next_version = 1
        if last_run and last_run.version_tag and last_run.version_tag.startswith("eval_v"):
            try:
                next_version = int(last_run.version_tag.split("eval_v")[1]) + 1
            except ValueError:
                pass
        version_tag = f"eval_v{next_version}"

        # Fetch active prompts to record them
        prompts = session.query(PromptTemplate).filter_by(is_active=True).all()
        prompt_versions = {p.node_name: p.version for p in prompts}

        run_record = EvaluationRun(
            version_tag=version_tag,
            prompt_versions=prompt_versions,
            total_test_cases=len(test_cases_data),
            passed_cases=0,
            failed_cases=0,
            avg_faithfulness=0.0,
            avg_relevancy=0.0,
            avg_hallucination=0.0,
            avg_tool_correctness=0.0,
            overall_score=0.0,
            latency_avg_ms=0.0,
        )
        session.add(run_record)
        session.commit()
        run_record_id = run_record.id
    except Exception as exc:
        session.rollback()
        logger.exception("Failed to initialize evaluation run")
        return {"status": "error", "detail": str(exc)}
    finally:
        session.close()

    # ── Phase 2: Execute test cases (NO database sessions open during LLM calls) ──
    results = []
    total_faithfulness = 0.0
    total_relevancy = 0.0
    total_hallucination = 0.0
    total_tool_correctness = 0.0
    passed = 0
    total_latency = 0.0

    for tc in test_cases_data:
        start_t = time.perf_counter()
        state = run_agent_turn(
            message_text=tc["query"],
            session_id=f"eval-{tc['id']}",
            customer_id=None,
            prior_messages=None,
        )
        latency = (time.perf_counter() - start_t) * 1000.0
        total_latency += latency

        retrieved = state.get("retrieved_records", [])
        response = state.get("response_text", "")
        tool_log = state.get("tool_call_log", [])
        intent = state.get("intent", "")

        f_res = FaithfulnessCheck.evaluate(response, retrieved)
        r_res = AnswerRelevancyCheck.evaluate(response, tc["query"], tc["expected_intent"] or intent)
        h_res = HallucinationCheck.evaluate(response, retrieved)

        exp_tools = tc["expected_tools"] or (["query_live_product"] if (tc["expected_intent"] or intent) in ("PRODUCT_STOCK_QUERY", "ORDERING_INTENT") else [])
        exp_refs = list(tc["expected_entities"].values()) if tc["expected_entities"] and isinstance(tc["expected_entities"], dict) else []
        t_res = ToolCorrectnessCheck.evaluate(
            tool_calls=tool_log,
            intent=tc["expected_intent"] or intent,
            expected_tools=exp_tools,
            expected_refs=exp_refs,
        )

        f_score = f_res.get("score", 0.0)
        r_score = r_res.get("score", 0.0)
        h_score = h_res.get("score", 0.0)
        t_score = t_res.get("score", 0.0)

        total_faithfulness += f_score
        total_relevancy += r_score
        total_hallucination += h_score
        total_tool_correctness += t_score

        all_passed = f_res.get("passed", True) and r_res.get("passed", True) and h_res.get("passed", True) and t_res.get("passed", True)
        if all_passed:
            passed += 1

        reasoning = f"Faithfulness: {f_res.get('reason')} | Relevancy: {r_res.get('reason')} | Hallucination: {h_res.get('reason')} | Tool: {t_res.get('reason')}"

        results.append({
            "run_id": run_record_id,
            "test_case_id": tc["id"],
            "inbound_query": tc["query"],
            "actual_intent": intent,
            "actual_response": response,
            "tools_called": tool_log,
            "faithfulness_score": f_score,
            "relevancy_score": r_score,
            "hallucination_score": h_score,
            "tool_correctness_score": t_score,
            "status": "PASSED" if all_passed else "FAILED",
            "reasoning": reasoning,
            "execution_trace": state.get("execution_trace", []),
        })

    # ── Phase 3: Persist case results & finalize evaluation run metrics ──
    num_cases = len(test_cases_data)
    avg_f = total_faithfulness / num_cases
    avg_r = total_relevancy / num_cases
    avg_h = total_hallucination / num_cases
    avg_t = total_tool_correctness / num_cases
    avg_lat = total_latency / num_cases
    overall = (avg_f + avg_r + (1.0 - avg_h) + avg_t) / 4.0

    session = get_audit_session()
    try:
        for res_data in results:
            session.add(EvaluationCaseResult(**res_data))

        run_record = session.query(EvaluationRun).filter_by(id=run_record_id).first()
        if run_record:
            run_record.passed_cases = passed
            run_record.failed_cases = num_cases - passed
            run_record.avg_faithfulness = avg_f
            run_record.avg_relevancy = avg_r
            run_record.avg_hallucination = avg_h
            run_record.avg_tool_correctness = avg_t
            run_record.latency_avg_ms = avg_lat
            run_record.overall_score = overall

        session.commit()

        return {
            "status": "success",
            "run_id": run_record_id,
            "version_tag": version_tag,
            "overall_score": overall,
            "passed_cases": passed,
            "total_test_cases": num_cases,
        }
    except Exception as exc:
        session.rollback()
        logger.exception("Failed to persist evaluation results")
        return {"status": "error", "detail": str(exc)}
    finally:
        session.close()
