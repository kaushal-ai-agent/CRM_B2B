/**
 * AgentSettings.jsx — /admin/agent-settings
 *
 * Two-section page:
 *   1. LLM & Runtime Configuration (GET/PUT /api/v1/agent/config)
 *   2. FAQ Knowledge Base (GET/POST/DELETE /api/v1/agent/faq)
 *
 * Follows Pragmatic Modernism: IBM Plex Sans UI, IBM Plex Mono data,
 * Navy #0F172A, Blue #2563EB, 0px border-radius, 1px solid #E0E0E0.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  ChevronDown,
  Plus,
  BookOpen,
  Trash2,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import {
  getAgentConfig,
  updateAgentConfig,
  embedFaq,
  listFaqs,
  deleteFaq,
  fetchAgentHealth,
  getAgentError,
} from '../api/agentService';
import AgentErrorBoundary from '../components/agent/ErrorBoundary';

// ---------------------------------------------------------------------------
// Model presets
// ---------------------------------------------------------------------------

const ROUTER_MODELS = [
  { label: 'GPT-4o Mini (OpenAI) — Fast', value: 'openai/gpt-4o-mini' },
  { label: 'Claude 3 Haiku (Anthropic) — Fast', value: 'anthropic/claude-3-haiku' },
  { label: 'Gemini Flash 1.5 (Google) — Fast', value: 'google/gemini-flash-1.5' },
  { label: 'Custom…', value: '__custom__' },
];

const SYNTHESIS_MODELS = [
  { label: 'GPT-4o (OpenAI) — Precise', value: 'openai/gpt-4o' },
  { label: 'Claude 3.5 Sonnet (Anthropic) — Precise', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'Gemini Pro 1.5 (Google) — Precise', value: 'google/gemini-pro-1.5' },
  { label: 'DeepSeek Chat V3 — Cost-Efficient', value: 'deepseek/deepseek-chat' },
  { label: 'Custom…', value: '__custom__' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-9 h-9 bg-[#0F172A] flex items-center justify-center shrink-0">
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-[#0F172A] uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
  );
}

function StatusBadge({ status }) {
  const map = {
    idle: null,
    saving: { cls: 'bg-blue-50 border-blue-200 text-blue-700', label: 'Saving…' },
    success: { cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Saved successfully' },
    error: { cls: 'bg-rose-50 border-rose-200 text-rose-700', label: 'Save failed' },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 border px-3 py-1 text-xs font-medium ${s.cls}`}>
      {status === 'success' && <CheckCircle size={12} />}
      {status === 'error' && <AlertCircle size={12} />}
      {s.label}
    </span>
  );
}

function ModelSelector({ label, options, value, onChange, customValue, onCustomChange }) {
  const isCustom = value === '__custom__';
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-[#E0E0E0] bg-white px-3 py-2.5 text-sm text-[#0F172A] appearance-none pr-10 focus:outline-none focus:border-[#2563EB]"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
      {isCustom && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="e.g., mistralai/mistral-7b-instruct"
          className="mt-2 w-full border border-[#2563EB] bg-white px-3 py-2 text-sm font-mono text-[#0F172A] focus:outline-none placeholder-slate-400"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: LLM Configuration
// ---------------------------------------------------------------------------

function LLMConfigSection({ onHealthUpdate }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Form state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [routerModel, setRouterModel] = useState('openai/gpt-4o-mini');
  const [routerCustom, setRouterCustom] = useState('');
  const [synthesisModel, setSynthesisModel] = useState('openai/gpt-4o');
  const [synthesisCustom, setSynthesisCustom] = useState('');
  const [confidence, setConfidence] = useState(0.8);
  const [maxContextTurns, setMaxContextTurns] = useState(5);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, health] = await Promise.all([
        getAgentConfig(),
        fetchAgentHealth().catch(() => null),
      ]);
      setConfig(cfg);

      // Populate form from config
      const rm = cfg.router_model_name || 'openai/gpt-4o-mini';
      const sm = cfg.synthesis_model_name || 'openai/gpt-4o';
      const isRouterCustom = !ROUTER_MODELS.find((m) => m.value === rm);
      const isSynthCustom = !SYNTHESIS_MODELS.find((m) => m.value === sm);
      setRouterModel(isRouterCustom ? '__custom__' : rm);
      setRouterCustom(isRouterCustom ? rm : '');
      setSynthesisModel(isSynthCustom ? '__custom__' : sm);
      setSynthesisCustom(isSynthCustom ? sm : '');
      setConfidence(cfg.confidence_threshold ?? 0.8);
      setMaxContextTurns(cfg.max_context_turns ?? 5);

      if (health && onHealthUpdate) onHealthUpdate(health);
    } catch (err) {
      setError(getAgentError(err));
    } finally {
      setLoading(false);
    }
  }, [onHealthUpdate]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const effectiveRouter = routerModel === '__custom__' ? routerCustom : routerModel;
      const effectiveSynth = synthesisModel === '__custom__' ? synthesisCustom : synthesisModel;

      const payload = {
        router_model_name: effectiveRouter,
        synthesis_model_name: effectiveSynth,
        confidence_threshold: confidence,
        max_context_turns: maxContextTurns,
      };
      if (apiKey.trim()) payload.openrouter_api_key = apiKey.trim();

      await updateAgentConfig(payload);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (_err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-12 bg-slate-100 border border-[#E0E0E0]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-rose-200 bg-rose-50 p-4 flex items-center gap-3">
        <AlertCircle size={16} className="text-rose-500 shrink-0" />
        <p className="text-sm text-rose-700">{error}</p>
        <button onClick={loadConfig} className="ml-auto border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Key */}
      <div>
        <FieldLabel>OpenRouter API Key</FieldLabel>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Key size={14} />
          </div>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.api_key_configured ? config.api_key_preview : 'Enter your OpenRouter API key…'}
            className="w-full border border-[#E0E0E0] bg-white pl-9 pr-10 py-2.5 text-sm font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB] placeholder-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          {config?.api_key_configured
            ? `Current key: ${config.api_key_preview} — Leave blank to keep existing key.`
            : 'No API key configured. Enter one to enable the agent.'}
        </p>
      </div>

      {/* Model Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ModelSelector
          label="Router Model (Fast / Cheap)"
          options={ROUTER_MODELS}
          value={routerModel}
          onChange={setRouterModel}
          customValue={routerCustom}
          onCustomChange={setRouterCustom}
        />
        <ModelSelector
          label="Synthesis Model (High-Precision)"
          options={SYNTHESIS_MODELS}
          value={synthesisModel}
          onChange={setSynthesisModel}
          customValue={synthesisCustom}
          onCustomChange={setSynthesisCustom}
        />
      </div>

      {/* Confidence Threshold */}
      <div>
        <FieldLabel>Confidence Threshold — Intent Classification Gate</FieldLabel>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-[#2563EB]"
          />
          <span className="font-mono text-sm font-semibold text-[#0F172A] w-10 text-right">
            {confidence.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Intent classification below this threshold routes directly to Escalation.
        </p>
      </div>

      {/* Max Context Turns */}
      <div>
        <FieldLabel>Max Context Turns</FieldLabel>
        <input
          type="number"
          min={1}
          max={20}
          value={maxContextTurns}
          onChange={(e) => setMaxContextTurns(parseInt(e.target.value, 10))}
          className="w-32 border border-[#E0E0E0] bg-white px-3 py-2 text-sm font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
        />
        <p className="text-xs text-slate-400 mt-1.5">
          Number of past turns injected into each new prompt for multi-turn context.
        </p>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4 pt-2 border-t border-[#E0E0E0]">
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
        >
          <Save size={14} />
          {saveStatus === 'saving' ? 'Saving…' : 'Save Configuration'}
        </button>
        <StatusBadge status={saveStatus} />
        <button
          onClick={loadConfig}
          className="ml-auto inline-flex items-center gap-2 border border-[#E0E0E0] px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: FAQ Knowledge Base
// ---------------------------------------------------------------------------

function FaqSection() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [embedStatus, setEmbedStatus] = useState('idle');
  const [deletingId, setDeletingId] = useState(null);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFaqs();
      setFaqs(data);
    } catch (err) {
      setError(getAgentError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFaqs(); }, [loadFaqs]);

  const handleEmbed = async () => {
    if (!title.trim() || !content.trim()) return;
    setEmbedStatus('saving');
    try {
      const entry = await embedFaq({ title: title.trim(), content: content.trim() });
      setFaqs((prev) => [entry, ...prev]);
      setTitle('');
      setContent('');
      setEmbedStatus('success');
      setTimeout(() => setEmbedStatus('idle'), 2500);
    } catch (_err) {
      setEmbedStatus('error');
      setTimeout(() => setEmbedStatus('idle'), 3000);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteFaq(id);
      setFaqs((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add new FAQ */}
      <div className="border border-[#E0E0E0] bg-slate-50 p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Add New FAQ Entry</p>
        <div className="space-y-4">
          <div>
            <FieldLabel required>Title / Question</FieldLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. What is your return policy?"
              className="w-full border border-[#E0E0E0] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] placeholder-slate-400"
            />
          </div>
          <div>
            <FieldLabel required>Content / Answer</FieldLabel>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Write the full FAQ answer here. Be as detailed as needed — the agent will use this to answer customer queries accurately."
              className="w-full border border-[#E0E0E0] bg-white px-3 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-[#2563EB] placeholder-slate-400 resize-y"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleEmbed}
              disabled={!title.trim() || !content.trim() || embedStatus === 'saving'}
              className="inline-flex items-center gap-2 bg-[#0F172A] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
            >
              <Plus size={14} />
              {embedStatus === 'saving' ? 'Saving…' : 'Embed & Save'}
            </button>
            <StatusBadge status={embedStatus} />
          </div>
        </div>
      </div>

      {/* FAQ List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Knowledge Base ({faqs.length} entries)
          </p>
          <button
            onClick={loadFaqs}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
          >
            <RefreshCw size={11} />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((n) => <div key={n} className="h-16 bg-slate-100 border border-[#E0E0E0]" />)}
          </div>
        )}

        {error && (
          <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        )}

        {!loading && !error && faqs.length === 0 && (
          <div className="border border-dashed border-[#E0E0E0] p-8 text-center">
            <BookOpen size={24} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No FAQ entries yet. Add one above.</p>
          </div>
        )}

        {!loading && faqs.length > 0 && (
          <div className="border border-[#E0E0E0] divide-y divide-[#E0E0E0]">
            {faqs.map((faq) => (
              <div key={faq.id} className="p-4 bg-white hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">{faq.title}</p>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{faq.content}</p>
                    <p className="font-mono text-xs text-slate-400 mt-1.5">
                      {new Date(faq.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(faq.id)}
                    disabled={deletingId === faq.id}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-40 transition-colors"
                    title="Delete FAQ"
                  >
                    {deletingId === faq.id ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentSettings() {
  const [health, setHealth] = useState(null);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight uppercase">Agent Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage LLM models, routing thresholds, and the FAQ knowledge base.
          </p>
        </div>
        {health && (
          <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
            <span className="w-2 h-2 bg-emerald-500 inline-block" />
            <span className="font-medium text-emerald-700">Agent Online</span>
          </div>
        )}
      </div>

      {/* LLM Config Section */}
      <div className="border border-[#E0E0E0] bg-white p-6">
        <SectionHeader
          icon={Cpu}
          title="LLM & Runtime Configuration"
          subtitle="Changes apply immediately to new requests. Restart the agent service to persist changes."
        />
        <AgentErrorBoundary label="LLM Configuration">
          <LLMConfigSection onHealthUpdate={setHealth} />
        </AgentErrorBoundary>
      </div>

      {/* FAQ Section */}
      <div className="border border-[#E0E0E0] bg-white p-6">
        <SectionHeader
          icon={BookOpen}
          title="FAQ Knowledge Base"
          subtitle="These entries are surfaced by the agent when answering FAQ-type customer queries."
        />
        <AgentErrorBoundary label="FAQ Knowledge Base">
          <FaqSection />
        </AgentErrorBoundary>
      </div>

      {/* Instagram Channel Section */}
      <div className="border border-[#E0E0E0] bg-white p-6">
        <SectionHeader
          icon={Cpu}
          title="Instagram DM Channel"
          subtitle="Configure the Instagram Graph API connection for automated DM handling."
        />
        <AgentErrorBoundary label="Instagram Channel">
          <InstagramSection />
        </AgentErrorBoundary>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Instagram Section (inline sub-component)
// ---------------------------------------------------------------------------

function InstagramSection() {
  const [igConfig, setIgConfig] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [formData, setFormData] = useState({
    ig_enabled: false,
    ig_app_id: '',
    ig_verify_token: '',
    ig_account_id: ''
  });

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const config = await getAgentConfig();
      setIgConfig(config);
      setFormData({
        ig_enabled: config?.ig_enabled || false,
        ig_app_id: config?.ig_app_id || '',
        ig_verify_token: config?.ig_verify_token || '',
        ig_account_id: config?.ig_account_id || ''
      });
    } catch (err) {
      console.error('Failed to load IG config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { verifyInstagramConnection } = await import('../api/agentService');
      const result = await verifyInstagramConnection();
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({ ok: false, error: getAgentError(err) });
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await updateAgentConfig(formData);
      setSaveStatus('success');
      setIsEditing(false);
      fetchConfig();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  if (loading) {
    return <p className="text-sm text-[#94A3B8]">Loading config…</p>;
  }

  const enabled = igConfig?.ig_enabled || false;

  return (
    <div className="space-y-4 mt-4">
      {/* Status row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 inline-block ${enabled ? 'bg-emerald-500' : 'bg-[#94A3B8]'}`} />
          <span className="text-sm font-medium text-[#0F172A]">
            {enabled ? 'Channel Enabled' : 'Channel Disabled'}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#64748B]">
          <span>Secret: {igConfig?.ig_app_secret_configured ? '✓ configured' : '✗ not set'}</span>
          <span>|</span>
          <span>Token: {igConfig?.ig_access_token_configured ? '✓ configured' : '✗ not set'}</span>
        </div>
      </div>

      {!isEditing ? (
        <>
          {/* Read-only view */}
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[#64748B] font-medium mb-1">App ID</label>
              <p className="font-mono text-[#0F172A]">{igConfig?.ig_app_id || '—'}</p>
            </div>
            <div>
              <label className="block text-[#64748B] font-medium mb-1">Account ID</label>
              <p className="font-mono text-[#0F172A]">{igConfig?.ig_account_id || '—'}</p>
            </div>
            <div>
              <label className="block text-[#64748B] font-medium mb-1">Verify Token</label>
              <p className="font-mono text-[#0F172A]">{igConfig?.ig_verify_token || '—'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Edit Config
            </button>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-2 border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] transition-colors disabled:opacity-50"
            >
              {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Test Connection
            </button>

            {verifyResult && (
              <div className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
                verifyResult.ok
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-red-200 bg-red-50 text-red-700'
              }`}>
                {verifyResult.ok ? (
                  <><CheckCircle className="w-3 h-3" /> Connected: @{verifyResult.account?.username || verifyResult.account?.name}</>
                ) : (
                  <><AlertCircle className="w-3 h-3" /> {verifyResult.error}</>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4 border border-[#E0E0E0] p-4 bg-slate-50 mt-2">
          <div className="flex items-center gap-2 mb-2">
            <input 
              type="checkbox" 
              checked={formData.ig_enabled}
              onChange={(e) => setFormData({...formData, ig_enabled: e.target.checked})}
              id="igEnabled"
              className="w-4 h-4"
            />
            <label htmlFor="igEnabled" className="text-sm font-medium text-[#0F172A]">Enable Instagram Channel</label>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>App ID</FieldLabel>
              <input
                type="text"
                value={formData.ig_app_id}
                onChange={(e) => setFormData({...formData, ig_app_id: e.target.value})}
                className="w-full border border-[#E0E0E0] px-3 py-2 text-sm font-mono focus:border-[#2563EB] outline-none"
                placeholder="e.g. 1234567890"
              />
            </div>
            <div>
              <FieldLabel>Account ID</FieldLabel>
              <input
                type="text"
                value={formData.ig_account_id}
                onChange={(e) => setFormData({...formData, ig_account_id: e.target.value})}
                className="w-full border border-[#E0E0E0] px-3 py-2 text-sm font-mono focus:border-[#2563EB] outline-none"
                placeholder="e.g. 178414..."
              />
            </div>
            <div className="col-span-2">
              <FieldLabel>Verify Token (For Webhooks)</FieldLabel>
              <input
                type="text"
                value={formData.ig_verify_token}
                onChange={(e) => setFormData({...formData, ig_verify_token: e.target.value})}
                className="w-full border border-[#E0E0E0] px-3 py-2 text-sm font-mono focus:border-[#2563EB] outline-none"
                placeholder="Custom secret string"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8]"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="border border-[#E0E0E0] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:bg-slate-50"
            >
              Cancel
            </button>
            <StatusBadge status={saveStatus} />
          </div>
        </div>
      )}

      {/* Info text */}
      <p className="text-xs text-[#94A3B8] mt-2">
        <strong>Note:</strong> Changes made here are saved in-memory for testing. 
        To persist credentials across restarts, including Access Tokens and App Secrets, you must update the <span className="font-mono">agent_service/.env</span> file.
        See <a href="file:///readme_instagram.md" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">readme_instagram.md</a> for instructions.
      </p>
    </div>
  );
}
