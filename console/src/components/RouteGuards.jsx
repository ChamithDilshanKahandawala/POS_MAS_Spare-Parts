import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTranslation } from 'react-i18next';

// Convenience only, as the task spec says — every one of these checks is
// re-done for real by the backend (requireAuth/requirePlatform/
// requireSellerMember) on every request. This just avoids flashing admin
// UI at someone who's about to get a 403 from the API a moment later.

export function RequireAuth() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>{t('loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequirePlatform() {
  const { isPlatform } = useAuth();
  if (!isPlatform) return <Navigate to="/seller" replace />;
  return <Outlet />;
}

export function RequirePlatformOwner() {
  const { isPlatformOwner } = useAuth();
  if (!isPlatformOwner) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

export function RequireSeller() {
  // A "view as seller" session grants read-only access to the seller
  // area without the admin needing a real SellerMember row of their own
  // — see context/AuthContext.jsx's startViewAs.
  const { isSeller, isViewAs } = useAuth();
  if (!isSeller && !isViewAs) return <Navigate to="/admin" replace />;
  return <Outlet />;
}

export function RequireSellerOwner() {
  // isActiveSellerOwner is true for a real seller_owner membership on the
  // active store OR a view-as session (the backend's synthetic
  // owner-level read access) — see context/AuthContext.jsx.
  const { isActiveSellerOwner } = useAuth();
  if (!isActiveSellerOwner) return <Navigate to="/seller" replace />;
  return <Outlet />;
}
