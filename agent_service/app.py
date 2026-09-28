"""
FastAPI Application — Inventory-Grounded Conversational AI Agent Service.

Endpoints:
    POST /api/v1/agent/chat         — Process a customer chat message
    GET  /api/v1/agent/audit/logs   — Retrieve audit logs
    POST /api/v1/agent/eval/run     — Run DeepEval evaluation suite
    GET  /api/v1/agent/health       — Health check
    GET  /api/v1/agent/config       — Get current runtime configuration
    PUT  /api/v1/agent/config       — Update runtime configuration
    POST /api/v1/agent/faq          — Embed and save a FAQ entry
    GET  /api/v1/agent/faq          — List all embedded FAQ entries
"""

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent_service.config.settings import get_settings

# Environment-driven CORS origins
import os as _os
_EXTRA_CORS = [o.strip() for o in _os.getenv('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
from agent_service.db.audit_models import init_audit_db, get_audit_session
from agent_service.db.audit_writer import fetch_audit_logs
from agent_service.graph.agent_graph import run_agent_turn
from agent_service.graph.models import (
    ChatRequest,
    ChatResponse,
    Citation,
    EvalRequest,
    EvalResult,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory runtime config overrides (reset on server restart)
# ---------------------------------------------------------------------------
_runtime_config_overrides: dict[str, Any] = {}

# In-memory FAQ store (persisted to audit DB's faq table)
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Lifespan — initialise resources on startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    settings = get_settings()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(name)-30s  %(levelname)-7s  %(message)s",
    )
    logger.info("Initialising Agent Service …")
    logger.info("  Router model : %s", settings.ROUTER_MODEL_NAME)
    logger.info("  Synth model  : %s", settings.SYNTHESIS_MODEL_NAME)
    logger.info("  CRM DB       : %s", settings.CRM_DATABASE_URL[:60])
    logger.info("  Audit DB     : %s", settings.AUDIT_DATABASE_URL[:60])

    # Ensure audit tables exist (also creates faq table)
    init_audit_db()
    _ensure_faq_table()
    logger.info("Audit database ready.")

    yield  # ── app is running ──

    logger.info("Shutting down Agent Service.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CRM B2BTrader — AI Agent Service",
    description=(
        "Inventory-grounded conversational agent that answers product, stock, "
        "and pricing questions exclusively from live database queries."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ] + _EXTRA_CORS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Instagram webhook router
from agent_service.api.webhooks.instagram import router as ig_router  # noqa: E402
app.include_router(ig_router)


# ---------------------------------------------------------------------------
# In-memory session store (lightweight multi-turn memory)
# ---------------------------------------------------------------------------
# Maps session_id → list of BaseMessage objects.
# In production this would be backed by Redis or a database.
_session_store: dict[str, list] = {}


# ---------------------------------------------------------------------------
# POST /api/v1/agent/chat
# ---------------------------------------------------------------------------

@app.post("/api/v1/agent/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Process a customer chat message through the agent graph."""
    settings = get_settings()

    if not settings.OPENROUTER_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY is not configured. Set it in agent_service/.env",
        )

    # Retrieve prior messages for multi-turn context
    prior_messages = _session_store.get(request.session_id, [])

    # Run the graph
    try:
        final_state = run_agent_turn(
            message_text=request.message_text,
            session_id=request.session_id,
            customer_id=request.customer_id,
            prior_messages=prior_messages[-settings.MAX_CONTEXT_TURNS * 2:],
        )
    except Exception as exc:
        logger.exception("Agent graph execution failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Persist messages for future turns
    _session_store[request.session_id] = final_state.get("messages", [])

    # Build response
    citations: list[Citation] = []
    for c in final_state.get("citations", []):
        citations.append(Citation(
            source_table=c.get("source_table", ""),
            record_id=c.get("record_id", ""),
            field_values=c.get("field_values", {}),
            lookup_time=c.get("lookup_time", ""),
        ))

    return ChatResponse(
        response_text=final_state.get("response_text", ""),
        citations=citations,
        session_id=request.session_id,
        turn_id=final_state.get("turn_id", ""),
        intent=final_state.get("intent"),
        confidence=final_state.get("confidence"),
        escalation_flag=final_state.get("escalation_flag", False),
    )


# ---------------------------------------------------------------------------
# GET /api/v1/agent/audit/logs
# ---------------------------------------------------------------------------

@app.get("/api/v1/agent/audit/logs")
async def audit_logs_endpoint(
    session_id: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    """Retrieve paginated audit logs with optional filters."""
    try:
        return fetch_audit_logs(
            session_id=session_id,
            customer_id=customer_id,
            limit=limit,
            offset=offset,
        )
    except Exception as exc:
        logger.exception("Audit log retrieval failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# POST /api/v1/agent/eval/run
# ---------------------------------------------------------------------------

@app.post("/api/v1/agent/eval/run", response_model=EvalResult)
async def eval_run_endpoint(request: EvalRequest) -> EvalResult:
    """Run a DeepEval evaluation suite."""
    try:
        from agent_service.eval.test_suite import run_evaluation_suite
        result = run_evaluation_suite(test_suite_path=request.test_suite_path)
        return result
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="DeepEval is not installed. Install with: pip install deepeval",
        )
    except Exception as exc:
        logger.exception("Evaluation suite failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------------------------------------------------------------------------
# GET /api/v1/agent/health
# ---------------------------------------------------------------------------

@app.get("/api/v1/agent/health")
async def health_endpoint() -> dict[str, Any]:
    """Simple health check."""
    settings = get_settings()
    cfg = _get_effective_config(settings)
    return {
        "status": "healthy",
        "router_model": cfg["router_model_name"],
        "synthesis_model": cfg["synthesis_model_name"],
        "confidence_threshold": cfg["confidence_threshold"],
        "api_key_configured": "yes" if settings.OPENROUTER_API_KEY else "no",
    }


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def _get_effective_config(settings) -> dict[str, Any]:
    """Merge base settings with runtime overrides."""
    return {
        "router_model_name": _runtime_config_overrides.get(
            "router_model_name", settings.ROUTER_MODEL_NAME
        ),
        "synthesis_model_name": _runtime_config_overrides.get(
            "synthesis_model_name", settings.SYNTHESIS_MODEL_NAME
        ),
        "confidence_threshold": _runtime_config_overrides.get(
            "confidence_threshold", settings.CONFIDENCE_THRESHOLD
        ),
        "max_context_turns": _runtime_config_overrides.get(
            "max_context_turns", settings.MAX_CONTEXT_TURNS
        ),
        "max_graph_iterations": _runtime_config_overrides.get(
            "max_graph_iterations", settings.MAX_GRAPH_ITERATIONS
        ),
        # API key: return masked version
        "api_key_preview": (
            settings.OPENROUTER_API_KEY[:8] + "..." + settings.OPENROUTER_API_KEY[-4:]
            if len(settings.OPENROUTER_API_KEY) > 12
            else ("configured" if settings.OPENROUTER_API_KEY else "")
        ),
        "api_key_configured": bool(settings.OPENROUTER_API_KEY),
        # Instagram config (secrets masked)
        "ig_enabled": _runtime_config_overrides.get("ig_enabled", settings.IG_ENABLED),
        "ig_app_id": _runtime_config_overrides.get("ig_app_id", settings.IG_APP_ID),
        "ig_app_secret_configured": bool(settings.IG_APP_SECRET),
        "ig_verify_token": _runtime_config_overrides.get("ig_verify_token", settings.IG_VERIFY_TOKEN),
        "ig_access_token_configured": bool(settings.IG_ACCESS_TOKEN),
        "ig_account_id": _runtime_config_overrides.get("ig_account_id", settings.IG_ACCOUNT_ID),
        "ig_api_base_url": _runtime_config_overrides.get("ig_api_base_url", settings.IG_API_BASE_URL),
        "ig_api_version": _runtime_config_overrides.get("ig_api_version", settings.IG_API_VERSION),
        "ig_onboarding_required": _runtime_config_overrides.get("ig_onboarding_required", settings.IG_ONBOARDING_REQUIRED),
    }


# ---------------------------------------------------------------------------
# Pydantic models for config
# ---------------------------------------------------------------------------

class ConfigUpdateRequest(BaseModel):
    router_model_name: Optional[str] = None
    synthesis_model_name: Optional[str] = None
    confidence_threshold: Optional[float] = None
    max_context_turns: Optional[int] = None
    max_graph_iterations: Optional[int] = None
    openrouter_api_key: Optional[str] = None  # Only stored in-memory for session
    # Instagram config
    ig_enabled: Optional[bool] = None
    ig_app_id: Optional[str] = None
    ig_verify_token: Optional[str] = None
    ig_account_id: Optional[str] = None
    ig_api_base_url: Optional[str] = None
    ig_api_version: Optional[str] = None
    ig_onboarding_required: Optional[bool] = None


# ---------------------------------------------------------------------------
# GET /api/v1/agent/config
# ---------------------------------------------------------------------------

@app.get("/api/v1/agent/config")
async def get_config() -> dict[str, Any]:
    """Return current runtime configuration (API key is masked)."""
    settings = get_settings()
    return _get_effective_config(settings)


# ---------------------------------------------------------------------------
# PUT /api/v1/agent/config
# ---------------------------------------------------------------------------

@app.put("/api/v1/agent/config")
async def update_config(body: ConfigUpdateRequest) -> dict[str, Any]:
    """Update runtime configuration overrides (in-memory, resets on restart)."""
    settings = get_settings()

    if body.router_model_name is not None:
        _runtime_config_overrides["router_model_name"] = body.router_model_name

    if body.synthesis_model_name is not None:
        _runtime_config_overrides["synthesis_model_name"] = body.synthesis_model_name

    if body.confidence_threshold is not None:
        if not 0.0 <= body.confidence_threshold <= 1.0:
            raise HTTPException(status_code=422, detail="confidence_threshold must be between 0.0 and 1.0")
        _runtime_config_overrides["confidence_threshold"] = body.confidence_threshold

    if body.max_context_turns is not None:
        _runtime_config_overrides["max_context_turns"] = body.max_context_turns

    if body.max_graph_iterations is not None:
        _runtime_config_overrides["max_graph_iterations"] = body.max_graph_iterations

    # Note: API key updates are accepted but not persisted (security)
    if body.openrouter_api_key:
        logger.info("API key update received (not persisted to disk — update .env file to persist)")

    # Instagram config overrides
    if body.ig_enabled is not None:
        _runtime_config_overrides["ig_enabled"] = body.ig_enabled
    if body.ig_app_id is not None:
        _runtime_config_overrides["ig_app_id"] = body.ig_app_id
    if body.ig_verify_token is not None:
        _runtime_config_overrides["ig_verify_token"] = body.ig_verify_token
    if body.ig_account_id is not None:
        _runtime_config_overrides["ig_account_id"] = body.ig_account_id
    if body.ig_api_base_url is not None:
        _runtime_config_overrides["ig_api_base_url"] = body.ig_api_base_url
    if body.ig_api_version is not None:
        _runtime_config_overrides["ig_api_version"] = body.ig_api_version
    if body.ig_onboarding_required is not None:
        _runtime_config_overrides["ig_onboarding_required"] = body.ig_onboarding_required

    logger.info("Runtime config updated: %s", _runtime_config_overrides)
    return {"status": "updated", "config": _get_effective_config(settings)}


# ---------------------------------------------------------------------------
# GET /api/v1/agent/instagram/verify — test Instagram connection
# ---------------------------------------------------------------------------

@app.get("/api/v1/agent/instagram/verify")
async def verify_instagram_connection() -> dict[str, Any]:
    """Ping the Instagram Graph API to verify token validity."""
    import httpx
    settings = get_settings()
    cfg = _get_effective_config(settings)

    access_token = settings.IG_ACCESS_TOKEN
    if not access_token:
        return {"ok": False, "error": "IG_ACCESS_TOKEN not configured"}

    base_url = cfg.get("ig_api_base_url", settings.IG_API_BASE_URL)
    version = cfg.get("ig_api_version", settings.IG_API_VERSION)
    account_id = cfg.get("ig_account_id", settings.IG_ACCOUNT_ID)

    if not account_id:
        return {"ok": False, "error": "IG_ACCOUNT_ID not configured"}

    url = f"{base_url}/{version}/{account_id}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                url,
                params={"access_token": access_token, "fields": "id,name,username"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"ok": True, "account": data}
            else:
                return {"ok": False, "error": f"API returned {resp.status_code}: {resp.text[:200]}"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# FAQ table helpers
# ---------------------------------------------------------------------------

def _ensure_faq_table() -> None:
    """Create the faq table in the audit database if it doesn't exist."""
    import sqlalchemy as sa
    from agent_service.db.audit_models import _get_audit_engine
    engine = _get_audit_engine()
    with engine.connect() as conn:
        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS agent_faq (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """))
        conn.commit()


# ---------------------------------------------------------------------------
# Pydantic models for FAQ
# ---------------------------------------------------------------------------

class FaqCreateRequest(BaseModel):
    title: str
    content: str


class FaqEntry(BaseModel):
    id: str
    title: str
    content: str
    created_at: str


# ---------------------------------------------------------------------------
# POST /api/v1/agent/faq
# ---------------------------------------------------------------------------

@app.post("/api/v1/agent/faq", response_model=FaqEntry)
async def create_faq(body: FaqCreateRequest) -> FaqEntry:
    """Embed and save a FAQ entry to the audit database."""
    import sqlalchemy as sa
    from agent_service.db.audit_models import _get_audit_engine

    if not body.title.strip() or not body.content.strip():
        raise HTTPException(status_code=422, detail="Title and content are required")

    faq_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    engine = _get_audit_engine()
    with engine.connect() as conn:
        conn.execute(sa.text(
            "INSERT INTO agent_faq (id, title, content, created_at) VALUES (:id, :title, :content, :created_at)"
        ), {"id": faq_id, "title": body.title.strip(), "content": body.content.strip(), "created_at": now})
        conn.commit()

    logger.info("FAQ entry saved: id=%s title=%s", faq_id, body.title)
    return FaqEntry(id=faq_id, title=body.title.strip(), content=body.content.strip(), created_at=now)


# ---------------------------------------------------------------------------
# GET /api/v1/agent/faq
# ---------------------------------------------------------------------------

@app.get("/api/v1/agent/faq", response_model=list[FaqEntry])
async def list_faqs(limit: int = Query(default=100, le=500)) -> list[FaqEntry]:
    """List all embedded FAQ entries."""
    import sqlalchemy as sa
    from agent_service.db.audit_models import _get_audit_engine

    engine = _get_audit_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text("SELECT id, title, content, created_at FROM agent_faq ORDER BY created_at DESC LIMIT :limit"),
            {"limit": limit}
        ).fetchall()

    return [
        FaqEntry(id=row[0], title=row[1], content=row[2], created_at=row[3])
        for row in rows
    ]


# ---------------------------------------------------------------------------
# DELETE /api/v1/agent/faq/{faq_id}
# ---------------------------------------------------------------------------

@app.delete("/api/v1/agent/faq/{faq_id}")
async def delete_faq(faq_id: str) -> dict[str, str]:
    """Delete a FAQ entry by ID."""
    import sqlalchemy as sa
    from agent_service.db.audit_models import _get_audit_engine

    engine = _get_audit_engine()
    with engine.connect() as conn:
        result = conn.execute(
            sa.text("DELETE FROM agent_faq WHERE id = :id"),
            {"id": faq_id}
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="FAQ entry not found")

    return {"status": "deleted", "id": faq_id}
