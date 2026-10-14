import React, { useState, useEffect } from 'react';
import { 
  fetchGoldenDataset, 
  createGoldenTestCase, 
  deleteGoldenTestCase, 
  fetchEvalRuns, 
  fetchEvalRunDetails, 
  runEvalSuite,
  seedGoldenDataset
} from '../api/agentService';
import { Play, Search, Target, Database, Trash2, Code2, AlertTriangle, ChevronRight, MessageSquare, Zap, Clock, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ExecutionTraceViewer from '../components/agent/ExecutionTraceViewer';
import logger from '../utils/logger';

function DatasetTab() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState('PRODUCT_STOCK_QUERY');
  const [groundTruth, setGroundTruth] = useState('');

  const loadDataset = async () => {
    try {
      const data = await fetchGoldenDataset();
      setCases(data.dataset || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDataset(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!query.trim() || !groundTruth.trim()) return;
    try {
      logger.info('Adding golden test case', { query: query.trim(), intent });
      await createGoldenTestCase({
        dataset_tag: 'default_v1',
        query,
        expected_intent: intent,
        ground_truth_output: groundTruth,
        expected_tools: [],
        expected_entities: {}
      });
      setQuery('');
      setGroundTruth('');
      loadDataset();
    } catch (err) {
      logger.error('Failed to add golden test case', { error: err.message, query });
      console.error('Failed to add case', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this test case?')) return;
    try {
      logger.info('Deleting golden test case', { id });
      await deleteGoldenTestCase(id);
      loadDataset();
    } catch (err) {
      logger.error('Failed to delete golden test case', { id, error: err.message });
      console.error('Failed to delete case', err);
    }
  };

  const [seeding, setSeeding] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    logger.info('Seeding golden benchmark dataset');
    try {
      await seedGoldenDataset();
      await loadDataset();
      logger.info('Golden benchmark dataset seeded successfully');
    } catch (err) {
      logger.error('Failed to seed golden dataset', { error: err.message });
      console.error(err);
      alert('Failed to seed golden dataset.');
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <div className="p-8 text-[#64748B] text-sm">Loading dataset...</div>;

  return (
    <div className="space-y-6">
      {/* Add New Case */}
      <div className="border border-[#E0E0E0] bg-white">
        <div className="px-4 py-3 border-b border-[#E0E0E0] bg-slate-50 font-semibold text-sm text-[#0F172A] flex items-center justify-between">
          <span>Add Golden Test Case</span>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1"
          >
            <Sparkles size={13} />
            {seeding ? 'Seeding...' : 'Seed Baseline Benchmark Cases'}
          </button>
        </div>
        <form onSubmit={handleAdd} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Customer Query</label>
              <input 
                type="text" 
                value={query} 
                onChange={e => setQuery(e.target.value)}
                className="w-full border border-[#E0E0E0] px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                placeholder="e.g. Do you have SKU QBE-751?"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expected Intent</label>
              <select 
                value={intent}
                onChange={e => setIntent(e.target.value)}
                className="w-full border border-[#E0E0E0] px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none bg-white"
              >
                <option value="PRODUCT_STOCK_QUERY">PRODUCT_STOCK_QUERY</option>
                <option value="ORDERING_INTENT">ORDERING_INTENT</option>
                <option value="FAQ_QUERY">FAQ_QUERY</option>
                <option value="ESCALATION">ESCALATION</option>
                <option value="GENERAL_CHAT">GENERAL_CHAT</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Ground Truth Output</label>
            <textarea 
              value={groundTruth}
              onChange={e => setGroundTruth(e.target.value)}
              className="w-full border border-[#E0E0E0] px-3 py-2 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none h-20 resize-none"
              placeholder="Expected response..."
            />
          </div>
          <button type="submit" className="bg-[#2563EB] text-white px-4 py-2 text-sm font-medium hover:bg-[#1D4ED8] transition-colors">
            Save Case
          </button>
        </form>
      </div>

      {/* Dataset Table */}
      <div className="border border-[#E0E0E0] bg-white">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-[#E0E0E0]">
              <th className="px-4 py-3 font-semibold w-1/3">Query</th>
              <th className="px-4 py-3 font-semibold">Intent</th>
              <th className="px-4 py-3 font-semibold w-1/3">Ground Truth</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {cases.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-slate-400 text-center">No cases found</td></tr>
            ) : cases.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-[#0F172A] align-top">{c.query}</td>
                <td className="px-4 py-3 align-top">
                  <span className="font-mono text-xs border px-1.5 py-0.5 bg-white text-slate-600 border-slate-200">
                    {c.expected_intent}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 align-top text-xs truncate max-w-xs">{c.ground_truth_output}</td>
                <td className="px-4 py-3 text-right align-top">
                  <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunDrawer({ runVersion, onClose }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const data = await fetchEvalRunDetails(runVersion);
        setDetails(data.details || []);
      } catch(err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (runVersion) loadDetails();
  }, [runVersion]);

  if (!runVersion) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[800px] bg-white z-50 flex flex-col border-l border-[#E0E0E0] shadow-xl animate-in slide-in-from-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0] bg-[#0F172A] shrink-0">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Target size={16} className="text-[#2563EB]" />
            Evaluation Run: {runVersion}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><XCircle size={18}/></button>
        </div>

        {loading ? (
          <div className="p-8 text-slate-500">Loading details...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAFC]">
            {details.map(d => (
              <div key={d.id} className="border border-[#E0E0E0] bg-white">
                <button 
                  onClick={() => setSelectedCase(selectedCase === d.id ? null : d.id)}
                  className="w-full text-left px-4 py-3 flex items-start gap-4 hover:bg-slate-50 transition-colors"
                >
                  {d.status === 'PASSED' ? <CheckCircle2 className="text-green-500 shrink-0 mt-0.5" size={16}/> : <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16}/>}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#0F172A]">{d.inbound_query}</p>
                    <p className="font-mono text-xs text-slate-500 mt-1">Intent: {d.actual_intent}</p>
                  </div>
                  <ChevronRight size={16} className={`text-slate-400 transform transition-transform ${selectedCase === d.id ? 'rotate-90' : ''}`} />
                </button>
                {selectedCase === d.id && (
                  <div className="p-4 border-t border-[#E0E0E0] bg-slate-50 space-y-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="border border-[#E0E0E0] bg-white p-2">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Faithfulness</p>
                        <p className="font-mono text-sm">{d.faithfulness_score.toFixed(2)}</p>
                      </div>
                      <div className="border border-[#E0E0E0] bg-white p-2">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Relevancy</p>
                        <p className="font-mono text-sm">{d.relevancy_score.toFixed(2)}</p>
                      </div>
                      <div className="border border-[#E0E0E0] bg-white p-2">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Hallucination</p>
                        <p className="font-mono text-sm">{d.hallucination_score.toFixed(2)}</p>
                      </div>
                      <div className="border border-[#E0E0E0] bg-white p-2">
                        <p className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Tool Correct</p>
                        <p className="font-mono text-sm">{d.tool_correctness_score.toFixed(2)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Reasoning</p>
                      <p className="text-xs text-[#0F172A] border border-[#E0E0E0] bg-white p-3">{d.reasoning}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Actual Response</p>
                      <div className="border border-[#E0E0E0] bg-white p-3 text-sm">
                        <MarkdownRenderer content={d.actual_response} />
                      </div>
                    </div>
                    <div className="border-t border-[#E0E0E0] pt-3">
                      <ExecutionTraceViewer
                        executionTrace={d.execution_trace}
                        toolCalls={d.tools_called}
                        fallbackQuery={d.inbound_query}
                        fallbackResponse={d.actual_response}
                        fallbackIntent={d.actual_intent}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RunsTab() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);

  const loadRuns = async () => {
    try {
      const data = await fetchEvalRuns();
      setRuns(data.runs || []);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRuns(); }, []);

  const handleRun = async () => {
    if (!window.confirm("Trigger new evaluation suite? This will execute all active golden test cases through the agent graph and compute DeepEval metrics.")) return;
    setRunning(true);
    logger.info('Evaluation suite triggered', { action: 'Run New Evaluation' });
    try {
      const res = await runEvalSuite();
      if (res && res.status === 'error') {
        logger.error('Evaluation run error response', { detail: res.detail });
        alert(`Evaluation error: ${res.detail || 'Failed to complete run.'}`);
      } else if (res && res.version_tag) {
        logger.info('Evaluation run completed successfully', {
          version_tag: res.version_tag,
          overall_score: res.overall_score,
          passed_cases: res.passed_cases,
          total_cases: res.total_test_cases,
        });
        alert(`Evaluation run ${res.version_tag} completed! Overall score: ${(res.overall_score * 100).toFixed(1)}%`);
        await loadRuns();
      } else {
        await loadRuns();
      }
    } catch(err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || "Failed to run evaluation suite.";
      logger.error('Evaluation run request failed', {
        error: msg,
        status: err.response?.status,
        url: err.config?.url,
      });
      alert(`Evaluation failed: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={handleRun} 
          disabled={running}
          className="bg-[#2563EB] text-white px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
        >
          {running ? <span className="animate-pulse">Running...</span> : <Play size={16} />}
          Run New Evaluation
        </button>
      </div>

      <div className="border border-[#E0E0E0] bg-white">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-[#E0E0E0]">
              <th className="px-4 py-3 font-semibold">Version Tag</th>
              <th className="px-4 py-3 font-semibold">Overall Score</th>
              <th className="px-4 py-3 font-semibold">Passed / Total</th>
              <th className="px-4 py-3 font-semibold">Latency</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0] text-sm">
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">Loading...</td></tr>
            ) : runs.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">No evaluation runs found</td></tr>
            ) : runs.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-[#0F172A]">{r.version_tag}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-200"><div className="h-full bg-blue-500" style={{ width: `${Math.min(r.overall_score * 100, 100)}%` }}/></div>
                    <span className="font-mono text-xs">{(r.overall_score * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  <span className={r.passed_cases === r.total_test_cases ? "text-green-600" : "text-amber-600"}>
                    {r.passed_cases}
                  </span>
                  <span className="text-slate-400 mx-1">/</span>
                  {r.total_test_cases}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.latency_avg_ms?.toFixed(0)} ms</td>
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.run_timestamp).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setSelectedRun(r.version_tag)} className="text-[#2563EB] hover:underline font-medium text-xs">
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <RunDrawer runVersion={selectedRun} onClose={() => setSelectedRun(null)} />
    </div>
  );
}


export default function AgentEvalDashboard() {
  const [activeTab, setActiveTab] = useState('dataset'); // dataset | runs

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Agent Evaluation</h1>
        <p className="text-sm text-slate-500 mt-1">Manage the Golden Dataset and run evaluation pipelines.</p>
      </div>

      <div className="flex border-b border-[#E0E0E0] mb-6" role="tablist">
        <button 
          role="tab"
          data-tab="dataset"
          aria-selected={activeTab === 'dataset'}
          onClick={() => {
            setActiveTab('dataset');
            logger.info('Tab Switch: Golden Dataset', { activeTab: 'dataset' });
          }}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'dataset' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-slate-500 hover:text-[#0F172A]'}`}
        >
          Golden Dataset
        </button>
        <button 
          role="tab"
          data-tab="runs"
          aria-selected={activeTab === 'runs'}
          onClick={() => {
            setActiveTab('runs');
            logger.info('Tab Switch: Evaluation Runs', { activeTab: 'runs' });
          }}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'runs' ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-slate-500 hover:text-[#0F172A]'}`}
        >
          Evaluation Runs
        </button>
      </div>

      {activeTab === 'dataset' ? <DatasetTab /> : <RunsTab />}
    </div>
  );
}
