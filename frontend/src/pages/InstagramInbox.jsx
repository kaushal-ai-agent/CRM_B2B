import React, { useState, useEffect, useMemo } from 'react';
import { fetchAuditLogs } from '../api/agentService';
import { MessageCircle, RefreshCw, User, Bot, Clock } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function InstagramInbox() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  const fetchInbox = async () => {
    try {
      // Fetch the last 200 interactions
      const data = await fetchAuditLogs({ limit: 200, offset: 0 });
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch inbox logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    // Poll every 5 seconds for new messages
    const interval = setInterval(fetchInbox, 5000);
    return () => clearInterval(interval);
  }, []);

  // Group logs by session_id
  const sessions = useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      // Instagram session IDs are typically numeric. 
      // We'll filter out standard web UUIDs if you want, but for now we show all sessions
      // or we can explicitly filter for sessions that look like IG IDs.
      const sid = log.session_id;
      if (!groups[sid]) {
        groups[sid] = [];
      }
      groups[sid].push(log);
    });

    // Sort messages in each session by time (oldest to newest for chat view)
    Object.keys(groups).forEach(sid => {
      groups[sid].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    });

    // Return array of sessions sorted by most recent activity
    return Object.keys(groups).map(sid => ({
      sessionId: sid,
      messages: groups[sid],
      lastActive: groups[sid][groups[sid].length - 1].timestamp
    })).sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
  }, [logs]);

  // Determine active messages
  const activeMessages = selectedSession ? sessions.find(s => s.sessionId === selectedSession)?.messages || [] : [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white border border-[#E0E0E0] shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0E0E0] shrink-0 bg-slate-50">
        <h1 className="text-lg font-semibold text-[#0F172A] flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[#2563EB]" />
          Instagram Inbox (Agent Logs)
        </h1>
        <button
          onClick={fetchInbox}
          className="flex items-center gap-2 text-sm text-[#475569] hover:text-[#0F172A] transition-colors bg-white border border-[#E0E0E0] px-3 py-1.5"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Conversation List */}
        <div className="w-1/3 border-r border-[#E0E0E0] overflow-y-auto bg-slate-50">
          {loading && logs.length === 0 ? (
            <div className="p-4 text-sm text-[#64748B]">Loading conversations...</div>
          ) : sessions.length === 0 ? (
            <div className="p-4 text-sm text-[#64748B]">No messages found.</div>
          ) : (
            <div className="divide-y divide-[#E0E0E0]">
              {sessions.map(session => {
                const displayName = session.messages[0].instagram_username
                  ? `@${session.messages[0].instagram_username}`
                  : session.messages[0].customer_name
                  ? session.messages[0].customer_name
                  : `ID: ${session.sessionId}`;

                return (
                  <button
                    key={session.sessionId}
                    onClick={() => setSelectedSession(session.sessionId)}
                    className={`w-full text-left p-4 hover:bg-slate-100 transition-colors ${
                      selectedSession === session.sessionId ? 'bg-slate-200 border-l-4 border-[#2563EB]' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-sm font-semibold text-[#0F172A] truncate">
                        {displayName}
                      </span>
                      <span className="text-[10px] text-[#64748B] flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(session.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] truncate">
                      {session.messages[session.messages.length - 1].inbound_query}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {!selectedSession ? (
            <div className="flex-1 flex items-center justify-center text-[#94A3B8] text-sm">
              Select a conversation to view chat history
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeMessages.map((msg) => {
                const userDisplayName = msg.instagram_username
                  ? `@${msg.instagram_username}`
                  : msg.customer_name
                  ? msg.customer_name
                  : 'Customer';
                return (
                  <div key={msg.id} className="space-y-4">
                    
                    {/* Customer Message */}
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-[#E0E0E0]">
                        <User className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-semibold text-[#64748B] mb-1">
                          {userDisplayName}
                        </div>
                        <div className="bg-slate-100 inline-block px-4 py-2 text-sm text-[#0F172A]">
                          {msg.inbound_query}
                        </div>
                        <div className="text-[10px] text-[#94A3B8] mt-1">
                          {new Date(msg.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>

                  {/* Agent Reply */}
                  {msg.grounded_response && (
                    <div className="flex items-start gap-3 flex-row-reverse">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-200">
                        <Bot className="w-4 h-4 text-[#2563EB]" />
                      </div>
                      <div className="flex-1 flex flex-col items-end">
                        <div className="bg-[#2563EB] text-white inline-block px-4 py-2 text-sm text-left">
                          <MarkdownRenderer content={msg.grounded_response} />
                        </div>
                        {msg.escalation_flag && (
                          <span className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">
                            Escalated to Human
                          </span>
                        )}
                        <div className="text-[10px] text-[#94A3B8] mt-1">
                          Agent • {msg.latency_ms?.toFixed(0)}ms
                        </div>
                      </div>
                    </div>
                  )}

                </div>
                );
              })}
            </div>
          )}
          
          {/* Note: This is an inbox viewer. Outbound manual replies would require an extra API endpoint. */}
          {selectedSession && (
            <div className="p-4 border-t border-[#E0E0E0] bg-slate-50 text-xs text-[#64748B] text-center">
              This is a live read-only view of the agent's conversation logs. 
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
