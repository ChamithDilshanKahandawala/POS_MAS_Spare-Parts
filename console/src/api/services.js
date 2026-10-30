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

// --- Catalog: public vehicles (fitment picker) ---
export const getPublicVehicles = () => api.get('/public/vehicles');

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

// --- Seller: listings (Milestone 3) ---
export const getMyListings = (params) => api.get('/seller/listings', { params });
export const getMyListing = (id) => api.get(`/seller/listings/${id}`);
export const createMyListing = (categoryId) => api.post('/seller/listings', { categoryId });
export const updateMyListing = (id, body) => api.patch(`/seller/listings/${id}`, body);
export const checkMyListing = (id) => api.post(`/seller/listings/${id}/check`, {});
export const submitMyListing = (id) => api.post(`/seller/listings/${id}/submit`, {});
export const hideMyListing = (id) => api.post(`/seller/listings/${id}/hide`, {});
export const showMyListing = (id) => api.post(`/seller/listings/${id}/show`, {});
export const deleteMyListing = (id) => api.delete(`/seller/listings/${id}`);
export const duplicateMyListing = (id) => api.post(`/seller/listings/${id}/duplicate`, {});
export const getCommissionPreview = (categoryId, priceCents) => api.get('/seller/listings/commission-preview', { params: { categoryId, priceCents } });

// --- Seller: POS connection (Milestone 4) ---
export const getMyPosStatus = () => api.get('/seller/pos/status');
export const getPosProducts = (params) => api.get('/seller/pos/products', { params });
export const importPosProducts = (posProductIds) => api.post('/seller/pos/import', { posProductIds });
export const syncPosNow = () => api.post('/seller/pos/sync', {});

// --- Admin: seller POS connection (Milestone 4) ---
export const getSellerPosStatus = (id) => api.get(`/admin/sellers/${id}/pos`);
export const updateSellerPosConnection = (id, body) => api.patch(`/admin/sellers/${id}/pos`, body);

