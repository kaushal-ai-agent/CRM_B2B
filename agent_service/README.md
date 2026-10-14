# Agent Service — Inventory-Grounded Conversational AI

A decoupled FastAPI microservice that answers stock, price, and product
questions **exclusively** from live database queries — never from parametric
memory.

## Architecture

```
agent_service/
├── app.py                     # FastAPI application + endpoints
├── config/
│   ├── settings.py            # pydantic-settings configuration
│   └── llm_factory.py        # OpenRouter LLM factory (dual-model)
├── db/
│   ├── schema_config.yaml     # Runtime schema descriptor
│   ├── schema_descriptor.py   # Schema registry loader
│   ├── adapter.py             # Read-only SQLAlchemy adapter
│   ├── audit_models.py        # Audit store ORM
│   └── audit_writer.py        # Audit + CRM writeback
├── graph/
│   ├── models.py              # Pydantic request/response models
│   ├── guardrails.py          # Input/output guardrails
│   ├── state.py               # AgentState TypedDict
│   ├── agent_graph.py         # LangGraph state machine
│   └── nodes/
│       ├── router_node.py     # Intent classification
│       ├── tool_node.py       # Live DB query tools
│       ├── synthesis_node.py  # Grounded response synthesis
│       └── audit_node.py      # Audit logging
├── eval/
│   ├── metrics.py             # DeepEval metric definitions
│   └── test_suite.py          # Default + configurable test suites
└── tests/
    ├── test_agent_cli.py      # Interactive CLI harness
    └── test_scenarios.py      # Comprehensive pytest suite
```

## Quick Start

### 1. Install dependencies

```bash
pip install -r agent_service/requirements.txt
```

### 2. Configure environment

```bash
cp agent_service/.env.example agent_service/.env
# Edit .env and set your OPENROUTER_API_KEY
```

### 3. Start the server

```bash
uvicorn agent_service.app:app --host 0.0.0.0 --port 8100 --reload
```

### 4. Test the health endpoint

```bash
curl http://localhost:8100/api/v1/agent/health
```

### 5. Send a chat message

```bash
curl -X POST http://localhost:8100/api/v1/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message_text": "What is the price and stock of QBE-751?",
    "session_id": "test-001"
  }'
```

### 6. View audit logs

```bash
curl http://localhost:8100/api/v1/agent/audit/logs
```

### 7. Run the CLI test harness

```bash
python -m agent_service.tests.test_agent_cli
```

### 8. Run the pytest suite

```bash
pytest agent_service/tests/test_scenarios.py -v
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/agent/chat` | Process a customer chat message |
| `GET` | `/api/v1/agent/audit/logs` | Retrieve paginated audit logs |
| `POST` | `/api/v1/agent/eval/run` | Run DeepEval evaluation suite |
| `GET` | `/api/v1/agent/health` | Health check |

## Design Principles

1. **Zero Hallucination**: The agent never answers stock/price questions from memory.
   Every answer is backed by a live SQL query with full citation provenance.

2. **Schema Agnostic**: Database structure is defined in `schema_config.yaml`,
   not hardcoded. Swap the YAML to point at a different database.

3. **Dual-Model Routing**: Fast/cheap model for intent classification,
   high-precision model for grounded synthesis.

4. **Full Auditability**: Every turn logs routing decisions, tool calls,
   raw SQL, DB output, response text, and latency to a dedicated audit store.

5. **Out-of-Stock Fallback**: When a product is OOS, the agent automatically
   suggests up to 3 in-stock alternatives from the same category.
