/**
 * AgentChatWidget.jsx
 * Embedded AI Chat Console for the Customer 360 page.
 * Passes session_id and customer_id to POST /api/v1/agent/chat.
 * Renders conversational bubbles with expandable citation cards.
 */

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Database,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  WifiOff,
  MessageSquare,
} from 'lucide-react';
import { sendChatMessage, getAgentError } from '../../api/agentService';

// ---------------------------------------------------------------------------
// Intent badge (small)
// ---------------------------------------------------------------------------
const INTENT_COLORS = {
  PRODUCT_STOCK_QUERY: 'bg-blue-50 text-blue-700 border-blue-200',
  FAQ_QUERY: 'bg-purple-50 text-purple-700 border-purple-200',
  ORDERING_INTENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ESCALATION: 'bg-rose-50 text-rose-700 border-rose-200',
  GENERAL_CHAT: 'bg-slate-50 text-slate-600 border-slate-200',
};

// ---------------------------------------------------------------------------
// Citation expandable card
// ---------------------------------------------------------------------------
function CitationCard({ citation, _index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#E0E0E0] text-xs mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <Database size={11} className="text-[#2563EB] shrink-0" />
        <span className="font-mono font-semibold text-slate-700">{citation.source_table}</span>
        <span className="text-slate-500 font-mono">#{String(citation.record_id).substring(0, 8)}</span>
        <span className="ml-auto text-slate-400">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>
      {open && citation.field_values && (
        <div className="p-3 border-t border-[#E0E0E0] bg-white grid grid-cols-2 gap-2">
          {Object.entries(citation.field_values).map(([k, v]) => (
            <div key={k}>
              <p className="text-slate-500 uppercase tracking-wide" style={{ fontSize: '10px' }}>{k}</p>
              <p className="font-mono font-semibold text-[#0F172A] text-xs">{String(v)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] flex items-start gap-2">
          <div className="flex-1">
            <div className="bg-[#2563EB] text-white px-4 py-3 text-sm">
              {msg.content}
            </div>
            <p className="font-mono text-xs text-slate-400 mt-1 text-right">{msg.time}</p>
          </div>
          <div className="w-7 h-7 bg-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
            <User size={13} className="text-white" />
          </div>
        </div>
      </div>
    );
  }

  // Agent message
  const { citations = [], intent, confidence, escalation_flag } = msg.meta || {};

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] flex items-start gap-2">
        <div className={`w-7 h-7 flex items-center justify-center shrink-0 mt-0.5 ${
          escalation_flag ? 'bg-amber-500' : 'bg-[#0F172A]'
        }`}>
          {escalation_flag ? <AlertTriangle size={13} className="text-white" /> : <Bot size={13} className="text-white" />}
        </div>
        <div className="flex-1">
          {/* Intent tag */}
          {intent && (
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`border px-1.5 py-0.5 text-xs font-semibold ${INTENT_COLORS[intent] || INTENT_COLORS.GENERAL_CHAT}`}>
                {intent}
              </span>
              {confidence != null && (
                <span className="font-mono text-xs text-slate-400">
                  {(confidence * 100).toFixed(0)}% conf
                </span>
              )}
            </div>
          )}

          {/* Escalation warning */}
          {escalation_flag && (
            <div className="border border-amber-200 bg-amber-50 px-3 py-2 mb-2 flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle size={12} />
              This query has been flagged for human escalation.
            </div>
          )}

          {/* Response text */}
          <div className="border border-[#E0E0E0] bg-white px-4 py-3 text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>

          {/* Citations */}
          {citations.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-slate-400 mb-1.5 flex items-center gap-1">
                <Database size={11} />
                {citations.length} database citation{citations.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1">
                {citations.map((c, i) => <CitationCard key={i} citation={c} index={i} />)}
              </div>
            </div>
          )}

          <p className="font-mono text-xs text-slate-400 mt-1">{msg.time}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading bubble
// ---------------------------------------------------------------------------
function ThinkingBubble() {
  return (
    <div className="flex justify-start mb-4">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 bg-[#0F172A] flex items-center justify-center shrink-0">
          <Bot size={13} className="text-white" />
        </div>
        <div className="border border-[#E0E0E0] bg-white px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin text-[#2563EB]" />
          Querying live inventory…
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Chat Widget
// ---------------------------------------------------------------------------
export default function AgentChatWidget({ customerId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  // Stable session per widget mount
  const sessionId = useRef(`customer_${customerId}_${Date.now()}`).current;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await sendChatMessage({
        messageText: text,
        sessionId,
        customerId: customerId ? String(customerId) : null,
        channelType: 'CRM_WEB',
      });

      const agentMsg = {
        id: Date.now() + 1,
        role: 'agent',
        content: res.response_text || 'No response received.',
        time: new Date().toLocaleTimeString(),
        meta: {
          citations: res.citations || [],
          intent: res.intent,
          confidence: res.confidence,
          escalation_flag: res.escalation_flag,
          turn_id: res.turn_id,
        },
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      setError(getAgentError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E0E0E0] bg-[#0F172A] shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-[#2563EB]" />
          <span className="text-sm font-semibold text-white">AI Sales Assistant</span>
          <span className="w-2 h-2 bg-emerald-400 inline-block ml-1" title="Online" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">Session: {sessionId.substring(0, 24)}…</span>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              title="Clear conversation"
            >
              <RefreshCw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC]">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare size={32} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">Ask about product availability, pricing, or stock.</p>
            <p className="text-xs text-slate-400 mt-1">Responses are grounded in live database queries — no hallucinations.</p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {[
                'What is the current price of SKU QBE-751?',
                'Do you have any steel pipes in stock?',
                'What are your payment terms?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="border border-[#E0E0E0] bg-white px-3 py-2 text-xs text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}

        {loading && <ThinkingBubble />}

        {error && (
          <div className="flex items-start gap-2 mb-4 border border-rose-200 bg-rose-50 p-3">
            <WifiOff size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-[#E0E0E0] p-3 bg-white shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Ask about product stock, pricing, or availability… (Enter to send, Shift+Enter for newline)"
            disabled={loading}
            className="flex-1 border border-[#E0E0E0] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] resize-none focus:outline-none focus:border-[#2563EB] placeholder-slate-400 disabled:opacity-60"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex items-center justify-center w-10 h-10 bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5 font-mono">
          Session bound to customer #{customerId || 'unknown'}
        </p>
      </div>
    </div>
  );
}
