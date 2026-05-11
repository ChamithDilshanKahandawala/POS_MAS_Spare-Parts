import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, X } from 'lucide-react';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/pos': 'POS / Billing',
  '/inventory': 'Inventory',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/sales': 'Sales History',
  '/web-orders': 'Web Orders',
  '/analytics': 'Analytics',
  '/alerts': 'Low Stock Alerts',
  '/users': 'Staff Management',
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {/* ── Desktop Sidebar ── */}
      {!isMobile && (
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      )}

      {/* ── Mobile Overlay ── */}
      {isMobile && mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0,
            zIndex: 60, overflowY: 'auto',
          }}>
            <Sidebar
              collapsed={false}
              setCollapsed={() => {}}
              mobileOpen={mobileOpen}
              setMobileOpen={setMobileOpen}
            />
          </div>
        </>
      )}

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* ── Top Header Bar ── */}
        <header style={{
          height: '56px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '14px',
          flexShrink: 0,
          backdropFilter: 'blur(8px)',
        }}>
          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-primary)', display: 'flex',
                alignItems: 'center', padding: '4px',
              }}
            >
              <Menu size={22} />
            </button>
          )}

          {/* Page title breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
            <Link
              to="/"
              style={{
                fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600,
                textDecoration: 'none', transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--accent-primary)'}
              onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
            >
              MAS POS
            </Link>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/</span>
            <span style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {currentTitle}
            </span>
          </div>

          {/* Right side — clock */}
          {/* <LiveClock /> */}
        </header>

        {/* ── Page Content ── */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--bg-primary)',
          padding: isMobile ? '16px' : '24px 28px',
        }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .sidebar-collapse-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtTime = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const fmtDate = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div style={{ textAlign: 'right', flexShrink: 0 }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{fmtTime}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>{fmtDate}</div>
    </div>
  );
}
