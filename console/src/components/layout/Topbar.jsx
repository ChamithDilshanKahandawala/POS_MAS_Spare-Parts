import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Sun, Moon, LogOut, Menu, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';
import LanguageSwitcher from './LanguageSwitcher';
import NotificationBell from './NotificationBell';

const SELLER_STATUS_BADGE = { in_review: 'badge-yellow', active: 'badge-green', suspended: 'badge-orange', closed: 'badge-red' };

export default function Topbar({ onOpenDrawer, showMenuButton }) {
  const { t } = useTranslation(['common', 'admin', 'seller']);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasBothAreas, sellerMemberships, activeSellerId, activeMembership, setActiveSellerId, isViewAs, viewAsSession, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const inAdminArea = location.pathname.startsWith('/admin');
  const inSellerArea = location.pathname.startsWith('/seller');

  useEffect(() => {
    function onClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    // Sellers is the one place today's search actually filters — route
    // there with the query rather than pretending to search everywhere.
    navigate(`/admin/sellers?search=${encodeURIComponent(search.trim())}`);
  };

  return (
    <header className="console-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {showMenuButton && (
          <button
            className="btn-secondary mobile-menu-button"
            style={{ padding: '8px' }}
            onClick={onOpenDrawer}
            aria-label={t('common:menu')}
          >
            <Menu size={16} />
          </button>
        )}

        {inAdminArea && !isViewAs && (
          <form className="console-search" onSubmit={handleSearchSubmit}>
            <Search size={14} />
            <input
              type="text"
              placeholder={t('admin:topbar.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        )}

        {inSellerArea && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isViewAs ? viewAsSession.sellerName : activeMembership?.sellerName}
            </span>
            {!isViewAs && activeMembership?.sellerStatus && (
              <span className={`badge ${SELLER_STATUS_BADGE[activeMembership.sellerStatus]}`}>
                {t(`seller:storeStatus.${activeMembership.sellerStatus}`)}
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!isViewAs && hasBothAreas && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={inAdminArea ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '7px 14px', fontSize: '12px' }}
              onClick={() => navigate('/admin')}
            >
              {t('common:switcher.adminArea')}
            </button>
            <button
              className={!inAdminArea ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '7px 14px', fontSize: '12px' }}
              onClick={() => navigate('/seller')}
            >
              {t('common:switcher.myStoreArea')}
            </button>
          </div>
        )}

        {!isViewAs && !inAdminArea && sellerMemberships.length > 1 && (
          <select
            className="select-field"
            value={activeSellerId || ''}
            onChange={(e) => setActiveSellerId(e.target.value)}
            style={{ fontSize: '12px', width: 'auto' }}
            aria-label={t('common:switcher.switchStore')}
          >
            {sellerMemberships.map((m) => (
              <option key={m.sellerId} value={m.sellerId}>{m.sellerName}</option>
            ))}
          </select>
        )}

        {!isViewAs && <NotificationBell />}

        <button className="btn-secondary" onClick={toggleTheme} style={{ padding: '7px 10px' }} aria-label="Toggle theme">
          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            className="btn-secondary"
            style={{ padding: '7px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setProfileOpen((v) => !v)}
          >
            <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
            <ChevronDown size={12} />
          </button>
          {profileOpen && (
            <div className="glass-card" style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '220px',
              padding: '14px', zIndex: 60, display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.email}</div>
              <LanguageSwitcher />
              <button className="btn-secondary" onClick={handleLogout} style={{ padding: '8px 10px', fontSize: '12px', justifyContent: 'center' }}>
                <LogOut size={14} /> {t('common:logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
