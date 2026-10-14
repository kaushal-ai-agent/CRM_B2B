import React, { useState } from 'react';
import {
  Compass,
  Wrench,
  FileText,
  ChevronDown,
  ChevronRight,
  Database,
  Code2,
  Clock,
  Cpu,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';

function PromptCollapse({ title, content, badge }) {
  const [open, setOpen] = useState(false);
  if (!content) return null;

  return (
    <div className="border border-[#E0E0E0] bg-white text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
          <Code2 size={13} className="text-[#2563EB]" />
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="font-mono text-[10px] text-slate-500 bg-white border border-[#E0E0E0] px-1.5 py-0.5">
              {badge}
            </span>
          )}
          {open ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
        </div>
      </button>
      {open && (
        <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-80 border-t border-[#E0E0E0]">
          {content}
        </pre>
      )}
    </div>
  );
}

export default function ExecutionTraceViewer({ executionTrace = [], toolCalls = [], fallbackQuery = '', fallbackResponse = '', fallbackIntent = '' }) {
  // If no trace is explicitly recorded (e.g. historical log before trace instrumentation), build a synthetic representation
  const hasTrace = Array.isArray(executionTrace) && executionTrace.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#2563EB]" />
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            Agent Execution Lifecycle Trace
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          {hasTrace ? `${executionTrace.length} Steps Logged` : 'Turn Trace Preview'}
        </span>
      </div>

      {hasTrace ? (
        <div className="space-y-4 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#E0E0E0] before:z-0">
          {executionTrace.map((step, idx) => {
            const isRouter = step.step === 'router' || step.node === 'router_node';
            const isSynth = step.step === 'synthesis' || step.node === 'synthesis_node';
            const stepNum = idx + 1;

            return (
              <div key={idx} className="relative z-10 pl-8">
                {/* Node marker pin */}
                <div className="absolute left-1.5 top-3 w-4 h-4 bg-[#0F172A] border-2 border-white flex items-center justify-center text-[9px] font-mono font-bold text-white">
                  {stepNum}
                </div>

                <div className="border border-[#E0E0E0] bg-white">
                  {/* Step Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-[#E0E0E0]">
                    <div className="flex items-center gap-2">
                      {isRouter && <Compass size={14} className="text-[#2563EB]" />}
                      {isSynth && <FileText size={14} className="text-[#2563EB]" />}
                      {!isRouter && !isSynth && <Layers size={14} className="text-[#2563EB]" />}
                      <span className="text-xs font-bold text-[#0F172A]">
                        {step.step_name || (isRouter ? 'Router: Intent Classification' : isSynth ? 'Synthesis: Response Generation' : step.step)}
                      </span>
                      {step.model && (
                        <span className="font-mono text-[10px] bg-white border border-[#E0E0E0] px-1.5 py-0.5 text-slate-600">
                          {step.model}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-slate-500">
                      {step.latency_ms != null && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {step.latency_ms} ms
                        </span>
                      )}
                      {step.token_usage && (
                        <span className="text-[11px] text-slate-600">
                          Tokens: In {step.token_usage.prompt_tokens || 0} / Out {step.token_usage.completion_tokens || 0}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Step Body */}
                  <div className="p-4 space-y-3 text-xs">
                    {/* System Prompt */}
                    {step.system_prompt && (
                      <PromptCollapse
                        title="View Injected System Prompt & Rules"
                        content={step.system_prompt}
                        badge={`${step.system_prompt.length} chars`}
                      />
                    )}

                    {/* Input Messages */}
                    {step.input_messages && step.input_messages.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Input Context / Customer Message
                        </p>
                        <div className="bg-slate-50 border border-[#E0E0E0] p-2.5 text-slate-700 font-mono text-[11px] whitespace-pre-wrap">
                          {Array.isArray(step.input_messages) ? step.input_messages.join('\n') : String(step.input_messages)}
                        </div>
                      </div>
                    )}

                    {/* Injected Database Records */}
                    {step.injected_data && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <Database size={11} className="text-[#2563EB]" />
                          Database Records Injected into LLM Context
                        </p>
                        <pre className="bg-emerald-950 text-emerald-300 border border-emerald-900 p-2.5 text-[11px] font-mono whitespace-pre-wrap overflow-x-auto">
                          {typeof step.injected_data === 'object' ? JSON.stringify(step.injected_data, null, 2) : step.injected_data}
                        </pre>
                      </div>
                    )}

                    {/* Parsed Output or Decision */}
                    {step.parsed_output && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Parsed Classification & Extraction
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-[#E0E0E0] p-2.5">
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">Intent</span>
                            <span className="font-semibold text-[#0F172A]">{step.parsed_output.intent}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">Confidence</span>
                            <span className="font-mono font-semibold text-[#2563EB]">
                              {((step.parsed_output.confidence || 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">Product SKU / Name</span>
                            <span className="font-mono text-slate-700">
                              {step.parsed_output.product_refs?.length > 0 ? step.parsed_output.product_refs.join(', ') : 'None'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block uppercase">Escalation</span>
                            <span className={`font-semibold ${step.parsed_output.escalation_flag ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {step.parsed_output.escalation_flag ? 'YES' : 'NO'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Raw LLM Output */}
                    {step.raw_llm_output && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                          Raw Model Output
                        </p>
                        <div className="bg-slate-50 border border-[#E0E0E0] p-2.5 font-mono text-[11px] text-slate-800 whitespace-pre-wrap">
                          {step.raw_llm_output}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* If this was the router and we had tool calls, render the Tool Execution Step right between router & synthesis */}
                {isRouter && toolCalls && toolCalls.length > 0 && (
                  <div className="my-4 border border-[#E0E0E0] bg-white">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-[#E0E0E0]">
                      <div className="flex items-center gap-2">
                        <Wrench size={14} className="text-[#2563EB]" />
                        <span className="text-xs font-bold text-[#0F172A]">
                          Intermediate Step: Database Tool Execution ({toolCalls.length} Call{toolCalls.length > 1 ? 's' : ''})
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-blue-700 bg-white border border-blue-200 px-1.5 py-0.5">
                        Live CRM Inventory Query
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      {toolCalls.map((tc, tcIdx) => (
                        <div key={tcIdx} className="border border-[#E0E0E0] bg-slate-50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-[#0F172A]">
                              Tool: {tc.tool_name || 'query_live_product'}
                            </span>
                            {tc.input_args && (
                              <span className="font-mono text-[10px] text-slate-500">
                                Args: {JSON.stringify(tc.input_args)}
                              </span>
                            )}
                          </div>
                          {tc.sql_executed && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Executed SQL</p>
                              <pre className="bg-[#0F172A] text-emerald-300 p-2 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                                {tc.sql_executed}
                              </pre>
                            </div>
                          )}
                          {tc.raw_output && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Raw Records Returned</p>
                              <pre className="bg-white border border-[#E0E0E0] p-2 font-mono text-[10px] text-slate-700 overflow-x-auto max-h-40 whitespace-pre-wrap">
                                {JSON.stringify(tc.raw_output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Fallback view if no granular trace recorded */
        <div className="border border-[#E0E0E0] bg-slate-50 p-4 space-y-3 text-xs">
          <p className="text-slate-600">
            Granular step prompts for this turn were not persisted in the legacy log format. Below is the reconstructed turn flow:
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border border-[#E0E0E0] bg-white p-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">1. Inbound Query</span>
              <p className="text-slate-800 text-xs mt-1 truncate">{fallbackQuery || '—'}</p>
            </div>
            <div className="border border-[#E0E0E0] bg-white p-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">2. Classification</span>
              <p className="text-[#2563EB] font-semibold text-xs mt-1">{fallbackIntent || '—'}</p>
            </div>
            <div className="border border-[#E0E0E0] bg-white p-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">3. Tools Executed</span>
              <p className="font-mono text-xs mt-1">{toolCalls.length > 0 ? `${toolCalls.length} tool(s)` : 'None'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
