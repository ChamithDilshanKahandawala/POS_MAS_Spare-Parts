import { createContext, useContext, useState } from 'react';
import { loginUser, googleLogin } from '../api/services';
import { isMarketplace } from '../api/dataSource';
import {
  loginCustomer, verifyOtpCode, registerCustomer,
  forgotPassword as marketplaceForgotPassword, resetPassword as marketplaceResetPassword,
  logoutCustomer,
} from '../api/marketplaceServices';

const AuthContext = createContext(null);

// Marketplace's /api/auth/me shape ({ id, name, email, platformRole,
// phone, preferredLanguage }) onto the SAME shape every existing
// component already reads off `user` ({ _id, name, email, role, status,
// shop, token }, from the POS's one-step login) — so CustomerRoute's
// `user?.role === 'customer'` check, the navbar's user menu, etc. all
// keep working unchanged. Every marketplace account created through the
// storefront's own register page IS a plain customer (platformRole:
// 'none', no SellerMember row), so role: 'customer' is always accurate
// here, never an assumption.
function normalizeMarketplaceUser(u, tokens) {
  return {
    _id: u.id, name: u.name, email: u.email, role: 'customer', status: 'active', shop: null,
    phone: u.phone, preferredLanguage: u.preferredLanguage,
    token: tokens.accessToken, refreshToken: tokens.refreshToken,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('storeUser')) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isMarketplace) {
        // Two-step OTP — this only gets as far as "code sent"; the actual
        // session is established by verifyOtp() below, once LoginPage has
        // collected the code.
        const { data } = await loginCustomer({ email, password });
        return { success: true, needsOtp: true, userId: data.userId, debugOtpCode: data.debugOtpCode };
      }
      const { data } = await loginUser({ email, password });
      setUser(data);
      localStorage.setItem('storeUser', JSON.stringify(data));
      return { success: true, user: data };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  // Marketplace-only — step 2 of login/register's OTP flow. Never called
  // in pos mode (LoginPage/RegisterPage only render the code step when
  // `needsOtp` came back from login()/register() above).
  const verifyOtp = async (userId, code) => {
    setLoading(true);
    try {
      const { data } = await verifyOtpCode({ userId, code });
      const normalized = normalizeMarketplaceUser(data.user, data);
      setUser(normalized);
      localStorage.setItem('storeUser', JSON.stringify(normalized));
      return { success: true, user: normalized };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Invalid or expired code' };
    } finally {
      setLoading(false);
    }
  };

  // Marketplace-only registration — creates the account, then goes
  // through the exact same OTP step as login (see verifyOtp above).
  // pos-mode registration still goes through src/api/services.js's
  // registerUser directly from RegisterPage, unchanged.
  const register = async (name, email, phone, password) => {
    setLoading(true);
    try {
      const { data } = await registerCustomer({ name, email, phone, password });
      return { success: true, needsOtp: true, userId: data.userId, debugOtpCode: data.debugOtpCode };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Registration failed' };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    try {
      const { data } = await marketplaceForgotPassword({ email });
      return { success: true, debugResetToken: data.debugResetToken };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Something went wrong' };
    }
  };

  const resetPassword = async (userId, token, newPassword) => {
    try {
      await marketplaceResetPassword({ userId, token, newPassword });
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Invalid or expired reset link' };
    }
  };

  const handleGoogleAuth = async (token) => {
    setLoading(true);
    try {
      const { data } = await googleLogin({ token });
      setUser(data);
      localStorage.setItem('storeUser', JSON.stringify(data));
      return { success: true, user: data };
    } catch (err) {
       return { success: false, message: err.response?.data?.message || 'Google Auth failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Best-effort — clears the marketplace refresh token server-side so
    // it can't be replayed; the local session is cleared either way,
    // same as the pos-mode logout always has been (it has no server-side
    // session to invalidate at all).
    if (isMarketplace) logoutCustomer().catch(() => {});
    setUser(null);
    localStorage.removeItem('storeUser');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user, login, verifyOtp, register, forgotPassword, resetPassword, handleGoogleAuth, logout, loading, isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
