import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, LogOut, Package, Moon, Sun, ShoppingCart, Menu, X, User, ChevronDown } from 'lucide-react';
import Footer from './footer';

export default function StoreLayout() {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { cart, setIsCartOpen } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    setUserDropdown(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* ── Top announcement bar ── */}
      <div style={{
        background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
        color: 'white', textAlign: 'center', padding: '6px 16px',
        fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px',
      }}>
        🚚 Free Island-wide Delivery on Orders Above Rs. 5,000 · 100% Genuine Parts Guaranteed
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
          <img src="/logo.png" alt="Logo" style={{
            width: '42px', height: '42px', borderRadius: '10px',
            background: 'white', padding: '2px', objectFit: 'contain',
            border: '2px solid var(--accent-light)',
          }} />
          <div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>MUDIYANSE</div>
            <div style={{ fontSize: '9px', color: 'var(--accent-primary)', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>Auto Solutions</div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nav Links */}
          {[
            { to: '/', label: 'Store', icon: ShoppingBag },
            ...(user ? [{ to: '/orders', label: 'My Orders', icon: Package }] : []),
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
            Cart
            {cart.length > 0 && (
              <span style={{
                position: 'absolute', top: '-7px', right: '-7px',
                background: 'var(--accent-primary)', color: 'white',
                fontSize: '10px', fontWeight: 800, width: '20px', height: '20px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(230,126,34,0.4)',
              }}>
                {cart.length}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme} 
            style={{
              padding: '8px', borderRadius: '10px', width: '38px', height: '38px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
              cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.2s',
            }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
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
                      <Package size={15} /> My Orders
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
                      <LogOut size={15} /> Sign Out
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
              }}>Sign In</Link>
              <Link to="/register" className="btn-primary" style={{
                padding: '8px 18px', borderRadius: '10px', textDecoration: 'none', fontSize: '13px',
              }}>Get Started</Link>
            </div>
          )}
        </div>

        {/* Mobile: Cart + Menu */}
        <div className="mobile-nav-btns" style={{ display: 'none', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsCartOpen(true)}
            style={{
              position: 'relative', padding: '8px', borderRadius: '8px',
              border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            <ShoppingCart size={18} />
            {cart.length > 0 && (
              <span style={{
                position: 'absolute', top: '-5px', right: '-5px',
                background: 'var(--accent-primary)', color: 'white',
                fontSize: '9px', fontWeight: 800, width: '17px', height: '17px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{cart.length}</span>
            )}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
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
          }}><ShoppingBag size={16} /> Store</Link>
          {user && (
            <Link to="/orders" onClick={() => setMobileMenuOpen(false)} style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '10px',
              color: isActive('/orders') ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: isActive('/orders') ? 'var(--accent-light)' : 'transparent',
              textDecoration: 'none', fontWeight: 600, fontSize: '14px',
            }}><Package size={16} /> My Orders</Link>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
            <button onClick={toggleTheme} style={{
              padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-light)',
              background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500,
            }}>
              {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
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
              }}><LogOut size={14} /> Logout</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', padding: '8px 12px' }}>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>Sign In</Link>
              <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="btn-primary" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>Register</Link>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, padding: '32px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        <Outlet />
      </main>
      
      <Footer />

      {/* Responsive CSS for nav  */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav-btns { display: flex !important; }
          nav { padding: 0 16px !important; }
          main { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
