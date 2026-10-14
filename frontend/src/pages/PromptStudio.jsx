import React, { useState, useEffect } from 'react';
import { fetchPrompts, createPrompt, rollbackPrompt, seedPrompts } from '../api/agentService';
import { Bot, Save, History, CheckCircle2, Circle, ArrowLeftRight, Sparkles } from 'lucide-react';

const STANDARD_NODES = [
  { name: 'router_node', label: 'Intent Router', desc: 'Intent classification & SKU extraction' },
  { name: 'synthesis_node', label: 'Inventory Synthesis', desc: 'Live catalogue quotes & grounded replies' },
  { name: 'faq_node', label: 'General FAQ', desc: 'Shipping terms, payment policies & warranties' },
  { name: 'guardrail_node', label: 'Guardrail Safety', desc: 'Prompt injection & policy refusal message' },
  { name: 'escalation_node', label: 'Escalation Handoff', desc: 'Human supervisor transfer notice' },
];

export default function PromptStudio() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState('router_node');
  
  // Edit State
  const [systemPrompt, setSystemPrompt] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const loadPrompts = async () => {
    try {
      const data = await fetchPrompts();
      setPrompts(data.prompts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, []);

  // Compute all available nodes: union of standard nodes and any custom node names in prompts
  const customNodeNames = prompts
    .map(p => p.node_name)
    .filter(name => !STANDARD_NODES.some(s => s.name === name));
  const uniqueCustomNodes = [...new Set(customNodeNames)].map(name => ({
    name,
    label: name,
    desc: 'Custom node prompt',
  }));
  const allNodes = [...STANDARD_NODES, ...uniqueCustomNodes];

  // Set selected prompt when selectedNode or prompts change
  useEffect(() => {
    if (selectedNode) {
      const active = prompts.find(p => p.node_name === selectedNode && p.is_active);
      if (active) {
        setSystemPrompt(active.system_prompt);
        setChangeSummary('');
      } else {
        const latest = prompts.find(p => p.node_name === selectedNode);
        if (latest) {
          setSystemPrompt(latest.system_prompt);
        } else {
          setSystemPrompt('');
        }
        setChangeSummary('');
      }
    }
  }, [selectedNode, prompts]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedNode || !systemPrompt.trim()) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      await createPrompt({
        node_name: selectedNode,
        system_prompt: systemPrompt,
        change_summary: changeSummary.trim() || 'Updated via Prompt Studio',
        is_active: true,
      });
      setChangeSummary('');
      await loadPrompts();
      setStatusMsg({ type: 'success', text: `vNext created and activated for ${selectedNode}.` });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to save prompt version.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async (id) => {
    if (!window.confirm('Activate this prompt version?')) return;
    try {
      await rollbackPrompt(id);
      await loadPrompts();
      setStatusMsg({ type: 'success', text: 'Prompt version activated successfully.' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to activate prompt.' });
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setStatusMsg(null);
    try {
      await seedPrompts();
      await loadPrompts();
      setStatusMsg({ type: 'success', text: 'Default baseline prompts seeded successfully!' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to seed default prompts.' });
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <div className="p-8 text-[#64748B] text-sm">Loading prompts...</div>;

  const nodeHistory = prompts.filter(p => p.node_name === selectedNode);
  const activePromptObj = nodeHistory.find(p => p.is_active);
  const selectedNodeMeta = allNodes.find(n => n.name === selectedNode);

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Top Header */}
      <div className="mb-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
            <Bot className="text-[#2563EB]" />
            Prompt Studio
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Production prompt versioning, testing, and runtime rollbacks for all agent nodes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className="border border-[#E0E0E0] bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Seed standard production prompts"
          >
            <Sparkles size={14} className="text-[#2563EB]" />
            {seeding ? 'Seeding...' : 'Seed Defaults'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`mb-3 px-4 py-2 text-xs font-semibold border shrink-0 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Sidebar: Nodes list */}
        <div className="w-72 border border-[#E0E0E0] bg-white flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E0E0E0] bg-slate-50 font-semibold text-xs text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>Agent Nodes</span>
            <span className="font-mono text-[11px] bg-slate-200 px-1.5 py-0.5 text-slate-700">{allNodes.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[#E0E0E0]">
            {allNodes.map(node => {
              const nodePrompts = prompts.filter(p => p.node_name === node.name);
              const activeVer = nodePrompts.find(p => p.is_active);
              const isSelected = selectedNode === node.name;

              return (
                <button
                  key={node.name}
                  onClick={() => setSelectedNode(node.name)}
                  className={`w-full text-left px-4 py-3 transition-colors border-l-4 ${
                    isSelected
                      ? 'bg-blue-50/60 border-[#2563EB] text-[#0F172A]'
                      : 'border-transparent text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#0F172A]">{node.label}</span>
                    {activeVer ? (
                      <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5">
                        v{activeVer.version}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-slate-400 border border-slate-200 px-1">Unset</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{node.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Editor & History */}
        <div className="flex-1 flex flex-col gap-5 overflow-hidden">
          {/* Editor */}
          <div className="border border-[#E0E0E0] bg-white flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-[#E0E0E0] bg-[#0F172A] flex justify-between items-center">
              <div>
                <span className="font-semibold text-sm text-white">
                  Editing: {selectedNodeMeta?.label || selectedNode}
                </span>
                <span className="ml-2 font-mono text-xs text-blue-300">({selectedNode})</span>
              </div>
              {activePromptObj && (
                <span className="font-mono text-xs bg-emerald-950 text-emerald-300 border border-emerald-700 px-2 py-0.5">
                  Active v{activePromptObj.version}
                </span>
              )}
            </div>
            <form onSubmit={handleSave} className="p-4 flex flex-col gap-3">
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                className="w-full h-52 border border-[#E0E0E0] bg-[#F8FAFC] p-3 text-xs font-mono text-[#0F172A] focus:outline-none focus:border-[#2563EB] resize-none leading-relaxed"
                placeholder="Enter system prompt instructions..."
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  value={changeSummary}
                  onChange={e => setChangeSummary(e.target.value)}
                  className="flex-1 border border-[#E0E0E0] px-3 py-2 text-xs text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
                  placeholder="Summary of changes (e.g. Added zero-discount policy and SKU extraction rules)"
                />
                <button
                  type="submit"
                  disabled={saving || !systemPrompt.trim()}
                  className="bg-[#2563EB] text-white px-5 py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors shrink-0"
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save & Activate Version'}
                </button>
              </div>
            </form>
          </div>

          {/* History */}
          <div className="flex-1 border border-[#E0E0E0] bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#E0E0E0] bg-slate-50 font-semibold text-xs text-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History size={14} className="text-[#2563EB]" />
                <span>Version History ({nodeHistory.length})</span>
              </div>
              <span className="text-[11px] text-slate-400">Click Activate to roll back to any historical version</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {nodeHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No versions saved for this node yet. Use the editor above to save v1.
                </div>
              ) : (
                nodeHistory.map(p => (
                  <div
                    key={p.id}
                    className={`border p-3 flex gap-3 text-xs ${
                      p.is_active ? 'border-emerald-300 bg-emerald-50/40' : 'border-[#E0E0E0] bg-white'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {p.is_active ? (
                        <CheckCircle2 className="text-emerald-600" size={16} />
                      ) : (
                        <Circle className="text-slate-300" size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-[#0F172A]">v{p.version}</span>
                        <span className="text-[11px] text-slate-400">
                          {p.created_at ? new Date(p.created_at).toLocaleString() : 'Baseline'} &bull; {p.created_by}
                        </span>
                      </div>
                      <p className="font-medium text-[#0F172A] mb-1.5 truncate">
                        {p.change_summary || 'No summary provided'}
                      </p>

                      <details className="text-slate-600">
                        <summary className="cursor-pointer hover:text-[#2563EB] font-medium text-[11px]">
                          Preview Prompt Content
                        </summary>
                        <pre className="mt-1.5 bg-slate-50 p-2 font-mono text-[10px] whitespace-pre-wrap border border-slate-200 max-h-36 overflow-y-auto">
                          {p.system_prompt}
                        </pre>
                      </details>
                    </div>
                    {!p.is_active && (
                      <div className="shrink-0 pl-3 border-l border-slate-200 flex items-center">
                        <button
                          onClick={() => handleRollback(p.id)}
                          className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
                        >
                          <ArrowLeftRight size={12} />
                          Activate
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
