import api from './axios';

export const login = (email, password) => api.post('/auth/login', { email, password });
export const verifyOtp = (userId, code) => api.post('/auth/verify-otp', { userId, code });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// --- Overview ---
export const getOverview = () => api.get('/admin/overview');

// --- Sellers ---
export const getSellers = (params) => api.get('/admin/sellers', { params });
export const getSeller = (id) => api.get(`/admin/sellers/${id}`);
export const updateSellerStatus = (id, action, reason) => api.patch(`/admin/sellers/${id}/status`, { action, reason });
export const updateSellerOverrides = (id, body) => api.patch(`/admin/sellers/${id}/overrides`, body);
export const viewAsSeller = (id) => api.post(`/admin/sellers/${id}/view-as`);
export const getSellerBankFull = (id) => api.get(`/admin/sellers/${id}/bank`);
export const verifySellerBank = (id) => api.patch(`/admin/sellers/${id}/bank/verify`, {});
export const rejectSellerBank = (id, reason) => api.patch(`/admin/sellers/${id}/bank/reject`, { reason });

// --- Applications ---
export const getApplications = (params) => api.get('/admin/applications', { params });
export const getApplication = (id) => api.get(`/admin/applications/${id}`);
// Auth is a Bearer header, not a cookie, so the document/CSV endpoints
// below can't just be linked to directly — fetched as a blob instead,
// with the caller responsible for URL.createObjectURL/revokeObjectURL.
export const getApplicationDocumentBlob = (id, type) => api.get(`/admin/applications/${id}/documents/${type}`, { responseType: 'blob' });
export const updateApplicationChecklist = (id, body) => api.patch(`/admin/applications/${id}/checklist`, body);
export const addApplicationNote = (id, text) => api.post(`/admin/applications/${id}/notes`, { text });
export const requestApplicationInfo = (id, message) => api.post(`/admin/applications/${id}/request-info`, { message });
export const approveApplication = (id) => api.post(`/admin/applications/${id}/approve`, {});
export const rejectApplication = (id, reason) => api.post(`/admin/applications/${id}/reject`, { reason });

// --- Platform staff ---
export const getPlatformStaff = () => api.get('/admin/platform-staff');
export const invitePlatformStaff = (email) => api.post('/admin/platform-staff/invite', { email });
export const changePlatformStaffRole = (id, role) => api.patch(`/admin/platform-staff/${id}/role`, { role });
export const removePlatformStaff = (id) => api.delete(`/admin/platform-staff/${id}`);

// --- Audit log ---
export const getAuditLog = (params) => api.get('/admin/audit-log', { params });
export const getAuditLogCsvBlob = (params) => api.get('/admin/audit-log/export.csv', { params, responseType: 'blob' });

// --- Settings ---
export const getSettings = () => api.get('/admin/settings');
export const updateSettings = (body) => api.patch('/admin/settings', body);

// --- Catalog: categories (admin) ---
export const getAdminCategoryTree = () => api.get('/admin/catalog/categories');
export const getAdminCategoryDetail = (id) => api.get(`/admin/catalog/categories/${id}`);
export const createCategory = (body) => api.post('/admin/catalog/categories', body);
export const updateCategory = (id, body) => api.patch(`/admin/catalog/categories/${id}`, body);
export const deleteCategory = (id) => api.delete(`/admin/catalog/categories/${id}`);
export const reorderCategories = (body) => api.patch('/admin/catalog/categories/reorder', body);

// --- Catalog: vehicles (admin) ---
export const getAdminVehicleMakes = (params) => api.get('/admin/vehicles', { params });
export const createVehicleMake = (body) => api.post('/admin/vehicles', body);
export const updateVehicleMake = (id, body) => api.patch(`/admin/vehicles/${id}`, body);

// --- Catalog: seller (read-only, own effective rates) ---
export const getSellerCategoryTree = () => api.get('/seller/catalog/categories');

// --- Public (seller application + invite acceptance) ---
export const submitSellerApplication = (formData) => api.post('/public/seller-applications', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const getInvite = (token) => api.get(`/public/invites/${token}`);
export const acceptInvite = (token, body) => api.post(`/public/invites/${token}/accept`, body);

// --- Seller (My store) ---
export const getMyStore = () => api.get('/seller/me/store');
export const updateMyStore = (body) => api.patch('/seller/me/store', body);
export const getMyStoreHome = () => api.get('/seller/me/home');

export const getLogoBlob = () => api.get('/seller/me/store/logo', { responseType: 'blob' });
export const getBannerBlob = () => api.get('/seller/me/store/banner', { responseType: 'blob' });
export const uploadLogo = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/seller/me/store/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const uploadBanner = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/seller/me/store/banner', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const bankStepUpStart = (password) => api.post('/seller/bank/step-up', { password });
export const bankStepUpVerify = (code) => api.post('/seller/bank/step-up/verify', { code });
export const getMyBank = () => api.get('/seller/bank');
export const updateMyBank = (body) => api.patch('/seller/bank', body);

export const getMyStaff = () => api.get('/seller/staff');
export const inviteMyStaff = (email) => api.post('/seller/staff/invite', { email });
export const removeMyStaff = (id) => api.delete(`/seller/staff/${id}`);

export const getMyActivity = (params) => api.get('/seller/activity', { params });

// --- Notifications (shared across admin + seller) ---
export const getNotifications = (params) => api.get('/notifications', { params });
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');
