import api from './marketplaceAxios';
import { MARKETPLACE_API_URL } from './dataSource';

// --- Public catalog ---
export const getListings = (params) => api.get('/public/listings', { params });
export const getListingById = (id) => api.get(`/public/listings/${id}`);
export const getRelatedListings = (id) => api.get(`/public/listings/${id}/related`);
export const getCategoryTree = () => api.get('/public/catalog/categories');
export const getVehicleMakes = () => api.get('/public/vehicles');
export const getStorePage = (slug) => api.get(`/public/stores/${slug}`);

// Milestone 6 Part A — the storefront's only way to know whether real
// checkout should render instead of the "coming soon" screen.
export const getPublicSettings = () => api.get('/public/settings');

// Rendered directly as an <img src> — not through the axios instance,
// since these are plain GETs the browser itself fetches, not something
// the app reads the body of.
export const buildMediaUrl = (mediaId, size = 'medium', format = 'webp') => `${MARKETPLACE_API_URL}/api/public/media/${mediaId}/${size}/${format}`;
export const buildStoreLogoUrl = (slug) => `${MARKETPLACE_API_URL}/api/public/stores/${slug}/logo`;
export const buildStoreBannerUrl = (slug) => `${MARKETPLACE_API_URL}/api/public/stores/${slug}/banner`;

// --- Auth (customer self-service via the same two-step OTP as any other
// marketplace account — see marketplace-backend/controllers/authController.js) ---
export const registerCustomer = (data) => api.post('/auth/register', data);
export const loginCustomer = (data) => api.post('/auth/login', data);
export const verifyOtpCode = (data) => api.post('/auth/verify-otp', data);
export const forgotPassword = (data) => api.post('/auth/forgot-password', data);
export const resetPassword = (data) => api.post('/auth/reset-password', data);
export const logoutCustomer = () => api.post('/auth/logout');
export const getMarketplaceMe = () => api.get('/auth/me');

// --- Customer profile / addresses / vehicles ---
export const getCustomerProfile = () => api.get('/customer/profile');
export const updateCustomerProfile = (data) => api.patch('/customer/profile', data);
export const getCustomerAddresses = () => api.get('/customer/addresses');
export const createCustomerAddress = (data) => api.post('/customer/addresses', data);
export const updateCustomerAddress = (id, data) => api.patch(`/customer/addresses/${id}`, data);
export const deleteCustomerAddress = (id) => api.delete(`/customer/addresses/${id}`);
export const getCustomerVehicles = () => api.get('/customer/vehicles');
export const createCustomerVehicle = (data) => api.post('/customer/vehicles', data);
export const deleteCustomerVehicle = (id) => api.delete(`/customer/vehicles/${id}`);

// --- Checkout & orders (Milestone 6 Part C) ---
export const previewCheckout = (data) => api.post('/customer/checkout/preview', data);
export const placeOrder = (data) => api.post('/customer/orders', data);
export const getMyMarketplaceOrders = () => api.get('/customer/orders');
export const getMyMarketplaceOrder = (orderNumber) => api.get(`/customer/orders/${orderNumber}`);
export const cancelMyMarketplaceOrder = (orderNumber, data) => api.post(`/customer/orders/${orderNumber}/cancel`, data);
