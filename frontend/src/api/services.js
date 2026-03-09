import api from './axios';

// --- AUTH ---
export const loginUser   = (data) => api.post('/auth/login', data);
export const registerUser= (data) => api.post('/auth/register', data);
export const getMe       = ()     => api.get('/auth/me');

// --- STAFF / USER MANAGEMENT (NEW) ---
// Admin ta usersla list ekama ganna
export const fetchAllUsers = () => api.get('/users');

// User kenekwa approve karanna
export const approveUser = (id) => api.put(`/users/${id}/approve`);

// User kenekwa reject karanna
export const rejectUser = (id) => api.put(`/users/${id}/reject`);

// Admin/Staff role eka toggle karanna
export const promoteUser = (id) => api.put(`/users/${id}/promote`);

// Account eka activate/deactivate karanna
export const toggleUserStatus = (id) => api.put(`/users/${id}/toggle`);

// User account ekak permanently delete karanna
export const deleteUser = (id) => api.delete(`/users/${id}`);


// --- PRODUCTS ---
export const getProducts      = (params) => api.get('/products', { params });
export const getProductById   = (id)     => api.get(`/products/${id}`);
export const createProduct    = (data)   => api.post('/products', data);
export const updateProduct    = (id, data) => api.put(`/products/${id}`, data);
export const deleteProduct    = (id)     => api.delete(`/products/${id}`);
export const getLowStockAlerts= ()       => api.get('/products/low-stock/alerts');

// --- EXCEL IMPORT / EXPORT ---
export const importProductsExcel = (formData) =>
  api.post('/products/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const exportProductsExcel = () =>
  api.get('/products/export', { responseType: 'blob' });

// --- SALES ---
export const createSale  = (data)   => api.post('/sales', data);
export const getSales    = (params) => api.get('/sales', { params });
export const getSaleById = (id)     => api.get(`/sales/${id}`);
export const getAnalytics= (period) => api.get('/sales/analytics/summary', { params: { period } });

// --- CUSTOMERS ---
export const getCustomers    = (params)    => api.get('/customers', { params });
export const getCustomerById = (id)        => api.get(`/customers/${id}`);
export const createCustomer  = (data)      => api.post('/customers', data);
export const updateCustomer  = (id, data)  => api.put(`/customers/${id}`, data);
export const deleteCustomer  = (id)        => api.delete(`/customers/${id}`);
export const updateCredit    = (id, data)  => api.put(`/customers/${id}/credit`, data);

// --- SUPPLIERS ---
export const getSuppliers   = (params)   => api.get('/suppliers', { params });
export const createSupplier = (data)     => api.post('/suppliers', data);
export const updateSupplier = (id, data) => api.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id)       => api.delete(`/suppliers/${id}`);

// --- RETURNS ---
export const getReturns   = ()     => api.get('/returns');
export const createReturn = (data) => api.post('/returns', data);