// Photos are much bigger than a JSON autosave body and can take far
// longer to upload on a slow connection — the shared 30s client timeout
// would cut off a perfectly good slow upload, so this gets its own,
// longer budget plus upload-progress for the step's progress bar.
export const uploadListingMedia = (listingId, files, onProgress) => {
  const formData = new FormData();
  for (const file of files) formData.append('files', file);
  return api.post(`/seller/listings/${listingId}/media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: onProgress ? (e) => onProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0) : undefined,
  });
};
export const deleteMyMedia = (id) => api.delete(`/seller/media/${id}`);
export const getMyMediaBlob = (id, size = 'medium', format = 'jpg') => api.get(`/seller/media/${id}/${size}/${format}`, { responseType: 'blob' });

// --- Admin: listing review (Milestone 3) ---
export const getListingQueue = (params) => api.get('/admin/listings', { params });
export const getListingReviewDetail = (id) => api.get(`/admin/listings/${id}`);
export const approveListing = (id) => api.post(`/admin/listings/${id}/approve`, {});
export const rejectListing = (id, reasons, note) => api.post(`/admin/listings/${id}/reject`, { reasons, note });
export const suspendListing = (id, reason) => api.post(`/admin/listings/${id}/suspend`, { reason });
export const reinstateListing = (id, to) => api.post(`/admin/listings/${id}/reinstate`, { to });
export const getAdminMediaBlob = (id, size = 'medium', format = 'jpg') => api.get(`/admin/listings/media/${id}/${size}/${format}`, { responseType: 'blob' });

// --- Seller: orders (Milestone 6 Part E) ---
export const getMyOrders = (params) => api.get('/seller/orders', { params });
export const getMyOrderDetail = (id) => api.get(`/seller/orders/${id}`);
export const transitionMyOrder = (id, body) => api.post(`/seller/orders/${id}/transition`, body);
export const markOrderPosRecorded = (id) => api.post(`/seller/orders/${id}/pos-recorded`, {});
export const markOrderReturnPosRecorded = (id) => api.post(`/seller/orders/${id}/return-pos-recorded`, {});

// --- Admin: orders (Milestone 6 Part F) ---
export const getAdminOrders = (params) => api.get('/admin/orders', { params });
export const getAdminOrderDetail = (id) => api.get(`/admin/orders/${id}`);
export const getAdminOrdersOverview = () => api.get('/admin/orders-overview');
export const cancelAdminOrder = (id, reason) => api.post(`/admin/orders/${id}/cancel`, { reason });
export const moveAdminOrderOn = (id, toStatus, reason) => api.post(`/admin/orders/${id}/move-on`, { toStatus, reason });
export const addAdminOrderNote = (id, text) => api.post(`/admin/orders/${id}/notes`, { text });

// --- Notifications (shared across admin + seller) ---
export const getNotifications = (params) => api.get('/notifications', { params });
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.patch('/notifications/read-all');

// --- Seller: Finance (Milestone 7 Part D) ---
export const getMyFinanceBalances = () => api.get('/seller/finance/balances');
export const getMyFinanceLedger = (params) => api.get('/seller/finance/ledger', { params });
export const getMyFinanceOrderBreakdown = (id) => api.get(`/seller/finance/orders/${id}`);
export const getMyFinanceStatements = () => api.get('/seller/finance/statements');
export const getMyFinanceStatementCsvBlob = (payoutId) => api.get(`/seller/finance/statements/${payoutId}/export.csv`, { responseType: 'blob' });
export const getMyFinancePayouts = () => api.get('/seller/finance/payouts');

// --- Admin: Finance (Milestone 7) ---
export const adminStepUpStart = (password) => api.post('/admin/step-up', { password });
export const adminStepUpVerify = (code) => api.post('/admin/step-up/verify', { code });
export const getFinanceOverview = () => api.get('/admin/finance/overview');
export const getFinanceSellerBalances = () => api.get('/admin/finance/sellers');
export const getFinanceCodNotReceived = () => api.get('/admin/finance/cod-not-received');
export const getFinanceSellerLedger = (id, params) => api.get(`/admin/finance/sellers/${id}/ledger`, { params });
export const createFinanceAdjustment = (id, body) => api.post(`/admin/finance/sellers/${id}/adjustments`, body);
export const updateSellerSettlementMode = (id, settlementMode) => api.patch(`/admin/finance/sellers/${id}/settlement-mode`, { settlementMode });

export const getRemittanceMapping = (courier) => api.get(`/admin/finance/remittances/mapping/${encodeURIComponent(courier)}`);
export const saveRemittanceMapping = (courier, body) => api.put(`/admin/finance/remittances/mapping/${encodeURIComponent(courier)}`, body);
export const listRemittances = (params) => api.get('/admin/finance/remittances', { params });
export const uploadRemittanceFile = (courierName, file) => {
  const form = new FormData();
  form.append('courierName', courierName);
  form.append('file', file);
  return api.post('/admin/finance/remittances/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export const getPayoutRuns = () => api.get('/admin/finance/payout-runs');
export const createPayoutRun = () => api.post('/admin/finance/payout-runs', {});
export const getPayoutRun = (id) => api.get(`/admin/finance/payout-runs/${id}`);
export const removeSellerFromPayoutRun = (runId, sellerId) => api.delete(`/admin/finance/payout-runs/${runId}/sellers/${sellerId}`);
export const approvePayoutRun = (id) => api.post(`/admin/finance/payout-runs/${id}/approve`, {});
export const getPayoutRunExportCsvBlob = (id) => api.get(`/admin/finance/payout-runs/${id}/export.csv`, { responseType: 'blob' });
export const markPayoutPaid = (id, bankReference) => api.post(`/admin/finance/payouts/${id}/mark-paid`, { bankReference });
export const markPayoutFailed = (id, reason) => api.post(`/admin/finance/payouts/${id}/mark-failed`, { reason });

// --- Returns (Milestone 8) ---
export const getSellerReturns = (params) => api.get('/seller/returns', { params });
export const getSellerReturn = (id) => api.get(`/seller/returns/${id}`);
export const respondToSellerReturn = (id, body) => api.post(`/seller/returns/${id}/respond`, body);
export const markSellerReturnReceived = (id) => api.post(`/seller/returns/${id}/received`, {});
export const getSellerReturnPhotoBlob = (id, index) => api.get(`/seller/returns/${id}/photos/${index}`, { responseType: 'blob' });
export const getAdminReturns = (params) => api.get('/admin/returns', { params });
export const getAdminReturn = (id) => api.get(`/admin/returns/${id}`);
export const decideAdminReturn = (id, body) => api.post(`/admin/returns/${id}/decide`, body);
export const refundAdminReturn = (id, body) => api.post(`/admin/returns/${id}/refund`, body);
export const getAdminReturnPhotoBlob = (id, index) => api.get(`/admin/returns/${id}/photos/${index}`, { responseType: 'blob' });
