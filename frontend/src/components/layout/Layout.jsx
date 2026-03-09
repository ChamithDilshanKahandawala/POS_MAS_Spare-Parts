import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1, overflowY: 'auto',
        background: 'var(--bg-primary)',
        padding: '28px',
      }}>
        <Outlet />
      </main>
    </div>
  );
}
