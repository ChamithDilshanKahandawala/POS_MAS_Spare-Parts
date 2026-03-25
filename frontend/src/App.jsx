import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { io } from 'socket.io-client';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage'; // 👈 1. Register Page eka damma
import DashboardPage from './pages/DashboardPage';
import InventoryPage from './pages/InventoryPage';
import POSPage from './pages/POSPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import AlertsPage from './pages/AlertsPage';
import CustomersPage from './pages/CustomersPage';
import SuppliersPage from './pages/SuppliersPage';
import UsersPage from './pages/UsersPage'; 
import WebOrdersPage from './pages/WebOrdersPage';

// --- Standard Private Route (Check login) ---
const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

// --- Admin Only Route (Check role) ---
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
};

function GlobalSocketManager() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5001', {
       transports: ['websocket', 'polling']
    });

    socket.on('new_web_order', (sale) => {
      // Create HTML Audio element for a simple notification ping
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio play prevented by browser policy'));
      } catch (err) {}

      toast((t) => (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div>
             <div style={{ fontWeight: 'bold' }}>New Web Order! 🛍️</div>
             <div style={{ fontSize: '12px' }}>{sale.invoice_number} - Rs. {sale.total_amount?.toLocaleString() || '0'}</div>
          </div>
          <button 
             onClick={() => {
               toast.dismiss(t.id);
               navigate('/web-orders');
             }}
             style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
            View
          </button>
        </div>
      ), { duration: 15000 });
      
      // Dispatch custom event for real-time refetching locally
      window.dispatchEvent(new CustomEvent('web_order_received'));
    });

    return () => socket.disconnect();
  }, [user, navigate]);
  
  return null;
}

function AppRoutes() {
  return (
    <Routes>
      {/* --- Public Routes --- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} /> {/* 👈 2. Register route eka add kala */}
      
      {/* --- Protected Routes --- */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="sales" element={<SalesHistoryPage />} />
        <Route path="web-orders" element={<WebOrdersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />

        {/* --- 🔐 ADMIN ONLY ROUTES --- */}
        <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <GlobalSocketManager />
          <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: 'white' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'white' } },
          }}
        />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}