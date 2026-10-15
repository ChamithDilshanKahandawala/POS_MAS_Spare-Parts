import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../api/services';
import EmptyState from '../../components/EmptyState';

export default function NotificationsPage() {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getNotifications({ limit: 50 })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // load (useCallback) sets state internally — legitimate fetch-on-mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  const handleClick = async (entry) => {
    if (!entry.read) {
      await markNotificationRead(entry._id).catch(() => {});
      load();
    }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead().catch(() => toast.error(t('common:error.generic')));
    load();
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!result) return <div>{t('common:error.generic')}</div>;

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title">{t('notifications.title')}</h1>
        {result.unreadCount > 0 && (
          <button className="btn-secondary" onClick={handleMarkAll}>{t('notifications.markAllRead')}</button>
        )}
      </div>

      {result.entries.length === 0 ? (
        <EmptyState title={t('notifications.noNotifications')} />
      ) : (
        <div className="glass-card" style={{ padding: '10px' }}>
          {result.entries.map((entry) => (
            <button
              key={entry._id}
              onClick={() => handleClick(entry)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '14px', borderRadius: '12px',
                border: 'none', background: entry.read ? 'transparent' : 'var(--accent-glow)', cursor: 'pointer', marginBottom: '4px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{entry.title}</div>
              {entry.body && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{entry.body}</div>}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{dateFormatter.format(new Date(entry.createdAt))}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
