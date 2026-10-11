import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import StoreLayout from './components/layout/StoreLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StorefrontPage from './pages/StorefrontPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import CheckoutPage from './pages/CheckoutPage';
const CartPage = lazy(() => import('./pages/CartPage'));

// --- Customer Only Route ---
// Redirecting here loses the page the customer was trying to reach (e.g.
// /checkout) unless we carry it forward as router state — LoginPage and
// RegisterPage read `location.state.from` to send them back after auth.
const CustomerRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  return user?.role === 'customer' ? children : <Navigate to="/login" replace state={{ from: location }} />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      
      <Route path="/" element={<StoreLayout />}>
        <Route index element={<StorefrontPage />} />
        <Route path="cart" element={<Suspense fallback={null}><CartPage /></Suspense>} />
        <Route path="checkout" element={<CustomerRoute><CheckoutPage /></CustomerRoute>} />
        <Route path="orders" element={<CustomerRoute><CustomerOrdersPage /></CustomerRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1021422730303-dummy.apps.googleusercontent.com';
  
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
          <BrowserRouter>
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
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}