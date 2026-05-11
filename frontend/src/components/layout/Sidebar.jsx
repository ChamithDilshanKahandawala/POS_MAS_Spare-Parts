import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Tooltip, Badge } from 'antd';
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3,
  History, LogOut, AlertTriangle, Users, Truck,
  Sun, Moon, ChevronLeft, ChevronRight, Globe,
  Settings, Menu, MessageCircle
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/pos', icon: ShoppingCart, label: 'POS / Billing' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory', icon: Package, label: 'Inventory' },
      { to: '/alerts', icon: AlertTriangle, label: 'Low Stock', badge: true },
    ],
  },
  {
    label: 'Sales & CRM',
    items: [
      { to: '/customers', icon: Users, label: 'Customers' },
      { to: '/suppliers', icon: Truck, label: 'Suppliers' },
      { to: '/sales', icon: History, label: 'Sales History' },
      { to: '/web-orders', icon: Globe, label: 'Web Orders' },
      { to: '/whatsapp-orders', icon: MessageCircle, label: 'WhatsApp Orders' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
];

const ADMIN_GROUP = {
  label: 'Admin',
  items: [
    { to: '/users', icon: Settings, label: 'Staff Management' },
    { to: '/ecommerce-customers', icon: Globe, label: 'Web Customers' },
  ],
};

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const groups = (user?.role === 'admin' || user?.role === 'super_admin')
    ? [...NAV_GROUPS, ADMIN_GROUP]
    : NAV_GROUPS;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const sidebarWidth = collapsed ? 72 : 240;

  const sidebarContent = (
    <aside
      style={{
        width: `${sidebarWidth}px`,
        height: '100vh',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        padding: collapsed ? '16px 0' : '16px 18px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        minHeight: '70px',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <img
            src="/logo.png"
            alt="MAS"
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              objectFit: 'contain', flexShrink: 0,
              background: 'white', padding: '2px',
              border: '2px solid rgba(220,38,38,0.4)',
            }}
          />
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, whiteSpace: 'nowrap' }}>MUDIYANSE</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Auto Solutions</div>
            </div>
          )}
        </div>

        {/* Collapse toggle — only on desktop */}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="sidebar-collapse-btn"
            title="Collapse sidebar"
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {/* ── Expand button when collapsed ── */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          style={{
            margin: '12px auto 4px',
            width: '36px', height: '36px',
            borderRadius: '10px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
        >
          <ChevronRight size={15} />
        </button>
      )}

      {/* ── Nav Groups ── */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: '6px' }}>
            {!collapsed && (
              <div style={{
                fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '1.2px',
                padding: '10px 10px 4px',
              }}>
                {group.label}
              </div>
            )}
            {group.items.map(({ to, icon: Icon, label, end, badge }) => (
              <Tooltip
                key={to}
                title={collapsed ? label : ''}
                placement="right"
                arrow={false}
                overlayInnerStyle={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '6px 12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              >
                <NavLink
                  to={to}
                  end={end}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: collapsed ? '10px 0' : '9px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(139,92,246,0.85))'
                      : 'transparent',
                    transition: 'all 0.18s ease',
                    marginBottom: '2px',
                    position: 'relative',
                    boxShadow: isActive ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  })}
                  className="sidebar-nav-link"
                >
                  {({ isActive }) => (
                    <>
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <Icon size={17} />
                      </span>
                      {!collapsed && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
                      {!collapsed && badge && (
                        <span style={{
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: '#ef4444', flexShrink: 0,
                          boxShadow: '0 0 6px rgba(239,68,68,0.6)',
                        }} />
                      )}
                    </>
                  )}
                </NavLink>
              </Tooltip>
            ))}
          </div>
        ))}
      </nav>

      {/* ── User / Footer ── */}
      <div style={{
        padding: collapsed ? '12px 8px' : '14px',
        borderTop: '1px solid var(--border-light)',
      }}>
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 12px', borderRadius: '12px',
            background: 'var(--bg-card)', marginBottom: '10px',
            border: '1px solid var(--border-light)',
          }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
              background: (user?.role === 'admin' || user?.role === 'super_admin')
                ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: 'white',
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{
                fontSize: '10px',
                color: (user?.role === 'admin' || user?.role === 'super_admin') ? '#ef4444' : 'var(--text-muted)',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                {user?.role}
              </div>
            </div>
          </div>
        )}

        {/* Collapsed: avatar only */}
        {collapsed && (
          <Tooltip title={`${user?.name} (${user?.role})`} placement="right">
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: (user?.role === 'admin' || user?.role === 'super_admin')
                ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: 'white',
              margin: '0 auto 10px',
              cursor: 'default',
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </Tooltip>
        )}

        <div style={{ display: 'flex', gap: '6px', justifyContent: collapsed ? 'center' : 'stretch', flexDirection: collapsed ? 'column' : 'row', alignItems: 'center' }}>
          <Tooltip title={theme === 'dark' ? 'Light mode' : 'Dark mode'} placement="right">
            <button
              onClick={toggleTheme}
              className="btn-secondary"
              style={{ flex: collapsed ? 'none' : 1, justifyContent: 'center', padding: '8px', width: collapsed ? '36px' : 'auto', height: collapsed ? '36px' : 'auto' }}
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </Tooltip>
          <Tooltip title="Logout" placement="right">
            <button
              onClick={handleLogout}
              className="btn-secondary"
              style={{
                flex: collapsed ? 'none' : 3, justifyContent: 'center', padding: '8px',
                color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.3)',
                width: collapsed ? '36px' : 'auto', height: collapsed ? '36px' : 'auto',
              }}
            >
              <LogOut size={15} />
              {!collapsed && 'Logout'}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Sidebar extra CSS */}
      <style>{`
        .sidebar-nav-link:hover {
          background: var(--bg-card) !important;
          color: var(--text-primary) !important;
        }
        .sidebar-collapse-btn {
          width: 28px; height: 28px; border-radius: 8px;
          background: var(--bg-card); border: 1px solid var(--border-light);
          color: var(--text-muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.2s;
        }
        .sidebar-collapse-btn:hover { color: var(--accent-primary); border-color: var(--accent-primary); }
      `}</style>
    </aside>
  );

  return sidebarContent;
}