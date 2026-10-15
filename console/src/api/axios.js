import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the access token to every request, and the active X-Seller-Id
// (if any) when the caller is in the "My store" area — see
// context/AuthContext.jsx for where both are set. A "view as seller"
// session (also set there) takes priority over both: its token is a
// different, read-only-scoped token, and the backend ignores X-Seller-Id
// entirely while it's active, but this still sends it for consistency/
// debugging.
api.interceptors.request.use((config) => {
  const viewAsToken = sessionStorage.getItem('consoleViewAsToken');
  const viewAsSellerId = sessionStorage.getItem('consoleViewAsSellerId');

  if (viewAsToken) {
    config.headers.Authorization = `Bearer ${viewAsToken}`;
    if (viewAsSellerId) config.headers['X-Seller-Id'] = viewAsSellerId;
    return config;
  }

  const accessToken = localStorage.getItem('consoleAccessToken');
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;

  const activeSellerId = localStorage.getItem('consoleActiveSellerId');
  if (activeSellerId) config.headers['X-Seller-Id'] = activeSellerId;

  return config;
});

// On a 401, try refreshing the access token once before giving up — a
// short-lived (15m) access token expiring mid-session shouldn't force a
// re-login if the refresh token is still valid.
let refreshPromise = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthRoute = original?.url?.startsWith('/auth/');
    if (err.response?.status !== 401 || isAuthRoute || original._retried) {
      return Promise.reject(err);
    }

    // A view-as token (20 min) expiring mid-session isn't recoverable by
    // refreshing the admin's own access token — refreshing would succeed
    // but the retried request would still carry the expired view-as
    // token (the request interceptor above always prefers it when
    // present), looping back to the same 401. Just end the session.
    if (sessionStorage.getItem('consoleViewAsToken')) {
      sessionStorage.removeItem('consoleViewAsToken');
      sessionStorage.removeItem('consoleViewAsSellerId');
      sessionStorage.removeItem('consoleViewAsSellerName');
      window.location.href = '/admin/sellers';
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem('consoleRefreshToken');
    if (!refreshToken) {
      localStorage.removeItem('consoleAccessToken');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    original._retried = true;
    try {
      refreshPromise = refreshPromise || axios.post('/api/auth/refresh', { refreshToken });
      const { data } = await refreshPromise;
      refreshPromise = null;
      localStorage.setItem('consoleAccessToken', data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshErr) {
      refreshPromise = null;
      localStorage.removeItem('consoleAccessToken');
      localStorage.removeItem('consoleRefreshToken');
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    }
  }
);

export default api;
