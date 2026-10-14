import axios from 'axios';
import logger from '../utils/logger';

const BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1/';
const BASE_URL = BASE.endsWith('/') ? BASE : `${BASE}/`;

// ---------------------------------------------------------------------------
// Default customer client (no auth header needed for existing public routes)
// ---------------------------------------------------------------------------
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

client.interceptors.response.use(
  (res) => res,
  (error) => {
    logger.error('CRM API Error', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      detail: error.response?.data?.detail || error.message,
    });
    return Promise.reject(error);
  }
);

export const fetchCustomers = async (params = {}) => {
  try {
    const res = await client.get('customers/', { params });
    return res.data;
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    throw error;
  }
};

export const fetchCustomer360 = async (id) => {
  try {
    const res = await client.get(`customers/${id}/`);
    return res.data;
  } catch (error) {
    console.error(`Failed to fetch customer 360 for id ${id}:`, error);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Authenticated client — injects Bearer token from localStorage automatically
// ---------------------------------------------------------------------------
const authClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

authClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('crm_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

authClient.interceptors.response.use(
  (res) => res,
  (error) => {
    logger.error('CRM Authenticated API Error', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      detail: error.response?.data?.detail || error.message,
    });
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const loginApi = (username, password, loginType) =>
  authClient.post('auth/login/', { username, password, login_type: loginType });

// ---------------------------------------------------------------------------
// User Management API (Owner only)
// ---------------------------------------------------------------------------
export const fetchUsersApi = () => authClient.get('users/');

export const createUserApi = (data) => authClient.post('users/', data);

export const patchUserApi = (id, data) => authClient.patch(`users/${id}/`, data);

export const deleteUserApi = (id) => authClient.delete(`users/${id}/`);

// ---------------------------------------------------------------------------
// Escalation API
// ---------------------------------------------------------------------------
export const fetchEscalationsApi = (params = {}) => authClient.get('escalations/', { params });

export const resolveEscalationApi = (id, notes = '') =>
  authClient.post(`escalations/${id}/resolve/`, { resolution_notes: notes });

// ---------------------------------------------------------------------------
// Orders API
// ---------------------------------------------------------------------------
export const fetchOrdersApi = (params = {}) => authClient.get('orders/', { params });

export const fetchOrderAnalyticsApi = () => authClient.get('orders/analytics/');

export { authClient };
export default client;
