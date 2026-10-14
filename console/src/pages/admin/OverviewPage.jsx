import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Store, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSellers } from '../../api/services';

// Milestone 0's only real admin data source is GET /api/admin/sellers —
// everything shown here is derived from that, nothing fabricated. The
// richer Overview (pending applications, platform staff count, admin
// actions today) described in the parked Seller Admin dashboard work
// needs routes that don't exist yet; this stays within what's real.
export default function OverviewPage() {
  const { t } = useTranslation();
  const [sellers, setSellers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getSellers()
      .then(({ data }) => { if (active) setSellers(data.sellers); })
      .catch(() => toast.error(t('error.generic')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  if (loading) return <div>{t('loading')}</div>;

  const total = sellers?.length || 0;
  const active = sellers?.filter((s) => s.status === 'active').length || 0;
  const suspended = sellers?.filter((s) => s.status === 'suspended').length || 0;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('nav.overview')}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat-card purple">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>
            <Store size={16} /> <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('nav.sellers')}</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{total}</div>
        </div>
        <div className="stat-card green">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>
            <CheckCircle size={16} /> <span style={{ fontSize: '12px', fontWeight: 600 }}>Active</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{active}</div>
        </div>
        <div className="stat-card orange">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>
            <XCircle size={16} /> <span style={{ fontSize: '12px', fontWeight: 600 }}>Suspended</span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{suspended}</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>{t('nav.sellers')}</h2>
        <table className="data-table">
          <thead>
            <tr><th>Store</th><th>Legal name</th><th>BR No.</th><th>Status</th></tr>
          </thead>
          <tbody>
            {sellers?.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                <td>{s.legalName}</td>
                <td>{s.brNumber}</td>
                <td>
                  <span className={`badge ${s.status === 'active' ? 'badge-green' : s.status === 'suspended' ? 'badge-red' : 'badge-yellow'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
