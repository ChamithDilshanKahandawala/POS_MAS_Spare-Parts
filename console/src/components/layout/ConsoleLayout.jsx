import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import SidebarNav from './SidebarNav';
import SellerSidebarNav from './SellerSidebarNav';
import SellerBottomNav from './SellerBottomNav';
import Topbar from './Topbar';

export default function ConsoleLayout() {
  const { t } = useTranslation(['common', 'seller']);
  const navigate = useNavigate();
  const location = useLocation();
  const { isPlatform, isSeller, isViewAs, viewAsSession, activeMembership, stopViewAs } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const inSellerArea = location.pathname.startsWith('/seller');
  const showAdminSidebar = isPlatform && !isViewAs && !inSellerArea;
  const showSellerSidebar = (isSeller || isViewAs) && inSellerArea;

  // Not shown during view-as — an admin browsing a suspended seller
  // already knows that from the Seller detail page they came from, and
  // every write is already blocked for them regardless (read-only token).
  const suspendedOrClosed = !isViewAs && inSellerArea && ['suspended', 'closed'].includes(activeMembership?.sellerStatus);

  const handleExitViewAs = () => {
    stopViewAs();
    navigate('/admin/sellers');
  };

  return (
    // Design refresh — a pure CSS hook, nothing behavioural: lets
    // index.css give the admin topbar a slightly different accent so it's
    // always visually obvious which hat is on (console/src/index.css's
    // .area-admin .console-topbar rule), without a prop threading through
    // Topbar.jsx or anywhere else.
    <div className={`console-shell ${inSellerArea ? 'area-seller' : 'area-admin'}`}>
      {showAdminSidebar && (
        <aside className="console-sidebar">
          <div className="console-sidebar-brand page-title">{t('common:appName')}</div>
          <SidebarNav />
        </aside>
      )}
      {showSellerSidebar && (
        <aside className="console-sidebar">
          <div className="console-sidebar-brand page-title">{t('common:appName')}</div>
          <SellerSidebarNav />
        </aside>
      )}

      <div className="console-main-col">
        <Topbar onOpenDrawer={() => setDrawerOpen(true)} showMenuButton={showAdminSidebar} />

        {isViewAs && (
          <div className="view-as-banner">
            <span>{t('admin:viewAs.banner', { seller: viewAsSession.sellerName })}</span>
            <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={handleExitViewAs}>
              {t('admin:viewAs.exit')}
            </button>
          </div>
        )}

        {suspendedOrClosed && (
          <div className="store-status-banner">
            <span>
              <AlertTriangle size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />
              <strong>{t(`seller:storeStatus.${activeMembership.sellerStatus}Title`)}</strong> — {t('seller:storeStatus.contactSupport')}
            </span>
          </div>
        )}

        <main className={`console-main${inSellerArea ? ' seller-area-main' : ''}`}>
          <Outlet />
        </main>
      </div>

      {inSellerArea && (isSeller || isViewAs) && <SellerBottomNav />}

      {showAdminSidebar && drawerOpen && (
        <div className="modal-overlay" style={{ alignItems: 'flex-end' }} onClick={() => setDrawerOpen(false)}>
          <div className="console-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px 10px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('common:menu')}</span>
              <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setDrawerOpen(false)} aria-label={t('common:cancel')}>
                <X size={14} />
              </button>
            </div>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
