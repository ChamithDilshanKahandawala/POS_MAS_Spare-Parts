import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './context/useAuth';
import { RequireAuth, RequirePlatform, RequirePlatformOwner, RequireSeller, RequireSellerOwner } from './components/RouteGuards';
import ConsoleLayout from './components/layout/ConsoleLayout';
import LoginPage from './pages/auth/LoginPage';
import OtpPage from './pages/auth/OtpPage';
import InviteAcceptPage from './pages/auth/InviteAcceptPage';
import ApplyPage from './pages/public/ApplyPage';
import OverviewPage from './pages/admin/OverviewPage';
import SellersPage from './pages/admin/SellersPage';
import SellerDetailPage from './pages/admin/SellerDetailPage';
import ApplicationsPage from './pages/admin/ApplicationsPage';
import ApplicationDetailPage from './pages/admin/ApplicationDetailPage';
import PlatformStaffPage from './pages/admin/PlatformStaffPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import SettingsPage from './pages/admin/SettingsPage';
import ComingSoonPage from './pages/admin/ComingSoonPage';
import CatalogPage from './pages/admin/CatalogPage';
import VehiclesPage from './pages/admin/VehiclesPage';
import ListingReviewPage from './pages/admin/ListingReviewPage';
import ListingReviewDetailPage from './pages/admin/ListingReviewDetailPage';
import SellerHomePage from './pages/seller/SellerHomePage';
import StoreSettingsPage from './pages/seller/StoreSettingsPage';
import StaffPage from './pages/seller/StaffPage';
import ActivityLogPage from './pages/seller/ActivityLogPage';
import NotificationsPage from './pages/seller/NotificationsPage';
import CategoriesFeesPage from './pages/seller/CategoriesFeesPage';
import ProductsPage from './pages/seller/ProductsPage';
import ImportFromPosPage from './pages/seller/ImportFromPosPage';
import ListingWizardPage from './pages/seller/wizard/ListingWizardPage';
import OrdersPage from './pages/seller/OrdersPage';
import OrderDetailPage from './pages/seller/OrderDetailPage';
import ComingSoonSellerPage from './pages/seller/ComingSoonSellerPage';
import AdminOrdersPage from './pages/admin/OrdersPage';
import AdminOrderDetailPage from './pages/admin/OrderDetailPage';
import AdminFinancePage from './pages/admin/FinancePage';
import PayoutRunDetailPage from './pages/admin/PayoutRunDetailPage';
import SellerFinancePage from './pages/seller/FinancePage';

// Remounts the wrapped seller page fresh whenever the switcher changes
// which store is active (same pattern as the storefront's
// ProductDetailRoute — react.dev's own recommended way to reset a page's
// state on a key change, instead of the page resetting itself
// synchronously in an effect). Every /seller/* page goes through this,
// not just Home, since the switcher can change which store ANY of them
// is looking at.
const sellerRoute = (Page) => function SellerAreaRoute() {
  const { activeSellerId, isViewAs, viewAsSession } = useAuth();
  const effectiveSellerId = isViewAs ? viewAsSession.sellerId : activeSellerId;
  return Page ? <Page key={effectiveSellerId} /> : null;
};

const SellerRoute = sellerRoute(SellerHomePage);
const StoreSettingsRoute = sellerRoute(StoreSettingsPage);
const StaffRoute = sellerRoute(StaffPage);
const ActivityLogRoute = sellerRoute(ActivityLogPage);
const NotificationsRoute = sellerRoute(NotificationsPage);
const CategoriesFeesRoute = sellerRoute(CategoriesFeesPage);
const ProductsRoute = sellerRoute(ProductsPage);
const ImportFromPosRoute = sellerRoute(ImportFromPosPage);
const ListingWizardRoute = sellerRoute(ListingWizardPage);
const OrdersRoute = sellerRoute(OrdersPage);
const FinanceRoute = sellerRoute(SellerFinancePage);
const OrderDetailRoute = sellerRoute(OrderDetailPage);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/otp" element={<OtpPage />} />
            <Route path="/apply" element={<ApplyPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<ConsoleLayout />}>
                <Route element={<RequirePlatform />}>
                  <Route path="/admin" element={<OverviewPage />} />
                  <Route path="/admin/sellers" element={<SellersPage />} />
                  <Route path="/admin/sellers/:id" element={<SellerDetailPage />} />
                  <Route path="/admin/applications" element={<ApplicationsPage />} />
                  <Route path="/admin/applications/:id" element={<ApplicationDetailPage />} />
                  <Route path="/admin/listing-review" element={<ListingReviewPage />} />
                  <Route path="/admin/listing-review/:id" element={<ListingReviewDetailPage />} />
                  <Route path="/admin/catalog" element={<CatalogPage />} />
                  <Route path="/admin/catalog/vehicles" element={<VehiclesPage />} />
                  <Route path="/admin/orders" element={<AdminOrdersPage />} />
                  <Route path="/admin/orders/:id" element={<AdminOrderDetailPage />} />
                  <Route path="/admin/returns-disputes" element={<ComingSoonPage navKey="returnsDisputes" milestone={3} />} />
                  <Route path="/admin/finance" element={<AdminFinancePage />} />
                  <Route path="/admin/finance/payout-runs/:id" element={<PayoutRunDetailPage />} />
                  <Route path="/admin/customers" element={<ComingSoonPage navKey="customers" milestone={4} />} />
                  <Route path="/admin/content" element={<ComingSoonPage navKey="content" milestone={5} />} />
                  <Route path="/admin/audit-log" element={<AuditLogPage />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />
                  <Route element={<RequirePlatformOwner />}>
                    <Route path="/admin/platform-staff" element={<PlatformStaffPage />} />
                  </Route>
                </Route>

                <Route element={<RequireSeller />}>
                  <Route path="/seller" element={<SellerRoute />} />
                  <Route path="/seller/products" element={<ProductsRoute />} />
                  <Route path="/seller/products/import-pos" element={<ImportFromPosRoute />} />
                  <Route path="/seller/products/new" element={<ListingWizardRoute />} />
                  <Route path="/seller/products/:id/edit" element={<ListingWizardRoute />} />
                  <Route path="/seller/orders" element={<OrdersRoute />} />
                  <Route path="/seller/orders/:id" element={<OrderDetailRoute />} />
                  <Route path="/seller/returns" element={<ComingSoonSellerPage navKey="returns" milestone={8} />} />
                  <Route path="/seller/performance" element={<ComingSoonSellerPage navKey="performance" milestone={4} />} />
                  <Route path="/seller/settings" element={<StoreSettingsRoute />} />
                  <Route path="/seller/categories" element={<CategoriesFeesRoute />} />
                  <Route path="/seller/activity" element={<ActivityLogRoute />} />
                  <Route path="/seller/notifications" element={<NotificationsRoute />} />
                  <Route element={<RequireSellerOwner />}>
                    <Route path="/seller/staff" element={<StaffRoute />} />
                    <Route path="/seller/finance" element={<FinanceRoute />} />
                  </Route>
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
