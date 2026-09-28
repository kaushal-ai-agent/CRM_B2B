"""
DeepEval Metrics — custom and built-in metric wrappers for the agent.

Four core metrics:
1. HallucinationMetric  — zero pricing / stock claims without SQL citations
2. FaithfulnessMetric   — synthesis adheres to retrieved DB fields
3. AnswerRelevancyMetric — customer intent is directly addressed
4. ToolCorrectnessMetric — correct tool picked with accurate entity arguments
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lightweight metric implementations (no deepeval import at module level)
# ---------------------------------------------------------------------------

class HallucinationCheck:
    """
    Verify that the response does not contain pricing or stock claims
    that are not backed by the provided retrieval context.
    """

    name = "hallucination"

    @staticmethod
    def evaluate(
        response_text: str,
        retrieval_context: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Return ``{"passed": bool, "reason": str, "score": float}``.
        """
        import re

        # Extract all numeric values that look like prices from the response
        price_pattern = re.compile(
            r"(?:₹|Rs\.?|\$)\s*([\d,]+\.?\d*)", re.IGNORECASE
        )
        matches = price_pattern.findall(response_text)

        if not matches:
            return {"passed": True, "reason": "No price claims in response.", "score": 1.0}

        # Collect all prices from retrieval context
        context_prices: set[float] = set()
        for record in retrieval_context:
            for key, val in record.items():
                if "price" in key.lower() or "cost" in key.lower() or "stock" in key.lower():
                    try:
                        context_prices.add(float(val))
                    except (ValueError, TypeError):
                        pass

        # Check each claimed price
        ungrounded: list[str] = []
        for match in matches:
            try:
                claimed = float(match.replace(",", ""))
            except ValueError:
                continue
            if not any(abs(claimed - cp) < 0.02 for cp in context_prices):
                ungrounded.append(match)

        if ungrounded:
            return {
                "passed": False,
                "reason": f"Ungrounded price claims: {ungrounded}",
                "score": 0.0,
            }
        return {"passed": True, "reason": "All price claims are grounded.", "score": 1.0}


class FaithfulnessCheck:
    """
    Verify that key factual claims in the response are present in the
    retrieval context.
    """

    name = "faithfulness"

    @staticmethod
    def evaluate(
        response_text: str,
        retrieval_context: list[dict[str, Any]],
    ) -> dict[str, Any]:
        # Flatten context values into a searchable string
        context_str = " ".join(
            str(v) for record in retrieval_context for v in record.values()
        ).lower()

        # Extract SKU codes mentioned in the response
        import re
        sku_pattern = re.compile(r"\b[A-Z]{2,4}-\d{2,4}\b")
        skus = sku_pattern.findall(response_text)

        unfaithful_skus = [s for s in skus if s.lower() not in context_str]

        if unfaithful_skus:
            return {
                "passed": False,
                "reason": f"SKU codes not in context: {unfaithful_skus}",
                "score": 0.0,
            }
        return {"passed": True, "reason": "Response is faithful to context.", "score": 1.0}


class AnswerRelevancyCheck:
    """
    Verify that the response addresses the customer's original intent.
    """

    name = "answer_relevancy"

    @staticmethod
    def evaluate(
        response_text: str,
        input_text: str,
        intent: str,
    ) -> dict[str, Any]:
        response_lower = response_text.lower()

        if intent == "PRODUCT_STOCK_QUERY":
            # Should mention price or stock or product
            if any(kw in response_lower for kw in ("price", "stock", "₹", "rs", "available", "unavailable", "out of stock")):
                return {"passed": True, "reason": "Response addresses product/stock query.", "score": 1.0}
            return {"passed": False, "reason": "Response does not mention price or stock.", "score": 0.0}

        if intent == "ESCALATION":
            if any(kw in response_lower for kw in ("team", "agent", "assist", "help", "connect")):
                return {"passed": True, "reason": "Response addresses escalation.", "score": 1.0}
            return {"passed": False, "reason": "Response does not offer escalation.", "score": 0.0}

        # For FAQ / General — pass if non-empty
        if len(response_text.strip()) > 10:
            return {"passed": True, "reason": "Response provided.", "score": 1.0}

        return {"passed": False, "reason": "Response is empty or too short.", "score": 0.0}


class ToolCorrectnessCheck:
    """
    Verify that the correct tool was invoked with accurate entity arguments.
    """

    name = "tool_correctness"

    @staticmethod
    def evaluate(
        tool_calls: list[dict[str, Any]],
        intent: str,
        expected_refs: list[str] | None = None,
    ) -> dict[str, Any]:
        if intent in ("PRODUCT_STOCK_QUERY", "ORDERING_INTENT"):
            if not tool_calls:
                return {
                    "passed": False,
                    "reason": "No tool calls made for a product query.",
                    "score": 0.0,
                }
            tool_names = [tc.get("tool_name", "") for tc in tool_calls]
            if "query_live_product" not in tool_names:
                return {
                    "passed": False,
                    "reason": f"Expected query_live_product, got: {tool_names}",
                    "score": 0.0,
                }

            # Check if expected refs were searched
            if expected_refs:
                searched_terms = []
                for tc in tool_calls:
                    args = tc.get("input_args", {})
                    term = args.get("search_term", "")
                    if term:
                        searched_terms.append(term.lower())

                for ref in expected_refs:
                    if not any(ref.lower() in st for st in searched_terms):
                        return {
                            "passed": False,
                            "reason": f"Expected search for '{ref}' not found in tool calls.",
                            "score": 0.5,
                        }

            return {"passed": True, "reason": "Correct tool invoked with accurate args.", "score": 1.0}

        # Non-product intents should NOT have product tool calls (allowed but not required)
        return {"passed": True, "reason": "No tool calls expected for this intent.", "score": 1.0}
