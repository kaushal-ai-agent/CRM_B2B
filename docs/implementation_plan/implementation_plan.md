# AI Agent Frontend — Implementation Plan

## Overview
Build 4 major UI features integrating the `agent_service` (FastAPI on port 8100) into the existing React/Vite CRM frontend. Strictly follows the **Pragmatic Modernism** design system: IBM Plex Sans UI, IBM Plex Mono data, Navy `#0F172A`, Blue `#2563EB`, White `#FFFFFF`, `0px` border-radius, `1px solid #E0E0E0` borders.

Agent service base: `http://localhost:8100`
CRM backend base: `http://127.0.0.1:8000/api/v1/`

---

## Architecture

### New File Structure
```
frontend/src/
├── api/
│   ├── customerService.js         (existing)
│   └── agentService.js            [NEW] Agent API client
├── components/
│   ├── agent/
│   │   ├── ErrorBoundary.jsx      [NEW] Generic agent error boundary
│   │   ├── AgentChatWidget.jsx    [NEW] Chat widget for Customer360
│   │   ├── AuditDrawer.jsx        [NEW] Turn drill-down slide-over
│   │   └── CitationBadge.jsx      [NEW] DB citation pill component
│   ├── customer/                  (existing dir)
│   ├── layout/                    (existing dir)
│   └── SettingsModal.jsx          (existing)
└── pages/
    ├── AgentSettings.jsx           [NEW] /admin/agent-settings
    ├── AgentAudit.jsx              [NEW] /admin/agent-audit
    ├── Customer360.jsx             [MODIFY] Add AI Chat tab
    ├── Dashboard.jsx               (existing)
    ├── CustomerMaster.jsx          (existing)
    └── Login.jsx                   (existing)
```

### API Endpoints Used
| Method | URL | Purpose |
|--------|-----|---------|
| POST | `/api/v1/agent/chat` | Send message, receive grounded response + citations |
| GET | `/api/v1/agent/audit/logs` | Paginated audit log table |
| GET | `/api/v1/agent/health` | Agent service health |
| GET | `/api/v1/agent/config` | Get current config (to be added to agent service) |
| PUT | `/api/v1/agent/config` | Update config (to be added) |
| POST | `/api/v1/agent/faq` | Embed FAQ text (to be added) |
| GET | `/api/v1/agent/faq` | List embedded FAQs (to be added) |

> **Note:** Config & FAQ endpoints don't exist yet in `app.py`. We will add them.

---

## Proposed Changes

### New API Layer

#### [NEW] `src/api/agentService.js`
- `agentClient` — Axios instance pointing to `http://localhost:8100`
- `sendChatMessage(payload)` — POST `/api/v1/agent/chat`
- `fetchAuditLogs(params)` — GET `/api/v1/agent/audit/logs`
- `fetchAgentHealth()` — GET `/api/v1/agent/health`
- `getAgentConfig()` — GET `/api/v1/agent/config`
- `updateAgentConfig(data)` — PUT `/api/v1/agent/config`
- `embedFaq(text)` — POST `/api/v1/agent/faq`
- `listFaqs()` — GET `/api/v1/agent/faq`

---

### Backend Extension (agent_service)

#### [MODIFY] `agent_service/app.py`
Add 4 new endpoints:
- `GET /api/v1/agent/config` — Returns current `AgentSettings` (masked API key)
- `PUT /api/v1/agent/config` — Updates runtime settings (router model, synthesis model, confidence threshold)
- `POST /api/v1/agent/faq` — Accepts `{ text: string, title?: string }`, stores in simple SQLite table for now
- `GET /api/v1/agent/faq` — Returns list of embedded FAQs

---

### New Frontend Components

#### [NEW] `src/components/agent/ErrorBoundary.jsx`
Class-based React ErrorBoundary with `fallback` prop support. Catches render errors from all agent components. Shows a bordered offline state card without crashing the SPA.

#### [NEW] `src/api/agentService.js`
Centralized agent API client with timeout handling and error normalization.

#### [NEW] `src/pages/AgentSettings.jsx` — Route: `/admin/agent-settings`
**Section 1: LLM Configuration**
- `OPENROUTER_API_KEY` — password input with toggle mask
- Router Model dropdown (presets: `openai/gpt-4o-mini`, `anthropic/claude-3-haiku`, `+ Custom`)
- Synthesis Model dropdown (presets: `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`, `+ Custom`)
- Confidence Threshold slider (0.0 → 1.0, step 0.05, numeric display)
- `Save Configuration` button with success/error feedback

**Section 2: FAQ Knowledge Base**
- Textarea for FAQ content (title + body)
- `Embed & Save` button → POST `/api/v1/agent/faq`
- List of existing FAQs in a clean table below

#### [NEW] `src/pages/AgentAudit.jsx` — Route: `/admin/agent-audit`
**Section 1: Cost Configuration Panel**
- Input fields for cost-per-token: Input tokens ($/1K), Output tokens ($/1K), Thinking tokens ($/1K)
- Stored in `localStorage` so it persists per browser

**Section 2: Observability Health Bar**
- Real-time health status (GET `/api/v1/agent/health`) with model names
- Aggregate stats: Total turns today, avg latency, total estimated cost, avg confidence score

**Section 3: High-Density Audit Table**
- Columns: `Turn ID`, `Timestamp`, `Customer ID`, `Intent`, `Confidence`, `Input Tokens`, `Output Tokens`, `Est. Cost`, `Latency (ms)`
- Token/cost columns use `IBM Plex Mono` font
- Row click → opens `AuditDrawer`
- Pagination controls (limit/offset)
- Filters: session_id, customer_id

#### [NEW] `src/components/agent/AuditDrawer.jsx`
- Right-side slide-over, 800px wide
- Overlay backdrop, Escape key to close
- **Timeline accordion sections:**
  1. 📥 **Input** — Original query + sanitized query diff
  2. 🧭 **Routing** — Intent classification + confidence score bar
  3. 🔧 **Tool Execution** — Tool name, SQL query in code block, raw DB results as table
  4. 💬 **Synthesis** — Final response text
  5. 📌 **Citations** — Citation cards (table, record ID, field values, lookup time)
  6. 📊 **Telemetry** — Latency breakdown per node, token usage

#### [MODIFY] `src/pages/Customer360.jsx`
- Add `'ai-chat'` tab to the existing tab bar: **"AI Sales Assistant"**
- Render `AgentChatWidget` inside the tab
- Wrap in `ErrorBoundary`

#### [NEW] `src/components/agent/AgentChatWidget.jsx`
- Chat interface: message bubbles (user = right blue, agent = left white)
- Input bar with send button
- Citations displayed as expandable accordion below agent messages
- Session ID = `customer_${id}_${Date.now()}` (stable per component mount)
- Passes `customer_id` from URL param
- Shows escalation flag warning if `escalation_flag: true`
- Loading skeleton during API call

#### [MODIFY] `src/App.jsx`
Add new routes:
```
/admin/agent-settings → AgentSettings
/admin/agent-audit    → AgentAudit
```

#### [MODIFY] `src/components/layout/DashboardLayout.jsx`
Add new nav section "AI Agent" with links to:
- Agent Settings (`/admin/agent-settings`)
- Audit Dashboard (`/admin/agent-audit`)

---

## Verification Plan

### Automated
- `npm run build` — zero compilation errors
- `npm run lint` — zero lint warnings

### Manual
- Agent offline → all agent components show graceful fallback
- Settings page saves & reflects config
- Audit table loads, filters work, row click opens drawer
- Drawer shows all lifecycle sections for a log entry
- Customer360 AI tab sends message, renders response with citations
