import axios from 'axios';
import { normalizeCustomerPageResponse } from '../lib/customerDirectory';
import {
  logCustomerError,
  logCustomerRequest,
  logCustomerResponse,
  logCustomerWarning,
} from '../lib/customerDebug';

const BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1/';

const client = axios.create({
  baseURL: BASE.endsWith('/') ? BASE : `${BASE}/`,
  timeout: 10000,
});

export const fetchCustomers = async (params = {}) => {
  logCustomerRequest('fetchCustomers', { url: `${BASE}customers/`, params });

  try {
    const res = await client.get('customers/', { params });
    const normalized = normalizeCustomerPageResponse(res.data);

    logCustomerResponse('fetchCustomers', {
      count: normalized.count,
      resultCount: normalized.results.length,
      hasNext: Boolean(normalized.next),
      hasPrevious: Boolean(normalized.previous),
    });

    if (normalized.results.length === 0) {
      logCustomerWarning('fetchCustomers', {
        message: 'Frontend received zero customer rows from the backend',
        rawType: Array.isArray(res.data) ? 'array' : typeof res.data,
        rawKeys: res.data && typeof res.data === 'object' ? Object.keys(res.data) : [],
      });
    }

    return normalized;
  } catch (error) {
    logCustomerError('fetchCustomers', {
      message: error?.message,
      status: error?.response?.status,
      url: `${BASE}customers/`,
    });
    throw error;
  }
};

export const fetchCustomersByUrl = async (url) => {
  logCustomerRequest('fetchCustomersByUrl', { url });

  try {
    const res = await client.get(url);
    const normalized = normalizeCustomerPageResponse(res.data);

    logCustomerResponse('fetchCustomersByUrl', {
      count: normalized.count,
      resultCount: normalized.results.length,
      hasNext: Boolean(normalized.next),
      hasPrevious: Boolean(normalized.previous),
    });

    if (normalized.results.length === 0) {
      logCustomerWarning('fetchCustomersByUrl', {
        message: 'Frontend received zero customer rows from the paged request',
        rawType: Array.isArray(res.data) ? 'array' : typeof res.data,
        rawKeys: res.data && typeof res.data === 'object' ? Object.keys(res.data) : [],
      });
    }

    return normalized;
  } catch (error) {
    logCustomerError('fetchCustomersByUrl', {
      message: error?.message,
      status: error?.response?.status,
      url,
    });
    throw error;
  }
};

export const fetchCustomer360 = async (id) => {
  logCustomerRequest('fetchCustomer360', { id });

  try {
    const res = await client.get(`customers/${id}/`);
    logCustomerResponse('fetchCustomer360', { id, receivedCustomer: Boolean(res.data?.id) });
    return res.data;
  } catch (error) {
    logCustomerError('fetchCustomer360', {
      id,
      message: error?.message,
      status: error?.response?.status,
    });
    throw error;
  }
};

export default client;
