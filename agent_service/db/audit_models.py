"""
Audit Store ORM — SQLAlchemy models for the dedicated audit database.

Every agent conversation turn is persisted here with full provenance:
routing decisions, tool calls, SQL executed, grounded response, citations,
latencies, and token usage.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text, JSON, Boolean, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from agent_service.config.settings import get_settings

Base = declarative_base()


class AuditLog(Base):  # type: ignore[misc]
    """One row per agent conversation turn."""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    turn_id = Column(String(36), nullable=False, index=True)
    session_id = Column(String(100), nullable=False, index=True)
    customer_id = Column(String(36), nullable=True, index=True)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Inbound
    inbound_query = Column(Text, nullable=False)
    sanitized_input = Column(Text, nullable=True)

    # Routing
    router_classification = Column(String(50), nullable=True)
    model_confidence = Column(Float, nullable=True)

    # Tool calls  (stored as JSON list)
    tool_calls = Column(JSON, nullable=True)
    # Example element:
    # {
    #   "tool_name": "query_live_product",
    #   "input_args": {"search_term": "QBE-751"},
    #   "sql_executed": "SELECT ... WHERE sku_code = :sku",
    #   "raw_output": [{"product_name": "...", ...}]
    # }

    # Response
    grounded_response = Column(Text, nullable=True)
    citations = Column(JSON, nullable=True)
    # Example:
    # [{"source_table": "crm_product", "record_id": "abc-123",
    #   "field_values": {"selling_price": 3806.63}, "lookup_time": "2026-..."}]

    # Observability
    latency_ms = Column(Float, nullable=True)
    token_usage = Column(JSON, nullable=True)
    execution_trace = Column(JSON, nullable=True)
    # Example: {"router_tokens": 150, "synthesis_tokens": 320, "reasoning_tokens": 50, "total_cost": 0.005}


# --- Token & Cost Configuration ---
class ModelPricingConfig(Base):
    __tablename__ = "model_pricing_config"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_name = Column(String(100), unique=True, nullable=False) # e.g. "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet"
    input_price_per_1m = Column(Float, default=0.15)        # USD per 1M tokens
    output_price_per_1m = Column(Float, default=0.60)       # USD per 1M tokens
    thinking_price_per_1m = Column(Float, default=0.60)     # Reasoning / Thinking tokens
    currency = Column(String(10), default="USD")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

# --- Prompt Versioning ---
class PromptTemplate(Base):
    __tablename__ = "prompt_templates"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_name = Column(String(50), index=True, nullable=False)   # "router_node", "synthesis_node", "out_of_stock_node"
    version = Column(Integer, nullable=False)                # Incremental version: 1, 2, 3...
    system_prompt = Column(Text, nullable=False)
    change_summary = Column(String(200), nullable=True)           # e.g., "Enforced strict zero-discount refusal rule"
    is_active = Column(Boolean, default=False)               # Only one active version per node_name
    created_by = Column(String(50), default="Owner")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# --- Golden Dataset ---
class GoldenTestCase(Base):
    __tablename__ = "golden_test_cases"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_tag = Column(String(50), default="default_v1", index=True)
    query = Column(Text, nullable=False)
    expected_intent = Column(String(50), nullable=False)         # "PRODUCT_STOCK_QUERY", "FAQ_QUERY", etc.
    expected_tools = Column(JSON, default=list)              # ["query_live_product_record"]
    expected_entities = Column(JSON, default=dict)           # {"sku_code": "VALVE-BR-050"}
    ground_truth_output = Column(Text, nullable=False)
    context_documents = Column(JSON, default=list)           # Golden citations / retrieved SQL rows
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

# --- Evaluation Runs (Versioning & Drift) ---
class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    version_tag = Column(String(50), unique=True, nullable=False) # "eval_v1", "eval_v2", etc.
    triggered_by = Column(String(50), default="Owner")
    prompt_versions = Column(JSON, nullable=False)           # {"router_node": 1, "synthesis_node": 2}
    total_test_cases = Column(Integer, nullable=False)
    passed_cases = Column(Integer, nullable=False)
    failed_cases = Column(Integer, nullable=False)
    avg_faithfulness = Column(Float, nullable=False)
    avg_relevancy = Column(Float, nullable=False)
    avg_hallucination = Column(Float, nullable=False)
    avg_tool_correctness = Column(Float, nullable=False)
    overall_score = Column(Float, nullable=False)
    latency_avg_ms = Column(Float, nullable=False)
    run_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# --- Detailed Turn Evaluation ---
class EvaluationCaseResult(Base):
    __tablename__ = "evaluation_case_results"
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String(36), nullable=False, index=True)
    test_case_id = Column(String(36), nullable=True, index=True)
    inbound_query = Column(Text, nullable=False)
    actual_intent = Column(String(50), nullable=False)
    actual_response = Column(Text, nullable=False)
    tools_called = Column(JSON, default=list)
    faithfulness_score = Column(Float, nullable=False)
    relevancy_score = Column(Float, nullable=False)
    hallucination_score = Column(Float, nullable=False)
    tool_correctness_score = Column(Float, nullable=False)
    status = Column(String(20), nullable=False)                  # "PASSED" | "FAILED"
    reasoning = Column(Text, nullable=True)                  # LLM Judge reasoning
    execution_trace = Column(JSON, default=list)             # Step-by-step LLM & Tool execution trace


# ---------------------------------------------------------------------------
# Engine / session helpers
# ---------------------------------------------------------------------------

_engine = None
_SessionLocal = None


def _get_audit_engine():
    global _engine
    if _engine is None:
        url = get_settings().AUDIT_DATABASE_URL
        connect_args = {}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
            connect_args["timeout"] = 30.0
        _engine = create_engine(url, connect_args=connect_args)
        if url.startswith("sqlite"):
            from sqlalchemy import event, text
            @event.listens_for(_engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA busy_timeout=30000")
                cursor.close()

            try:
                with _engine.connect() as conn:
                    conn.execute(text("PRAGMA journal_mode=WAL;"))
                    conn.execute(text("PRAGMA busy_timeout=30000;"))
                    # Auto-migrate newly added columns for SQLite
                    try:
                        conn.execute(text("ALTER TABLE audit_logs ADD COLUMN execution_trace JSON;"))
                    except Exception:
                        pass
                    try:
                        conn.execute(text("ALTER TABLE evaluation_case_results ADD COLUMN execution_trace JSON;"))
                    except Exception:
                        pass
                    conn.commit()
            except Exception:
                pass
        Base.metadata.create_all(_engine)
    return _engine


def get_audit_session():
    """Return a new SQLAlchemy session bound to the audit database."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=_get_audit_engine())
    return _SessionLocal()


def init_audit_db() -> None:
    """Ensure the audit tables exist (idempotent)."""
    _get_audit_engine()
