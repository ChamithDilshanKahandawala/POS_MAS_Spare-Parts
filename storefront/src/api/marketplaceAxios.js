import axios from 'axios';
import { MARKETPLACE_API_URL } from './dataSource';

// A separate instance from src/api/axios.js (the POS one) — different
// origin, different token shape (a short-lived 15-minute access token +
// a 30-day refresh token, vs the POS's single 7-day JWT), so it needs its
// own refresh-on-401 logic. Both read/write the SAME localStorage key
// (`storeUser`) as the POS instance — only one mode is ever bundled into
// a given build (VITE_DATA_SOURCE is resolved at build time), so there's
// never a moment where both shapes could collide in storage.
const marketplaceApi = axios.create({
  baseURL: `${MARKETPLACE_API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('storeUser')) || null;
  } catch {
    return null;
  }
}

marketplaceApi.interceptors.request.use((config) => {
  const user = getStoredUser();
  if (user?.token) config.headers.Authorization = `Bearer ${user.token}`;
  return config;
});

// Same shape as console/src/api/axios.js's refresh interceptor: one
// shared in-flight refresh request even if several calls 401 at once,
// then retries the original request with the new access token.
let refreshPromise = null;

marketplaceApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthRoute = original?.url?.includes('/auth/');
    if (err.response?.status !== 401 || isAuthRoute || original?._retried) {
      return Promise.reject(err);
    }

    const user = getStoredUser();
    if (!user?.refreshToken) {
      localStorage.removeItem('storeUser');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    original._retried = true;
    try {
      refreshPromise = refreshPromise || axios.post(`${MARKETPLACE_API_URL}/api/auth/refresh`, { refreshToken: user.refreshToken });
      const { data } = await refreshPromise;
      refreshPromise = null;
      localStorage.setItem('storeUser', JSON.stringify({ ...user, token: data.accessToken }));
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return marketplaceApi(original);
    } catch (refreshErr) {
      refreshPromise = null;
      localStorage.removeItem('storeUser');
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    }
  }
);

export default marketplaceApi;
