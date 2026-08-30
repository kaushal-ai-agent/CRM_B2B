import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000/api/v1/';

const client = axios.create({
  baseURL: BASE.endsWith('/') ? BASE : `${BASE}/`,
  timeout: 10000,
});

export const fetchCustomers = async (params = {}) => {
  try {
    const res = await client.get('customers/', { params });
    // Assuming Django REST Framework pagination: { count, next, previous, results: [...] }
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

export default client;
