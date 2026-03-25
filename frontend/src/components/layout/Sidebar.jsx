import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3,
  History, LogOut, AlertTriangle, Users, Truck, Sun, Moon
} from 'lucide-react';

export default function Sidebar() {
  const { user, logout } = useAuth(); 
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // 1. Base nav items (Staff and Admin both can see)
  const navItems = [
    { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/pos',       icon: ShoppingCart,    label: 'POS / Billing' },
    { to: '/inventory', icon: Package,         label: 'Inventory' },
    { to: '/customers', icon: Users,           label: 'Customers' },
    { to: '/suppliers', icon: Truck,           label: 'Suppliers' },
    { to: '/sales',     icon: History,         label: 'Sales History' },
    { to: '/web-orders',icon: Package,         label: 'Web Orders' },
    { to: '/analytics', icon: BarChart3,       label: 'Analytics' },
    { to: '/alerts',    icon: AlertTriangle,   label: 'Low Stock' },
  ];

  // 2. Admin unoth vitharak "Staff Management" add karanna
  if (user?.role === 'admin') {
    navItems.push({ to: '/users', icon: Users, label: 'Staff Management' }); 
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{
      width: '240px', minHeight: '100vh', flexShrink: 0,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-light)',
      display: 'flex', flexDirection: 'column',
      padding: '0',
    }}>
      {/* Logo Section */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', gap: '10px'
      }}>
        <img
          src="/logo.png"
          alt="Mudiyanse Auto Solutions"
          style={{
            width: '48px', height: '48px', borderRadius: '50%',
            objectFit: 'contain', flexShrink: 0,
            background: 'white', padding: '2px',
            border: '2px solid rgba(220,38,38,0.4)',
          }}
        />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>MUDIYANSE</div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase' }}>Auto Solutions</div>
        </div>
      </div>

      {/* Nav Section - Filtered Items */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '10px',
              fontSize: '14px', fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? 'white' : 'var(--text-secondary)',
              background: isActive
                ? 'linear-gradient(135deg, rgba(99,102,241,0.8), rgba(139,92,246,0.8))'
                : 'transparent',
              transition: 'all 0.2s ease',
            })}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User Section */}
      <div style={{
        padding: '16px', borderTop: '1px solid var(--border-light)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px', borderRadius: '10px',
          background: 'var(--bg-card)', marginBottom: '8px'
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: user?.role === 'admin' ? 'linear-gradient(135deg, #ef4444, #b91c1c)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ 
              fontSize: '10px', 
              color: user?.role === 'admin' ? '#ef4444' : 'var(--text-muted)', 
              fontWeight: user?.role === 'admin' ? 700 : 400,
              textTransform: 'uppercase', 
              letterSpacing: '0.5px' 
            }}>{user?.role}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={toggleTheme} className="btn-secondary"
            style={{ flex: 1, justifyContent: 'center', padding: '8px' }}
            title="Toggle Theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button onClick={handleLogout} className="btn-secondary"
            style={{ flex: 3, justifyContent: 'center', padding: '8px' }}>
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}