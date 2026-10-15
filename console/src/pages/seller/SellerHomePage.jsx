import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle, Circle, Lock, ShoppingCart, Wallet } from 'lucide-react';
import { getMyStoreHome } from '../../api/services';

export default function SellerHomePage() {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getMyStoreHome()
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // a legitimate fetch-on-mount case, not a render-triggered cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) return <div>{t('common:loading')}</div>;
  if (!data) return <div>{t('common:error.generic')}</div>;

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' });
  const { checklist } = data;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '6px' }}>{t('seller:home.title')}</h1>
      {data.seller.probationUntil && (
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {t('seller:home.probationUntil', { date: dateFormatter.format(new Date(data.seller.probationUntil)) })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card blue">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>
            <ShoppingCart size={16} /> <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('seller:home.ordersToday')}</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{data.ordersToday ?? '—'}</div>
        </div>
        <div className="stat-card blue">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>
            <Wallet size={16} /> <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('seller:home.pendingPayout')}</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{data.pendingPayout ?? '—'}</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '20px', maxWidth: '520px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700 }}>{t('seller:home.checklistTitle')}</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('seller:home.checklistProgress', { completed: checklist.completed, total: checklist.total })}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {checklist.items.map((item) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: item.available ? 1 : 0.5 }}>
              {!item.available ? <Lock size={16} color="var(--text-muted)" />
                : item.done ? <CheckCircle size={16} color="var(--accent-green)" />
                  : <Circle size={16} color="var(--text-muted)" />}
              <span style={{ fontSize: '13px' }}>{t(`seller:home.checklistItems.${item.key}`)}</span>
              {!item.available && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {t('seller:home.noDataYet', { milestone: 3 })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
