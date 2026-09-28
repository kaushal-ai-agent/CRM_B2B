"""
Tool Node — live database query tools for inventory-grounded replies.

Two tools:
1. ``query_live_product``       — exact SKU match + fuzzy name search
2. ``fetch_category_alternatives`` — find in-stock alternatives when OOS

Every query is read-only, parameterised, and logged for audit provenance.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from agent_service.db.adapter import DatabaseAdapter
from agent_service.graph.state import AgentState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton adapter (created on first call)
# ---------------------------------------------------------------------------

_db: DatabaseAdapter | None = None


def _get_db() -> DatabaseAdapter:
    global _db
    if _db is None:
        _db = DatabaseAdapter()
    return _db


# ---------------------------------------------------------------------------
# Tool 1: query_live_product
# ---------------------------------------------------------------------------

def _query_live_product(search_term: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Query the live product table.

    Returns ``(rows, tool_call_log_entries)``.
    """
    db = _get_db()
    tool_calls: list[dict[str, Any]] = []
    all_rows: list[dict[str, Any]] = []

    # --- Attempt 1: exact SKU match ------------------------------------------
    sql_sku = (
        "SELECT id, sku_code, product_name, category, uom, "
        "       selling_price, current_stock, seasonality_tag, is_dead_stock "
        "FROM crm_product "
        "WHERE UPPER(sku_code) = UPPER(:sku)"
    )
    params_sku = {"sku": search_term.strip()}

    try:
        rows_sku, elapsed_sku = db.execute_readonly_query(sql_sku, params_sku)
        tool_calls.append({
            "tool_name": "query_live_product",
            "input_args": {"search_term": search_term, "match_type": "sku_exact"},
            "sql_executed": sql_sku,
            "params": params_sku,
            "raw_output": rows_sku,
            "elapsed_ms": round(elapsed_sku, 2),
        })
        all_rows.extend(rows_sku)
    except Exception as exc:
        logger.error("SKU query failed: %s", exc)
        tool_calls.append({
            "tool_name": "query_live_product",
            "input_args": {"search_term": search_term, "match_type": "sku_exact"},
            "sql_executed": sql_sku,
            "error": str(exc),
        })

    # --- Attempt 2: fuzzy product name search (if SKU yielded nothing) -------
    if not all_rows:
        sql_name = (
            "SELECT id, sku_code, product_name, category, uom, "
            "       selling_price, current_stock, seasonality_tag, is_dead_stock "
            "FROM crm_product "
            "WHERE LOWER(product_name) LIKE LOWER(:name) "
            "LIMIT 5"
        )
        params_name = {"name": f"%{search_term.strip()}%"}

        try:
            rows_name, elapsed_name = db.execute_readonly_query(sql_name, params_name)
            tool_calls.append({
                "tool_name": "query_live_product",
                "input_args": {"search_term": search_term, "match_type": "name_fuzzy"},
                "sql_executed": sql_name,
                "params": params_name,
                "raw_output": rows_name,
                "elapsed_ms": round(elapsed_name, 2),
            })
            all_rows.extend(rows_name)
        except Exception as exc:
            logger.error("Name query failed: %s", exc)
            tool_calls.append({
                "tool_name": "query_live_product",
                "input_args": {"search_term": search_term, "match_type": "name_fuzzy"},
                "sql_executed": sql_name,
                "error": str(exc),
            })

    return all_rows, tool_calls


# ---------------------------------------------------------------------------
# Tool 2: fetch_category_alternatives
# ---------------------------------------------------------------------------

def _fetch_category_alternatives(
    category: str,
    exclude_id: str,
    target_price: float,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Retrieve up to 3 in-stock alternatives from the same category,
    ordered by proximity to ``target_price``.

    Returns ``(rows, tool_call_log_entries)``.
    """
    db = _get_db()
    tool_calls: list[dict[str, Any]] = []

    sql = (
        "SELECT id, sku_code, product_name, category, uom, "
        "       selling_price, current_stock "
        "FROM crm_product "
        "WHERE LOWER(category) = LOWER(:cat) "
        "  AND id != :exclude_id "
        "  AND current_stock > 0 "
        "ORDER BY ABS(selling_price - :target_price) "
        "LIMIT 3"
    )
    params = {
        "cat": category,
        "exclude_id": exclude_id,
        "target_price": target_price,
    }

    try:
        rows, elapsed = db.execute_readonly_query(sql, params)
        tool_calls.append({
            "tool_name": "fetch_category_alternatives",
            "input_args": {"category": category, "exclude_id": exclude_id, "target_price": target_price},
            "sql_executed": sql,
            "params": params,
            "raw_output": rows,
            "elapsed_ms": round(elapsed, 2),
        })
    except Exception as exc:
        logger.error("Alternatives query failed: %s", exc)
        rows = []
        tool_calls.append({
            "tool_name": "fetch_category_alternatives",
            "input_args": {"category": category},
            "sql_executed": sql,
            "error": str(exc),
        })

    return rows, tool_calls


# ---------------------------------------------------------------------------
# Citation builder
# ---------------------------------------------------------------------------

def _build_citations(rows: list[dict[str, Any]], table: str = "crm_product") -> list[dict[str, Any]]:
    """Build structured citation records from query results."""
    now = datetime.now(timezone.utc).isoformat()
    citations: list[dict[str, Any]] = []
    for row in rows:
        citations.append({
            "source_table": table,
            "record_id": str(row.get("id", "")),
            "field_values": {
                k: (float(v) if isinstance(v, (int, float)) else str(v))
                for k, v in row.items()
                if k != "id"
            },
            "lookup_time": now,
        })
    return citations


# ---------------------------------------------------------------------------
# Graph node entry point
# ---------------------------------------------------------------------------

def tool_node(state: AgentState) -> dict[str, Any]:
    """
    Execute live product queries and, if out-of-stock, fetch alternatives.

    Updates:
        retrieved_records, alternative_records, citations, tool_call_log
    """
    product_refs = state.get("extracted_product_refs", [])
    existing_log = list(state.get("tool_call_log", []))

    all_retrieved: list[dict[str, Any]] = []
    all_alternatives: list[dict[str, Any]] = []
    all_citations: list[dict[str, Any]] = []

    for ref in product_refs:
        rows, calls = _query_live_product(ref)
        existing_log.extend(calls)
        all_retrieved.extend(rows)
        all_citations.extend(_build_citations(rows))

        # --- Out-of-stock fallback -------------------------------------------
        for row in rows:
            stock = row.get("current_stock", 0)
            if stock == 0:
                alt_rows, alt_calls = _fetch_category_alternatives(
                    category=row.get("category", ""),
                    exclude_id=str(row.get("id", "")),
                    target_price=float(row.get("selling_price", 0)),
                )
                existing_log.extend(alt_calls)
                all_alternatives.extend(alt_rows)
                all_citations.extend(_build_citations(alt_rows))

    # If no product refs were extracted, try the full latest message as search
    if not product_refs:
        messages = state.get("messages", [])
        if messages:
            last_msg = messages[-1].content if hasattr(messages[-1], "content") else str(messages[-1])
            rows, calls = _query_live_product(last_msg)
            existing_log.extend(calls)
            all_retrieved.extend(rows)
            all_citations.extend(_build_citations(rows))

    return {
        "retrieved_records": all_retrieved,
        "alternative_records": all_alternatives,
        "citations": all_citations,
        "tool_call_log": existing_log,
    }
