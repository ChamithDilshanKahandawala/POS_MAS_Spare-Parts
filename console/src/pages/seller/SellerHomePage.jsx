import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Store, BadgeCheck } from 'lucide-react';
import { getMyStore } from '../../api/services';

// Remounted with key={activeSellerId} by its route in App.jsx when the
// switcher changes stores (same pattern as the storefront's
// ProductDetailRoute/CategoryRoute) — loading's own initial value is
// already fresh on every store change, so the effect just needs "fetch,
// then setState from the result", no synchronous reset.
export default function SellerHomePage() {
  const { t } = useTranslation();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMyStore()
      .then(({ data }) => { if (active) setStore(data); })
      .catch(() => toast.error(t('error.generic')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  if (loading) return <div>{t('loading')}</div>;
  if (!store) return <div>{t('error.generic')}</div>;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('nav.myStore')}</h1>

      <div className="glass-card" style={{ padding: '24px', maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Store size={20} color="var(--accent-primary)" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px' }}>{store.seller.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{store.seller.legalName}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <span className={`badge ${store.seller.status === 'active' ? 'badge-green' : 'badge-red'}`}>{store.seller.status}</span>
          <span className="badge badge-blue"><BadgeCheck size={11} /> {store.myRole}</span>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          <div>BR No.: {store.seller.brNumber}</div>
        </div>
      </div>
    </div>
  );
}
