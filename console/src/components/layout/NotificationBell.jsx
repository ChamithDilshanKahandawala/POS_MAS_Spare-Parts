import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { getNotifications, markNotificationRead } from '../../api/services';
import { useAuth } from '../../context/useAuth';

export default function NotificationBell() {
  const { t, i18n } = useTranslation(['common']);
  const navigate = useNavigate();
  const { isSeller } = useAuth();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  const load = useCallback(() => {
    getNotifications({ limit: 8 })
      .then(({ data }) => { setEntries(data.entries); setUnreadCount(data.unreadCount); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  const handleClick = async (entry) => {
    if (!entry.read) {
      try { await markNotificationRead(entry._id); } catch { /* best-effort */ }
    }
    setOpen(false);
    if (entry.link) navigate(entry.link);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn-secondary"
        style={{ padding: '7px 10px', position: 'relative' }}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('common:topbar.notifications')}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px', minWidth: '16px', height: '16px', padding: '0 3px',
            borderRadius: '8px', background: 'var(--accent-red)', color: '#fff', fontSize: '10px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="glass-card" style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '300px', maxHeight: '360px', overflowY: 'auto',
          padding: '8px', zIndex: 60,
        }}>
          {entries.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>{t('common:topbar.notificationsEmpty')}</div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry._id}
                onClick={() => handleClick(entry)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '10px', borderRadius: '10px',
                  border: 'none', background: entry.read ? 'transparent' : 'var(--accent-glow)', cursor: 'pointer', marginBottom: '4px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{entry.title}</div>
                {entry.body && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{entry.body}</div>}
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{dateFormatter.format(new Date(entry.createdAt))}</div>
              </button>
            ))
          )}
          {isSeller && (
            <button
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '12px', marginTop: '4px' }}
              onClick={() => { setOpen(false); navigate('/seller/notifications'); }}
            >
              {t('common:topbar.viewAllNotifications')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
