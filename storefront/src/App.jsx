import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import StoreLayout from './components/layout/StoreLayout';
import PageLoader from './components/layout/PageLoader';
import UpdatePrompt from './components/UpdatePrompt';

// StorefrontPage (the index route) stays a direct, eager import — it's
// always the first thing a visitor needs, so wrapping it in lazy() would
// only add a serial "fetch the chunk, then fetch its contents" round trip
// with zero bytes saved. Every other page below is lazy: none of them are
// needed for first paint, and keeping them split out of the entry chunk is
// most of what got the bundle down to begin with (see the i18n/PWA task's
// Step 0 measurements — motion, socket.io-client, and the Google Identity
// Services script this task deferred all live inside one or more of these).
import StorefrontPage from './pages/StorefrontPage';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const CustomerOrdersPage = lazy(() => import('./pages/CustomerOrdersPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const DeliveryPage = lazy(() => import('./pages/DeliveryPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));

// --- Customer Only Route ---
// Redirecting here loses the page the customer was trying to reach (e.g.
// /checkout) unless we carry it forward as router state — LoginPage and
// RegisterPage read `location.state.from` to send them back after auth.
const CustomerRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  return user?.role === 'customer' ? children : <Navigate to="/login" replace state={{ from: location }} />;
};

// Remounts ProductDetailPage fresh on every :id change (React's own
// recommended pattern for "reset all state when X changes" — see
// react.dev/learn/you-might-not-need-an-effect) instead of the page
// resetting its own state synchronously inside an effect.
const ProductDetailRoute = () => {
  const { id } = useParams();
  return <ProductDetailPage key={id} />;
};

// Same reasoning as ProductDetailRoute — remounts CategoryPage fresh on
// every :slug change. Its own filter/sort state lives in the URL query
// string (owned by react-router, not this component), so it survives the
// remount untouched; only the fetched product list/load status reset.
const CategoryRoute = () => {
  const { slug } = useParams();
  return <CategoryPage key={slug} />;
};

// Same reasoning again — remounts OrderSuccessPage fresh per :id so its
// router-state-vs-fetch initial state is computed clean each time.
const OrderSuccessRoute = () => {
  const { id } = useParams();
  return <OrderSuccessPage key={id} />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<PageLoader />}><RegisterPage /></Suspense>} />

      <Route path="/" element={<StoreLayout />}>
        <Route index element={<StorefrontPage />} />
        <Route path="cart" element={<Suspense fallback={<PageLoader />}><CartPage /></Suspense>} />
        <Route path="product/:id" element={<Suspense fallback={<PageLoader />}><ProductDetailRoute /></Suspense>} />
        <Route path="category/:slug" element={<Suspense fallback={<PageLoader />}><CategoryRoute /></Suspense>} />
        <Route path="checkout" element={<CustomerRoute><Suspense fallback={<PageLoader />}><CheckoutPage /></Suspense></CustomerRoute>} />
        <Route path="order-success/:id" element={<CustomerRoute><Suspense fallback={<PageLoader />}><OrderSuccessRoute /></Suspense></CustomerRoute>} />
        <Route path="orders" element={<CustomerRoute><Suspense fallback={<PageLoader />}><CustomerOrdersPage /></Suspense></CustomerRoute>} />
        <Route path="about" element={<Suspense fallback={<PageLoader />}><AboutPage /></Suspense>} />
        <Route path="contact" element={<Suspense fallback={<PageLoader />}><ContactPage /></Suspense>} />
        <Route path="delivery" element={<Suspense fallback={<PageLoader />}><DeliveryPage /></Suspense>} />
        <Route path="returns" element={<Suspense fallback={<PageLoader />}><ReturnsPage /></Suspense>} />
        <Route path="privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPage /></Suspense>} />
        <Route path="terms" element={<Suspense fallback={<PageLoader />}><TermsPage /></Suspense>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
        <BrowserRouter>
        <AppRoutes />
        <UpdatePrompt />
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
  );
}