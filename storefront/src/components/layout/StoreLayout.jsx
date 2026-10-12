import { useState, lazy, Suspense } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, LogOut, Package, Moon, Sun, ShoppingCart, Menu, X, User, ChevronDown, LayoutGrid, Phone, Truck, Download } from 'lucide-react';
import useInstallPrompt from '../../hooks/useInstallPrompt';
import Footer from './footer';
import Logo from './Logo';
import OfflineBanner from './OfflineBanner';
import LanguageBanner from './LanguageBanner';
import LanguageSwitcher from './LanguageSwitcher';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { slugify } from '../../utils/slugify';
import { CATEGORIES } from '../../config/store';

// framer-motion (the CartDrawer's slide/fade transitions) is ~110 KB on its
// own — StoreLayout is the one component every single route mounts, so an
// eager import here put the whole library in the entry chunk even for a
// visitor who never opens the cart. Lazy-loading it means the very first
// "add to cart" / cart-icon click waits on one small chunk fetch (cached
// after that) instead of nothing — CartDrawer reads isCartOpen fresh off
// CartContext on mount, so it opens correctly whenever it does land.
const CartDrawer = lazy(() => import('../cart/CartDrawer'));

export default function StoreLayout() {
  const { t } = useTranslation('common');
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { cart, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const [categoryDropdown, setCategoryDropdown] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { canInstall, isIOSHint, promptInstall } = useInstallPrompt();

  // Badge "bounce" — a plain CSS keyframe (see the <style> block below)
  // played fresh each time by keying the span on cart.length so React
  // remounts a brand-new element (and the animation naturally restarts)
  // instead of pulling in framer-motion just for this one small pop-in.
  const badgeBumpClass = reducedMotion ? '' : 'mas-badge-bump';

  const handleLogout = () => {
    logout();
    setUserDropdown(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <OfflineBanner />
      <LanguageBanner />

      {/* ── Top announcement bar ── */}
      <div style={{
        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
        color: 'white', textAlign: 'center', padding: '6px 16px',
        fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px',
      }}>
        {t('announcementBar')}
      </div>

      {/* ── Main Navbar ── */}
      <nav style={{ 
        padding: '0 32px', height: '68px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.04)',
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <Logo size={42} style={{
            borderRadius: '10px',
            background: 'white', padding: '2px', objectFit: 'contain',
            border: '2px solid var(--accent-light)', boxSizing: 'border-box',
          }} />
          <div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>MUDIYANSE</div>
            <div style={{ fontSize: '9px', color: 'var(--accent-primary)', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>{t('tagline')}</div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nav Links */}
          {[
            { to: '/', label: t('nav.store'), icon: ShoppingBag },
            ...(user ? [{ to: '/orders', label: t('nav.myOrders'), icon: Package }] : []),
            { to: '/contact', label: t('nav.contact'), icon: Phone },
            { to: '/delivery', label: t('nav.delivery'), icon: Truck },
          ].map(link => {
            const Icon = link.icon;
            const active = isActive(link.to);
            return (
              <Link key={link.to} to={link.to} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                textDecoration: 'none', fontWeight: 600, fontSize: '14px',
                padding: '8px 14px', borderRadius: '10px',
                background: active ? 'var(--accent-light)' : 'transparent',
                transition: 'all 0.2s',
              }}>
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}

          {/* Shop by category */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setCategoryDropdown((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                color: 'var(--text-secondary)', background: 'transparent', border: 'none',
                fontWeight: 600, fontSize: '14px', padding: '8px 14px', borderRadius: '10px',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <LayoutGrid size={16} /> {t('nav.categories')}
              <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: categoryDropdown ? 'rotate(180deg)' : 'rotate(0)' }} />
            </button>
            {categoryDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setCategoryDropdown(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                  background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                  borderRadius: '12px', padding: '6px', minWidth: '200px',
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 100,
                  animation: 'fadeIn 0.15s ease',
                }}>
                  {CATEGORIES.map((c) => (
                    <Link
                      key={c} to={`/category/${slugify(c)}`} onClick={() => setCategoryDropdown(false)}
                      style={{
                        padding: '9px 12px', borderRadius: '8px', textDecoration: 'none',
                        color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
                        transition: 'background 0.15s', whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {c}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Cart Button */}
          <button
            onClick={() => setIsCartOpen(true)}
            style={{
              position: 'relative', padding: '8px 14px', borderRadius: '10px',
              border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px',
              transition: 'all 0.2s',
            }}
          >
            <ShoppingCart size={16} />
            {t('nav.cart')}
            {cart.length > 0 && (
              <span
                key={cart.length}
                className={badgeBumpClass}
                style={{
                  position: 'absolute', top: '-7px', right: '-7px',
                  background: 'var(--accent-primary)', color: 'white',
                  fontSize: '10px', fontWeight: 800, width: '20px', height: '20px',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(230,126,34,0.4)',
                }}
              >
                {cart.length}
              </span>
            )}
          </button>

          <LanguageSwitcher variant="compact" />

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme} 
            style={{
              padding: '8px', borderRadius: '10px', width: '38px', height: '38px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
              cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.2s',
            }}
            title={isDarkMode ? t('nav.switchToLightMode') : t('nav.switchToDarkMode')}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Divider */}
          <div style={{ width: '1px', height: '28px', background: 'var(--border)', margin: '0 4px' }} />

          {/* Auth Section */}
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserDropdown(!userDropdown)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 12px', borderRadius: '10px',
                  background: 'var(--accent-light)', border: '1px solid rgba(230,126,34,0.2)',
                  cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
                }}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '12px', fontWeight: 800,
                }}>
                  {user.name?.charAt(0)?.toUpperCase()}
                </div>
                {user.name?.split(' ')[0]}
                <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: userDropdown ? 'rotate(180deg)' : 'rotate(0)' }} />
              </button>
              {userDropdown && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setUserDropdown(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                    borderRadius: '12px', padding: '6px', minWidth: '180px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 100,
                    animation: 'fadeIn 0.15s ease',
                  }}>
                    <Link to="/orders" onClick={() => setUserDropdown(false)} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 14px', borderRadius: '8px', textDecoration: 'none',
                      color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >
                      <Package size={15} /> {t('nav.myOrders')}
                    </Link>
                    <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 10px' }} />
                    <button onClick={handleLogout} style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      padding: '10px 14px', borderRadius: '8px', background: 'none', border: 'none',
                      color: 'var(--accent-red)', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(231,76,60,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >
                      <LogOut size={15} /> {t('nav.signOut')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link to="/login" style={{
                color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: 600,
                padding: '8px 14px', borderRadius: '10px', transition: 'all 0.2s',
              }}>{t('nav.signIn')}</Link>
              <Link to="/register" className="btn-primary" style={{
                padding: '8px 18px', borderRadius: '10px', textDecoration: 'none', fontSize: '13px',
              }}>{t('nav.getStarted')}</Link>
            </div>
          )}
        </div>

        {/* Mobile: Cart + Menu */}
        <div className="mobile-nav-btns" style={{ display: 'none', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label={t('nav.cart')}
            style={{
              position: 'relative', padding: '8px', borderRadius: '8px',
              border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            <ShoppingCart size={18} />
            {cart.length > 0 && (
              <span
                key={cart.length}
                className={badgeBumpClass}
                style={{
                  position: 'absolute', top: '-5px', right: '-5px',
                  background: 'var(--accent-primary)', color: 'white',
                  fontSize: '9px', fontWeight: 800, width: '17px', height: '17px',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >{cart.length}</span>
            )}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={mobileMenuOpen}
            style={{
              padding: '8px', borderRadius: '8px',
              border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div style={{
          position: 'sticky', top: '68px', zIndex: 99,
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)',
          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          animation: 'fadeIn 0.2s ease',
        }}>
          <Link to="/" onClick={() => setMobileMenuOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '10px',
            color: isActive('/') ? 'var(--accent-primary)' : 'var(--text-secondary)',
            background: isActive('/') ? 'var(--accent-light)' : 'transparent',
            textDecoration: 'none', fontWeight: 600, fontSize: '14px',
          }}><ShoppingBag size={16} /> {t('nav.store')}</Link>
          {user && (
            <Link to="/orders" onClick={() => setMobileMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '10px',
              color: isActive('/orders') ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: isActive('/orders') ? 'var(--accent-light)' : 'transparent',
              textDecoration: 'none', fontWeight: 600, fontSize: '14px',
            }}><Package size={16} /> {t('nav.myOrders')}</Link>
          )}
          <Link to="/contact" onClick={() => setMobileMenuOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '10px',
            color: isActive('/contact') ? 'var(--accent-primary)' : 'var(--text-secondary)',
            background: isActive('/contact') ? 'var(--accent-light)' : 'transparent',
            textDecoration: 'none', fontWeight: 600, fontSize: '14px',
          }}><Phone size={16} /> {t('nav.contact')}</Link>
          <Link to="/delivery" onClick={() => setMobileMenuOpen(false)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '10px',
            color: isActive('/delivery') ? 'var(--accent-primary)' : 'var(--text-secondary)',
            background: isActive('/delivery') ? 'var(--accent-light)' : 'transparent',
            textDecoration: 'none', fontWeight: 600, fontSize: '14px',
          }}><Truck size={16} /> {t('nav.delivery')}</Link>
          <button
            onClick={() => setMobileCategoriesOpen((o) => !o)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
              padding: '12px', borderRadius: '10px', background: 'transparent', border: 'none',
              color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><LayoutGrid size={16} /> {t('nav.shopByCategory')}</span>
            <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: mobileCategoriesOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
          </button>
          {mobileCategoriesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '12px', marginBottom: '4px' }}>
              {CATEGORIES.map((c) => (
                <Link
                  key={c} to={`/category/${slugify(c)}`}
                  onClick={() => { setMobileMenuOpen(false); setMobileCategoriesOpen(false); }}
                  style={{
                    padding: '10px 12px', borderRadius: '8px', textDecoration: 'none',
                    color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500,
                  }}
                >
                  {c}
                </Link>
              ))}
            </div>
          )}
          <div style={{ padding: '8px 12px' }}>
            <LanguageSwitcher variant="full" />
          </div>
          {(canInstall || isIOSHint) && (
            <button
              onClick={canInstall ? promptInstall : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '12px', borderRadius: '10px', background: 'transparent', border: 'none',
                color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px',
                cursor: canInstall ? 'pointer' : 'default', textAlign: 'left',
              }}
            >
              <Download size={16} />
              {canInstall ? t('pwa:installMenuItem') : t('pwa:iosInstallHint')}
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
            <button onClick={toggleTheme} style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-light)',
              background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500,
            }}>
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              {isDarkMode ? t('nav.lightMode') : t('nav.darkMode')}
            </button>
          </div>
          <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />
          {user ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '13px', fontWeight: 800,
                }}>{user.name?.charAt(0)?.toUpperCase()}</div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{user.name?.split(' ')[0]}</span>
              </div>
              <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} style={{
                background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600,
              }}><LogOut size={14} /> {t('nav.logout')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', padding: '8px 12px' }}>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>{t('nav.signIn')}</Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="btn-primary" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>{t('nav.register')}</Link>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
      
      <Footer />

      <Suspense fallback={null}>
        <CartDrawer />
      </Suspense>

      {/* Responsive CSS for nav  */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav-btns { display: flex !important; }
          nav { padding: 0 16px !important; }
          main { padding: 16px !important; }
        }
        @keyframes mas-badge-bump {
          0% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        .mas-badge-bump { animation: mas-badge-bump 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
      `}</style>
    </div>
  );
}
