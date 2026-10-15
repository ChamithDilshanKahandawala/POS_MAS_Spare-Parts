import { useState, useCallback, useEffect } from 'react';
import * as authApi from '../api/services';
import { AuthContext } from './auth-context';

const PLATFORM_ROLES = ['platform_owner', 'platform_staff'];

function readViewAsSession() {
  try {
    const token = sessionStorage.getItem('consoleViewAsToken');
    const sellerId = sessionStorage.getItem('consoleViewAsSellerId');
    const sellerName = sessionStorage.getItem('consoleViewAsSellerName');
    if (!token || !sellerId) return null;
    return { token, sellerId, sellerName };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sellerMemberships, setSellerMemberships] = useState([]);
  const [activeSellerId, setActiveSellerId] = useState(() => localStorage.getItem('consoleActiveSellerId'));
  const [viewAsSession, setViewAsSession] = useState(readViewAsSession);
  // Starts false (not "loading") when there's no token to even try —
  // avoids needing to flip it off synchronously inside the effect below.
  const [loading, setLoading] = useState(() => !!localStorage.getItem('consoleAccessToken'));

  const isPlatform = !!user && PLATFORM_ROLES.includes(user.platformRole);
  const isPlatformOwner = !!user && user.platformRole === 'platform_owner';
  const isSeller = sellerMemberships.length > 0;
  const hasBothAreas = isPlatform && isSeller;
  const isViewAs = !!viewAsSession;

  // "View as seller" (Seller detail page's button) — a short-lived,
  // read-only token scoped to one seller (see services/tokens.js's
  // signViewAsToken on the backend). Kept in sessionStorage (not
  // localStorage): it's a temporary support lens, not a real session,
  // and shouldn't survive a browser restart or leak across tabs that
  // opened before it started. api/axios.js's interceptor prefers this
  // over the admin's own token/X-Seller-Id whenever it's present.
  const startViewAs = useCallback((token, sellerId, sellerName) => {
    try {
      sessionStorage.setItem('consoleViewAsToken', token);
      sessionStorage.setItem('consoleViewAsSellerId', sellerId);
      sessionStorage.setItem('consoleViewAsSellerName', sellerName || '');
    } catch { /* sessionStorage unavailable — view-as just won't persist across a reload */ }
    setViewAsSession({ token, sellerId, sellerName });
  }, []);

  const stopViewAs = useCallback(() => {
    try {
      sessionStorage.removeItem('consoleViewAsToken');
      sessionStorage.removeItem('consoleViewAsSellerId');
      sessionStorage.removeItem('consoleViewAsSellerName');
    } catch { /* nothing to clean up if it was never set */ }
    setViewAsSession(null);
  }, []);

  // setActiveSellerId (the useState setter, referentially stable across
  // renders) is exposed directly to consumers — this effect just keeps
  // localStorage in sync with whatever it's set to, from the switcher UI
  // or from loadMe() below, without either of them needing to know about
  // storage.
  useEffect(() => {
    if (activeSellerId) localStorage.setItem('consoleActiveSellerId', activeSellerId);
    else localStorage.removeItem('consoleActiveSellerId');
  }, [activeSellerId]);

  const loadMe = useCallback(async () => {
    const { data } = await authApi.getMe();
    setUser(data.user);
    setSellerMemberships(data.sellerMemberships);
    // If there's no explicitly chosen store yet (or the stored one is no
    // longer one of theirs), default to the first membership so "My
    // store" always has something valid to show.
    setActiveSellerId((current) => {
      const stillValid = data.sellerMemberships.some((m) => m.sellerId === current);
      if (stillValid || data.sellerMemberships.length === 0) return current;
      return data.sellerMemberships[0].sellerId;
    });
    return data;
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('consoleAccessToken')) return;
    let active = true;
    // set-state-in-effect's static analysis flags this because loadMe
    // (defined above via useCallback) sets state internally — but this is
    // a one-time "restore session from a stored token on app mount"
    // effect, not a component re-render cascade the rule is meant to
    // catch: there's no synchronous setState in this effect's own body,
    // active guards against the unmount-race case, and there is no
    // effect-free way to express "check auth status once when the app
    // loads" that the rule would accept instead.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMe().catch(() => {
      localStorage.removeItem('consoleAccessToken');
      localStorage.removeItem('consoleRefreshToken');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadMe]);

  // Step 1 — returns the userId the OTP screen needs; does not log the
  // user in yet.
  const login = async (email, password) => {
    const { data } = await authApi.login(email, password);
    return data.userId;
  };

  // Step 2 — completes login, stores tokens, loads the user's own
  // identity + memberships.
  const verifyOtp = async (userId, code) => {
    const { data } = await authApi.verifyOtp(userId, code);
    localStorage.setItem('consoleAccessToken', data.accessToken);
    localStorage.setItem('consoleRefreshToken', data.refreshToken);
    await loadMe();
    return data.user;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* best-effort — clear local state regardless */ }
    localStorage.removeItem('consoleAccessToken');
    localStorage.removeItem('consoleRefreshToken');
    localStorage.removeItem('consoleActiveSellerId');
    setUser(null);
    setSellerMemberships([]);
    setActiveSellerId(null);
  };

  const activeMembership = sellerMemberships.find((m) => m.sellerId === activeSellerId) || null;
  // A view-as session always acts with owner-level read access (the
  // backend's synthetic membership — middleware/authMiddleware.js's
  // requireSellerMember sets role: 'seller_owner' for it), so the Seller
  // Center's owner-only pages/tabs render the same way an admin viewing a
  // seller read-only would expect.
  const isActiveSellerOwner = isViewAs || activeMembership?.role === 'seller_owner';

  return (
    <AuthContext.Provider
      value={{
        user, loading, sellerMemberships, activeSellerId, activeMembership,
        isPlatform, isPlatformOwner, isSeller, hasBothAreas, isActiveSellerOwner,
        viewAsSession, isViewAs, startViewAs, stopViewAs,
        setActiveSellerId, login, verifyOtp, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
