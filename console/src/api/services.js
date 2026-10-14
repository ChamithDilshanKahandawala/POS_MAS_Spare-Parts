import api from './axios';

export const login = (email, password) => api.post('/auth/login', { email, password });
export const verifyOtp = (userId, code) => api.post('/auth/verify-otp', { userId, code });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

export const getSellers = () => api.get('/admin/sellers');
export const updateSellerStatus = (sellerId, status) => api.patch(`/admin/sellers/${sellerId}/status`, { status });

export const getMyStore = () => api.get('/seller/me/store');
