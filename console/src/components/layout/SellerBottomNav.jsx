import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { SELLER_NAV_ITEMS } from './sellerNavConfig';

// Mobile-only (hidden on desktop via CSS, see index.css's
// .seller-bottom-nav media query) — "Home, Products, Orders, Finance,
// More" per the spec, with More opening a sheet for everything else
// (Returns, Performance, Store settings, Staff, Activity log,
// Notifications), same bottom-sheet visual as the admin drawer.
export default function SellerBottomNav() {
  const { t } = useTranslation(['seller', 'common']);
  const { isActiveSellerOwner } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const visible = SELLER_NAV_ITEMS.filter((item) => !item.ownerOnly || isActiveSellerOwner);
  const primary = visible.filter((item) => item.primary);
  const overflow = visible.filter((item) => !item.primary);
  const overflowActive = overflow.some((item) => location.pathname === item.path);

  return (
    <>
      <nav className="seller-bottom-nav">
        {primary.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/seller'}
              className={({ isActive }) => `seller-bottom-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={20} />
              <span>{t(`seller:nav.${item.key}`)}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          className={`seller-bottom-nav-item${overflowActive ? ' active' : ''}`}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal size={20} />
          <span>{t('common:more')}</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="modal-overlay" style={{ alignItems: 'flex-end' }} onClick={() => setMoreOpen(false)}>
          <div className="console-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px 10px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>{t('common:more')}</span>
              <button className="btn-secondary" style={{ padding: '6px' }} onClick={() => setMoreOpen(false)} aria-label={t('common:cancel')}>
                <X size={14} />
              </button>
            </div>
            {overflow.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={({ isActive }) => `console-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setMoreOpen(false)}
                >
                  <Icon size={16} />
                  <span>{t(`seller:nav.${item.key}`)}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
