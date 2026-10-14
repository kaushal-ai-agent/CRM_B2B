/**
 * AgentAudit.jsx — /admin/agent-audit
 *
 * Full observability dashboard for the AI Agent service:
 *   - Cost configuration panel (stored in localStorage)
 *   - Health/status overview bar
 *   - Aggregate KPI cards (total turns, avg latency, total cost, avg confidence)
 *   - High-density paginated audit log table
 *   - Row click → AuditDrawer slide-over
 *
 * Token/cost values use IBM Plex Mono.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  DollarSign,
  Clock,
  Target,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Filter,
  X,
  AlertTriangle,
} from 'lucide-react';
import { fetchAuditLogs, fetchAgentHealth, getAgentError } from '../api/agentService';
import AuditDrawer from '../components/agent/AuditDrawer';
import AgentErrorBoundary from '../components/agent/ErrorBoundary';

// ---------------------------------------------------------------------------
// localStorage-persisted cost config
// ---------------------------------------------------------------------------
const COST_STORAGE_KEY = 'agent_cost_config';

const DEFAULT_COST_CONFIG = {
  inputCostPer1k: 0.15,    // $/1k tokens
  outputCostPer1k: 0.60,   // $/1k tokens
  thinkingCostPer1k: 0.30, // $/1k tokens
};

function loadCostConfig() {
  try {
    const saved = localStorage.getItem(COST_STORAGE_KEY);
    return saved ? { ...DEFAULT_COST_CONFIG, ...JSON.parse(saved) } : DEFAULT_COST_CONFIG;
  } catch {
    return DEFAULT_COST_CONFIG;
  }
}

function saveCostConfig(cfg) {
  localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(cfg));
}

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------
function calcCost(log, costCfg) {
  const usage = log.token_usage || {};
  const input = usage.router_tokens || 0;
  const output = usage.synthesis_tokens || 0;
  const thinking = usage.thinking_tokens || 0;
  return (
    (input / 1000) * costCfg.inputCostPer1k +
    (output / 1000) * costCfg.outputCostPer1k +
    (thinking / 1000) * costCfg.thinkingCostPer1k
  );
}

function totalTokens(log) {
  const usage = log.token_usage || {};
  return (usage.router_tokens || 0) + (usage.synthesis_tokens || 0) + (usage.thinking_tokens || 0);
}

// ---------------------------------------------------------------------------
// Intent badge
// ---------------------------------------------------------------------------
const INTENT_STYLES = {
  PRODUCT_STOCK_QUERY: 'border-blue-200 bg-blue-50 text-blue-700',
  FAQ_QUERY: 'border-purple-200 bg-purple-50 text-purple-700',
  ORDERING_INTENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ESCALATION: 'border-rose-200 bg-rose-50 text-rose-700',
  GENERAL_CHAT: 'border-slate-200 bg-slate-50 text-slate-600',
};

function IntentBadge({ intent }) {
  const cls = INTENT_STYLES[intent] || 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <span className={`border px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>
      {intent || 'UNKNOWN'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({ icon: Icon, label, value, subValue, accent = false }) {
  return (
    <div className="border border-[#E0E0E0] bg-white p-5 flex items-center justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`font-mono text-2xl font-bold ${accent ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{value}</p>
        {subValue && <p className="text-xs text-slate-400 font-mono mt-0.5">{subValue}</p>}
      </div>
      <Icon size={22} className={accent ? 'text-[#2563EB]' : 'text-slate-400'} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost Configuration Panel
// ---------------------------------------------------------------------------
function CostConfigPanel({ config, onChange }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(config);

  useEffect(() => { setLocal(config); }, [config]);

  const handleSave = () => {
    saveCostConfig(local);
    onChange(local);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 border border-[#E0E0E0] bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <SlidersHorizontal size={13} />
        Cost Config
        {open ? <X size={11} /> : null}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-80 border border-[#E0E0E0] bg-white p-4 shadow-none">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Token Cost Configuration</p>
          <div className="space-y-3">
            {[
              { key: 'inputCostPer1k', label: 'Input Tokens ($/1K)' },
              { key: 'outputCostPer1k', label: 'Output Tokens ($/1K)' },
              { key: 'thinkingCostPer1k', label: 'Thinking Tokens ($/1K)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={local[key]}
                  onChange={(e) => setLocal((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full border border-[#E0E0E0] bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#2563EB]"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            className="mt-4 w-full bg-[#2563EB] text-white py-2 text-xs font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Audit Dashboard
// ---------------------------------------------------------------------------
export default function AgentAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [page, setPage] = useState(0);
  const [costConfig, setCostConfig] = useState(loadCostConfig);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filterSessionId, setFilterSessionId] = useState('');
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const autoRefreshRef = useRef(null);

  const PAGE_SIZE = 50;

  // ── Load logs ─────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
      if (filterSessionId.trim()) params.session_id = filterSessionId.trim();
      if (filterCustomerId.trim()) params.customer_id = filterCustomerId.trim();

      const data = await fetchAuditLogs(params);
      setLogs(data);
    } catch (err) {
      setError(getAgentError(err));
    } finally {
      setLoading(false);
    }
  }, [page, filterSessionId, filterCustomerId]);

  // ── Load health ────────────────────────────────────────────────────────────
  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const h = await fetchAgentHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); loadHealth(); }, [loadLogs, loadHealth]);

  // ── Auto-refresh ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => { loadLogs(); loadHealth(); }, 15000);
    } else {
      clearInterval(autoRefreshRef.current);
    }
    return () => clearInterval(autoRefreshRef.current);
  }, [autoRefresh, loadLogs, loadHealth]);

  // ── Computed KPIs ──────────────────────────────────────────────────────────
  const kpis = (() => {
    if (!logs.length) return { total: 0, avgLatency: 0, totalCost: 0, avgConf: 0, escalations: 0 };
    const total = logs.length;
    const avgLatency = logs.reduce((s, l) => s + (l.latency_ms || 0), 0) / total;
    const totalCost = logs.reduce((s, l) => s + calcCost(l, costConfig), 0);
    const confLogs = logs.filter((l) => l.model_confidence != null);
    const avgConf = confLogs.length
      ? confLogs.reduce((s, l) => s + l.model_confidence, 0) / confLogs.length
      : 0;
    const escalations = logs.filter((l) => l.router_classification === 'ESCALATION').length;
    return { total, avgLatency, totalCost, avgConf, escalations };
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight uppercase">Agent Observability</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time audit logs, token usage, and cost intelligence.</p>
        </div>
        <div className="flex items-center gap-2">
          <CostConfigPanel config={costConfig} onChange={setCostConfig} />
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition-colors ${
              autoRefresh
                ? 'border-[#2563EB] bg-[#2563EB] text-white'
                : 'border-[#E0E0E0] bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Activity size={13} className={autoRefresh ? 'animate-pulse' : ''} />
            {autoRefresh ? 'Live (15s)' : 'Auto-Refresh'}
          </button>
          <button
            onClick={() => { loadLogs(); loadHealth(); }}
            disabled={loading}
            className="inline-flex items-center gap-2 border border-[#E0E0E0] bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Health Status Bar */}
      <div className={`border p-4 flex items-center gap-4 flex-wrap ${
        health ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
      }`}>
        {healthLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw size={14} className="animate-spin" /> Checking agent health…
          </div>
        ) : health ? (
          <>
            <div className="flex items-center gap-2">
              <Wifi size={15} className="text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Agent Service Online</span>
            </div>
            <div className="h-4 w-px bg-emerald-200" />
            <span className="text-xs text-emerald-700">
              Router: <span className="font-mono font-semibold">{health.router_model}</span>
            </span>
            <span className="text-xs text-emerald-700">
              Synthesis: <span className="font-mono font-semibold">{health.synthesis_model}</span>
            </span>
            <span className="text-xs text-emerald-700">
              Threshold: <span className="font-mono font-semibold">{health.confidence_threshold}</span>
            </span>
            <span className="text-xs text-emerald-700">
              API Key: <span className="font-mono font-semibold">{health.api_key_configured === 'yes' ? '✓ Configured' : '✗ Missing'}</span>
            </span>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <WifiOff size={15} className="text-slate-500" />
            <span className="text-sm font-semibold text-slate-600">Agent Service Offline — Start it on port 8100</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          icon={MessageSquare}
          label="Total Turns"
          value={kpis.total}
          subValue={`Page ${page + 1}`}
        />
        <KpiCard
          icon={Clock}
          label="Avg Latency"
          value={`${kpis.avgLatency.toFixed(0)}ms`}
          accent
        />
        <KpiCard
          icon={DollarSign}
          label="Total Est. Cost"
          value={`$${kpis.totalCost.toFixed(4)}`}
          subValue="based on cost config"
        />
        <KpiCard
          icon={Target}
          label="Avg Confidence"
          value={`${(kpis.avgConf * 100).toFixed(0)}%`}
          accent
        />
        <KpiCard
          icon={AlertTriangle}
          label="Escalations"
          value={kpis.escalations}
          subValue={kpis.total ? `${((kpis.escalations / kpis.total) * 100).toFixed(0)}% of total` : ''}
        />
      </div>

      {/* Filters */}
      <div className="border border-[#E0E0E0] bg-white p-4 flex items-center gap-4 flex-wrap">
        <Filter size={14} className="text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Session ID</label>
          <input
            type="text"
            value={filterSessionId}
            onChange={(e) => { setFilterSessionId(e.target.value); setPage(0); }}
            placeholder="Filter by session…"
            className="border border-[#E0E0E0] px-3 py-1.5 text-xs font-mono w-48 focus:outline-none focus:border-[#2563EB]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">Customer ID</label>
          <input
            type="text"
            value={filterCustomerId}
            onChange={(e) => { setFilterCustomerId(e.target.value); setPage(0); }}
            placeholder="Filter by customer…"
            className="border border-[#E0E0E0] px-3 py-1.5 text-xs font-mono w-48 focus:outline-none focus:border-[#2563EB]"
          />
        </div>
        {(filterSessionId || filterCustomerId) && (
          <button
            onClick={() => { setFilterSessionId(''); setFilterCustomerId(''); setPage(0); }}
            className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800"
          >
            <X size={11} /> Clear Filters
          </button>
        )}
      </div>

      {/* Audit Table */}
      <div className="border border-[#E0E0E0] bg-white">
        {error && (
          <div className="p-6 border-b border-rose-200 bg-rose-50 flex items-center gap-3">
            <AlertTriangle size={16} className="text-rose-500" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs whitespace-nowrap">
            <thead className="sticky top-0 bg-[#0F172A] z-10">
              <tr>
                {[
                  'Turn ID', 'Timestamp', 'Customer ID',
                  'Intent', 'Confidence', 'Tokens (In/Out)', 'Est. Cost', 'Latency', 'Action'
                ].map((col) => (
                  <th key={col} className={`px-4 py-3 font-semibold text-slate-300 uppercase tracking-wide ${col === 'Action' ? 'text-right' : ''}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E0E0]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-slate-100 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    <MessageSquare size={24} className="mx-auto mb-2 text-slate-300" />
                    No audit logs found. Start chatting with the agent to generate logs.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const cost = calcCost(log, costConfig);
                  const toks = totalTokens(log);
                  const usage = log.token_usage || {};
                  const inputToks = usage.router_tokens || 0;
                  const outputToks = usage.synthesis_tokens || 0;
                  const isEscalation = log.router_classification === 'ESCALATION';

                  return (
                    <tr
                      key={log.id || log.turn_id || idx}
                      onClick={() => setSelectedLog(log)}
                      className={`cursor-pointer transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      } hover:bg-blue-50 hover:border-l-2 hover:border-l-[#2563EB] ${
                        isEscalation ? 'border-l-2 border-l-rose-400' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                        {(log.turn_id || log.id || '').substring(0, 12)}…
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#0F172A] font-medium">
                        {log.customer_id || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <IntentBadge intent={log.router_classification} />
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">
                        {log.model_confidence != null ? (
                          <span className={
                            log.model_confidence >= 0.8 ? 'text-emerald-600'
                            : log.model_confidence >= 0.5 ? 'text-amber-600'
                            : 'text-rose-600'
                          }>
                            {(log.model_confidence * 100).toFixed(0)}%
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {toks > 0 ? (
                          <span>
                            <span className="text-slate-500">{inputToks}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-[#0F172A] font-semibold">{outputToks}</span>
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-[#0F172A]">
                        {toks > 0 ? `$${cost.toFixed(5)}` : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {log.latency_ms != null ? (
                          <span className={log.latency_ms > 5000 ? 'text-rose-600' : log.latency_ms > 2000 ? 'text-amber-600' : 'text-emerald-600'}>
                            {log.latency_ms.toFixed(0)} ms
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="inline-flex items-center gap-1 text-[#2563EB] hover:text-[#1D4ED8] font-semibold text-xs border border-[#2563EB]/30 hover:border-[#2563EB] bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 transition-colors"
                        >
                          Inspect <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E0E0E0] bg-slate-50">
          <p className="text-xs text-slate-500 font-mono">
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + logs.length} of current page
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="inline-flex items-center gap-1.5 border border-[#E0E0E0] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft size={13} /> Prev
            </button>
            <span className="font-mono text-xs text-slate-600 border border-[#E0E0E0] px-3 py-1.5">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < PAGE_SIZE || loading}
              className="inline-flex items-center gap-1.5 border border-[#E0E0E0] px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Drill-Down Drawer */}
      <AgentErrorBoundary label="Audit Drawer">
        {selectedLog && (
          <AuditDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </AgentErrorBoundary>
    </div>
  );
}
