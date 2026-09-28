/**
 * agentService.js
 * Centralized API client for the AI Agent microservice (FastAPI on port 8100).
 */

import axios from 'axios';

const AGENT_BASE = import.meta.env.VITE_AGENT_API_BASE || 'http://localhost:8100';

export const agentClient = axios.create({
  baseURL: AGENT_BASE,
  timeout: 60000, // LLM calls can be slow
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/**
 * Send a chat message to the agent.
 * @param {string} messageText
 * @param {string} sessionId
 * @param {string|null} customerId
 * @param {string} channelType
 * @returns {Promise<ChatResponse>}
 */
export const sendChatMessage = async ({
  messageText,
  sessionId,
  customerId = null,
  channelType = 'WEB',
}) => {
  const res = await agentClient.post('/api/v1/agent/chat', {
    message_text: messageText,
    session_id: sessionId,
    customer_id: customerId,
    channel_type: channelType,
  });
  return res.data;
};

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------

/**
 * Fetch paginated audit logs.
 * @param {object} params - { session_id, customer_id, limit, offset }
 * @returns {Promise<AuditLog[]>}
 */
export const fetchAuditLogs = async (params = {}) => {
  const res = await agentClient.get('/api/v1/agent/audit/logs', { params });
  return res.data;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Get current runtime configuration (API key is masked server-side).
 * @returns {Promise<AgentConfig>}
 */
export const getAgentConfig = async () => {
  const res = await agentClient.get('/api/v1/agent/config');
  return res.data;
};

/**
 * Update runtime configuration overrides.
 * @param {object} config
 * @returns {Promise<{status: string, config: AgentConfig}>}
 */
export const updateAgentConfig = async (config) => {
  const res = await agentClient.put('/api/v1/agent/config', config);
  return res.data;
};

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

/**
 * Check agent service health.
 * @returns {Promise<HealthResponse>}
 */
export const fetchAgentHealth = async () => {
  const res = await agentClient.get('/api/v1/agent/health');
  return res.data;
};

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

/**
 * Embed and save a new FAQ entry.
 * @param {string} title
 * @param {string} content
 * @returns {Promise<FaqEntry>}
 */
export const embedFaq = async ({ title, content }) => {
  const res = await agentClient.post('/api/v1/agent/faq', { title, content });
  return res.data;
};

/**
 * List all embedded FAQ entries.
 * @returns {Promise<FaqEntry[]>}
 */
export const listFaqs = async () => {
  const res = await agentClient.get('/api/v1/agent/faq');
  return res.data;
};

/**
 * Delete a FAQ entry by ID.
 * @param {string} faqId
 */
export const deleteFaq = async (faqId) => {
  const res = await agentClient.delete(`/api/v1/agent/faq/${faqId}`);
  return res.data;
};

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------

/**
 * Verify Instagram Graph API connection.
 * @returns {Promise<{ok: boolean, account?: object, error?: string}>}
 */
export const verifyInstagramConnection = async () => {
  const res = await agentClient.get('/api/v1/agent/instagram/verify');
  return res.data;
};

// ---------------------------------------------------------------------------
// Error normalizer
// ---------------------------------------------------------------------------

/**
 * Extract a human-readable error message from an axios error.
 * @param {Error} err
 * @returns {string}
 */
export const getAgentError = (err) => {
  if (err?.response?.data?.detail) return err.response.data.detail;
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message === 'Network Error') return 'Agent service is offline. Make sure it is running on port 8100.';
  return err?.message || 'An unknown error occurred.';
};

export default agentClient;
