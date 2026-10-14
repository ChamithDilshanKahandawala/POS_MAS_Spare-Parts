import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './context/useAuth';
import { RequireAuth, RequirePlatform, RequireSeller } from './components/RouteGuards';
import ConsoleLayout from './components/layout/ConsoleLayout';
import LoginPage from './pages/auth/LoginPage';
import OtpPage from './pages/auth/OtpPage';
import OverviewPage from './pages/admin/OverviewPage';
import SellerHomePage from './pages/seller/SellerHomePage';

// Remounts SellerHomePage fresh whenever the switcher changes which store
// is active (same pattern as the storefront's ProductDetailRoute —
// react.dev's own recommended way to reset a page's state on a key
// change, instead of the page resetting itself synchronously in an effect).
const SellerRoute = () => {
  const { activeSellerId } = useAuth();
  return <SellerHomePage key={activeSellerId} />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/otp" element={<OtpPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<ConsoleLayout />}>
                <Route element={<RequirePlatform />}>
                  <Route path="/admin" element={<OverviewPage />} />
                </Route>
                <Route element={<RequireSeller />}>
                  <Route path="/seller" element={<SellerRoute />} />
                </Route>
                <Route path="/" element={<Navigate to="/admin" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
