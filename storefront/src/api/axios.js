import axios from 'axios';
import { setStaleProductData } from '../utils/staleDataSignal';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// src/sw.js's NetworkFirst plugin for /api/products* sets this header only
// on its cache-fallback path (the live network request genuinely failed) —
// never on a fresh response. Lets the UI show the stale-data banner even
// while navigator.onLine is still true (e.g. the network request failed
// for a reason other than true offline, like a dropped connection).
api.interceptors.response.use((res) => {
  if (res.config?.method === 'get' && res.config?.url?.includes('/products')) {
    setStaleProductData(res.headers?.['x-from-sw-cache'] === '1');
  }
  return res;
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('storeUser') || 'null');
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('storeUser');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
