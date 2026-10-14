import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useTheme } from '../../context/useTheme';

// Milestone 0's layout is intentionally just this: one page per area
// (Overview, Seller Home) and the Admin <-> My Store switcher — there's
// no multi-item sidebar yet because there's nothing else built to link
// to. The parked Seller Admin dashboard work (Milestone 1A) is where the
// full sidebar (Sellers, Applications, Catalog, Orders, ...) belongs;
// building it now would just be dead links to routes that don't exist.
export default function ConsoleLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasBothAreas, sellerMemberships, activeSellerId, setActiveSellerId, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  const inAdminArea = location.pathname.startsWith('/admin');

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)',
      }}>
        <span className="page-title" style={{ fontSize: '18px' }}>{t('appName')}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasBothAreas && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={inAdminArea ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '7px 14px', fontSize: '12px' }}
                onClick={() => navigate('/admin')}
              >
                {t('switcher.adminArea')}
              </button>
              <button
                className={!inAdminArea ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '7px 14px', fontSize: '12px' }}
                onClick={() => navigate('/seller')}
              >
                {t('switcher.myStoreArea')}
              </button>
            </div>
          )}

          {!inAdminArea && sellerMemberships.length > 1 && (
            <select
              className="select-field"
              value={activeSellerId || ''}
              onChange={(e) => setActiveSellerId(e.target.value)}
              style={{ fontSize: '12px', width: 'auto' }}
            >
              {sellerMemberships.map((m) => (
                <option key={m.sellerId} value={m.sellerId}>{m.sellerName}</option>
              ))}
            </select>
          )}

          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user?.name}</span>
          <button className="btn-secondary" onClick={toggleTheme} style={{ padding: '7px 10px' }} aria-label="Toggle theme">
            {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button className="btn-secondary" onClick={handleLogout} style={{ padding: '7px 10px', fontSize: '12px' }}>
            <LogOut size={14} /> {t('logout')}
          </button>
        </div>
      </header>

      <main style={{ padding: '28px' }}>
        <Outlet />
      </main>
    </div>
  );
}
