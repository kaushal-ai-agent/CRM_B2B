/**
 * AuditDrawer.jsx
 * Right-side slide-over drawer (800px) showing the full lifecycle of a single
 * agent conversation turn: Input → Routing → Tool Execution → Synthesis → Citations → Telemetry.
 */

import { useEffect, useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Compass,
  Wrench,
  FileText,
  BookMarked,
  BarChart2,
  AlertTriangle,
  Database,
  Code2,
  Clock,
  Zap,
  Settings,
  Sparkles
} from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import { agentClient } from '../../api/agentService';
import ExecutionTraceViewer from './ExecutionTraceViewer';

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function LatencyBar({ label, ms = 0, total = 1 }) {
  const numMs = Number(ms) || 0;
  const numTotal = Number(total) || 1;
  const pct = numTotal > 0 ? Math.min(100, Math.round((numMs / numTotal) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-slate-600 capitalize">{label}</span>
        <span className="text-[#0F172A] font-semibold">{numMs.toFixed(0)} ms ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-slate-100 border border-[#E0E0E0] overflow-hidden">
        <div className="h-full bg-[#2563EB] transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AccordionSection({ icon: Icon, title, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#E0E0E0]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <Icon size={15} className="text-[#2563EB] shrink-0" />
        <span className="text-sm font-semibold text-[#0F172A] flex-1">{title}</span>
        {badge && (
          <span className="font-mono text-xs border border-slate-200 bg-white px-2 py-0.5 text-slate-600">{badge}</span>
        )}
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
      </button>
      {open && <div className="p-4 bg-white">{children}</div>}
    </div>
  );
}

function MetaRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#E0E0E0] last:border-0">
      <span className="text-xs font-medium text-slate-500 w-36 shrink-0 uppercase tracking-wide pt-0.5">{label}</span>
      <span className={`text-sm text-[#0F172A] break-all ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  const color = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 border border-[#E0E0E0]">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-sm font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

function SqlBlock({ sql }) {
  if (!sql) return <span className="text-xs text-slate-400 italic">No SQL recorded</span>;
  return (
    <pre className="bg-[#0F172A] text-emerald-300 font-mono text-xs p-4 overflow-x-auto whitespace-pre-wrap border border-[#0F172A]">
      {sql}
    </pre>
  );
}

function JsonBlock({ data }) {
  if (!data) return <span className="text-xs text-slate-400 italic">No data</span>;
  return (
    <pre className="bg-slate-50 text-slate-700 font-mono text-xs p-4 overflow-x-auto whitespace-pre-wrap border border-[#E0E0E0]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Tool Call card
// ---------------------------------------------------------------------------
function ToolCallCard({ call, index }) {
  return (
    <div className="border border-[#E0E0E0] bg-slate-50">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E0E0E0] bg-white">
        <span className="font-mono text-xs font-bold text-[#2563EB] border border-[#2563EB] px-2 py-0.5">
          #{index + 1}
        </span>
        <span className="font-mono text-sm font-semibold text-[#0F172A]">{call.tool_name || 'unknown_tool'}</span>
      </div>
      <div className="p-4 space-y-4">
        {call.input_args && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Input Arguments</p>
            <JsonBlock data={call.input_args} />
          </div>
        )}
        {call.sql_executed && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Code2 size={11} />
              SQL Executed
            </p>
            <SqlBlock sql={call.sql_executed} />
          </div>
        )}
        {call.raw_output && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Raw DB Output</p>
            {Array.isArray(call.raw_output) && call.raw_output.length > 0 ? (
              <div className="overflow-x-auto border border-[#E0E0E0]">
                <table className="min-w-full text-xs font-mono">
                  <thead className="bg-slate-100 border-b border-[#E0E0E0]">
                    <tr>
                      {Object.keys(call.raw_output[0]).map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E0E0E0]">
                    {call.raw_output.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-slate-700 whitespace-nowrap">{String(v ?? '—')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <JsonBlock data={call.raw_output} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation card
// ---------------------------------------------------------------------------
function CitationCard({ citation, _index }) {
  return (
    <div className="border border-[#E0E0E0] p-4 space-y-2 bg-white">
      <div className="flex items-center gap-2">
        <Database size={13} className="text-[#2563EB]" />
        <span className="font-mono text-xs font-semibold text-[#0F172A]">{citation.source_table}</span>
        <span className="ml-auto font-mono text-xs text-slate-500 border border-[#E0E0E0] px-2 py-0.5">
          ID: {citation.record_id}
        </span>
      </div>
      {citation.field_values && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {Object.entries(citation.field_values).map(([k, v]) => (
            <div key={k} className="bg-slate-50 border border-[#E0E0E0] px-3 py-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{k}</p>
              <p className="font-mono text-sm font-semibold text-[#0F172A] mt-0.5">{String(v)}</p>
            </div>
          ))}
        </div>
      )}
      {citation.lookup_time && (
        <p className="font-mono text-xs text-slate-400 flex items-center gap-1">
          <Clock size={10} />
          Lookup: {citation.lookup_time}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing Modal
// ---------------------------------------------------------------------------
function PricingModal({ onClose }) {
  const [modelName, setModelName] = useState('openai/gpt-4o-mini');
  const [inputPrice, setInputPrice] = useState(0.15);
  const [outputPrice, setOutputPrice] = useState(0.60);
  const [thinkingPrice, setThinkingPrice] = useState(0.60);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    agentClient.get('/api/v1/agent/config/pricing').then(res => {
      if (res.data.pricing && res.data.pricing.length > 0) {
        const p = res.data.pricing[0];
        setModelName(p.model_name);
        setInputPrice(p.input_price_per_1m);
        setOutputPrice(p.output_price_per_1m);
        setThinkingPrice(p.thinking_price_per_1m);
      }
    }).catch(console.error);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await agentClient.post('/api/v1/agent/config/pricing', {
        model_name: modelName,
        input_price_per_1m: inputPrice,
        output_price_per_1m: outputPrice,
        thinking_price_per_1m: thinkingPrice,
        currency: 'USD'
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
      <div className="bg-white border border-[#E0E0E0] w-[400px] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-[#E0E0E0]">
          <h3 className="text-sm font-semibold text-[#0F172A]">Configure Token Pricing</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Active Model</label>
            <input value={modelName} onChange={e => setModelName(e.target.value)} className="w-full border border-[#E0E0E0] px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Input Price / 1M Tokens (USD)</label>
            <input type="number" step="0.001" value={inputPrice} onChange={e => setInputPrice(Number(e.target.value))} className="w-full border border-[#E0E0E0] px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Output Price / 1M Tokens (USD)</label>
            <input type="number" step="0.001" value={outputPrice} onChange={e => setOutputPrice(Number(e.target.value))} className="w-full border border-[#E0E0E0] px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Thinking Price / 1M Tokens (USD)</label>
            <input type="number" step="0.001" value={thinkingPrice} onChange={e => setThinkingPrice(Number(e.target.value))} className="w-full border border-[#E0E0E0] px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] transition-colors">
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Drawer
// ---------------------------------------------------------------------------

export default function AuditDrawer({ log, onClose }) {
  const [visible, setVisible] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('trace'); // 'trace' | 'overview'

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));

    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  if (!log) return null;

  const toolCalls = Array.isArray(log.tool_calls) ? log.tool_calls : [];
  const citations = Array.isArray(log.citations) ? log.citations : [];
  const tokenUsage = log.token_usage || {};

  // Compute latency breakdown if stored (or synthesize from total)
  const totalLatency = log.latency_ms || 0;
  const nodeLatencies = log.node_latencies || {};

  // Intent badge color
  const intentColors = {
    PRODUCT_STOCK_QUERY: 'border-blue-200 bg-blue-50 text-blue-700',
    FAQ_QUERY: 'border-purple-200 bg-purple-50 text-purple-700',
    ORDERING_INTENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    ESCALATION: 'border-rose-200 bg-rose-50 text-rose-700',
    GENERAL_CHAT: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  const intentCls = intentColors[log.router_classification] || 'border-slate-200 bg-slate-50 text-slate-700';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-[800px] bg-white z-50 flex flex-col border-l border-[#E0E0E0] transition-transform duration-300"
        style={{ transform: visible ? 'translateX(0)' : 'translateX(100%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0] bg-[#0F172A] shrink-0">
          <div className="flex items-center gap-3">
            <Zap size={16} className="text-[#2563EB]" />
            <div>
              <p className="text-white font-semibold text-sm">Turn Drill-Down</p>
              <p className="font-mono text-slate-400 text-xs">{log.turn_id || log.id}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Strip */}
        <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-[#E0E0E0] shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Intent</span>
            <span className={`border px-2 py-0.5 text-xs font-semibold ${intentCls}`}>
              {log.router_classification || 'UNKNOWN'}
            </span>
          </div>
          {log.model_confidence != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Confidence</span>
              <span className="font-mono text-xs font-semibold text-[#0F172A]">
                {(log.model_confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-slate-400" />
            <span className="font-mono text-xs text-slate-600">{totalLatency?.toFixed(0)} ms</span>
          </div>
          {log.customer_id && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-slate-500">Customer</span>
              <span className="font-mono text-xs font-semibold text-[#0F172A]">{log.customer_id}</span>
            </div>
          )}
        </div>

        {/* View Mode Tabs */}
        <div className="flex border-b border-[#E0E0E0] bg-white px-6 shrink-0">
          <button
            onClick={() => setActiveTab('trace')}
            className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'trace'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            <Sparkles size={13} />
            Step-by-Step Execution Trace
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-slate-500 hover:text-[#0F172A]'
            }`}
          >
            <BarChart2 size={13} />
            Turn Details & Telemetry
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {activeTab === 'trace' ? (
            <ExecutionTraceViewer
              executionTrace={log.execution_trace}
              toolCalls={toolCalls}
              fallbackQuery={log.inbound_query}
              fallbackResponse={log.grounded_response}
              fallbackIntent={log.router_classification}
            />
          ) : (
            <>
              {/* 1. Input */}
              <AccordionSection icon={MessageSquare} title="Input — Customer Query" defaultOpen>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Original Query</p>
                    <div className="border border-[#E0E0E0] bg-slate-50 p-4 text-sm text-[#0F172A]">
                      {log.inbound_query || <span className="italic text-slate-400">Not recorded</span>}
                    </div>
                  </div>
                  {log.sanitized_input && log.sanitized_input !== log.inbound_query && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Sanitized Input
                        <span className="ml-2 text-amber-600 font-normal normal-case">(modified by guardrails)</span>
                      </p>
                      <div className="border border-amber-200 bg-amber-50 p-4 text-sm text-[#0F172A]">
                        {log.sanitized_input}
                      </div>
                    </div>
                  )}
                  <MetaRow label="Session ID" value={log.session_id} mono />
                  <MetaRow label="Timestamp" value={log.timestamp ? new Date(log.timestamp).toLocaleString() : '—'} mono />
                </div>
              </AccordionSection>

          {/* 2. Routing */}
          <AccordionSection icon={Compass} title="Routing — Intent Classification" defaultOpen>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`border px-3 py-1.5 text-sm font-semibold ${intentCls}`}>
                  {log.router_classification || 'UNKNOWN'}
                </span>
                {log.model_confidence != null && (
                  <div className="flex-1">
                    <ConfidenceBar value={log.model_confidence} />
                  </div>
                )}
              </div>
              {log.model_confidence != null && log.model_confidence < 0.8 && (
                <div className="flex items-center gap-2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <AlertTriangle size={13} />
                  Confidence below threshold — escalation may have been triggered.
                </div>
              )}
            </div>
          </AccordionSection>

          {/* 3. Tool Execution */}
          <AccordionSection
            icon={Wrench}
            title="Tool Execution"
            defaultOpen={toolCalls.length > 0}
            badge={toolCalls.length > 0 ? `${toolCalls.length} call${toolCalls.length !== 1 ? 's' : ''}` : 'No tools called'}
          >
            {toolCalls.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No database tools were called for this turn (e.g. FAQ or general chat response).
              </p>
            ) : (
              <div className="space-y-4">
                {toolCalls.map((call, i) => (
                  <ToolCallCard key={i} call={call} index={i} />
                ))}
              </div>
            )}
          </AccordionSection>

          {/* 4. Output */}
          <AccordionSection icon={FileText} title="Synthesized Response" defaultOpen>
            <div className="border border-[#E0E0E0] bg-slate-50 p-4 text-[#0F172A] leading-relaxed">
              {log.grounded_response ? <MarkdownRenderer content={log.grounded_response} /> : <span className="italic text-slate-400">No response recorded</span>}
            </div>
          </AccordionSection>

          {/* 5. Citations */}
          <AccordionSection
            icon={BookMarked}
            title="Data Citations"
            badge={citations.length > 0 ? `${citations.length} source${citations.length !== 1 ? 's' : ''}` : 'No citations'}
          >
            {citations.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No database records were cited in this response.</p>
            ) : (
              <div className="space-y-3">
                {citations.map((c, i) => (
                  <CitationCard key={i} citation={c} index={i} />
                ))}
              </div>
            )}
          </AccordionSection>

          {/* 6. Telemetry */}
          <AccordionSection icon={BarChart2} title="Telemetry & Token Usage">
            <div className="space-y-5">
              {/* Latency */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Latency Breakdown</p>
                <div className="space-y-2">
                  {Object.keys(nodeLatencies).length > 0 ? (
                    Object.entries(nodeLatencies).map(([node, ms]) => (
                      <LatencyBar key={node} label={node} ms={ms} total={totalLatency} />
                    ))
                  ) : (
                    <LatencyBar label="Total" ms={totalLatency} total={totalLatency} />
                  )}
                </div>
              </div>

              {/* Token usage */}
              {Object.keys(tokenUsage).length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Token Usage & Cost</p>
                    <button 
                      onClick={() => setPricingOpen(true)}
                      className="text-[#2563EB] hover:underline text-xs flex items-center gap-1 font-semibold"
                    >
                      <Settings size={12} /> Configure Token Pricing
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="border border-[#E0E0E0] bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Input Tokens</p>
                      <p className="font-mono text-lg font-bold text-[#0F172A] mt-1">{(tokenUsage.prompt_tokens || 0).toLocaleString()}</p>
                    </div>
                    <div className="border border-[#E0E0E0] bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Output Tokens</p>
                      <p className="font-mono text-lg font-bold text-[#0F172A] mt-1">{((tokenUsage.completion_tokens || 0) - (tokenUsage.reasoning_tokens || 0)).toLocaleString()}</p>
                    </div>
                    <div className="border border-[#E0E0E0] bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Thinking Tokens</p>
                      <p className="font-mono text-lg font-bold text-[#0F172A] mt-1">{(tokenUsage.reasoning_tokens || 0).toLocaleString()}</p>
                    </div>
                    <div className="border border-[#E0E0E0] bg-[#F8FAFC] p-3 relative group">
                      <p className="text-[10px] font-semibold text-[#2563EB] uppercase tracking-wide flex items-center gap-1">
                        Turn Cost <AlertTriangle size={10}/>
                      </p>
                      <p className="font-mono text-lg font-bold text-[#0F172A] mt-1">
                        ${(tokenUsage.total_cost || 0).toFixed(5)}
                      </p>
                      <div className="absolute hidden group-hover:block bottom-full mb-2 right-0 bg-[#0F172A] text-white text-[10px] p-2 rounded shadow-lg w-48 z-10 font-mono">
                        Cost = (Input * InRate) + (Output * OutRate) + (Thinking * ThinkRate)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Raw metadata */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Raw Log Metadata</p>
                <JsonBlock data={{ turn_id: log.turn_id, session_id: log.session_id, customer_id: log.customer_id, timestamp: log.timestamp }} />
              </div>
            </div>
          </AccordionSection>
            </>
          )}
        </div>
      </div>
      {pricingOpen && <PricingModal onClose={() => setPricingOpen(false)} />}
    </>
  );
}
