import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Store, Clock, XCircle, UserCog, Activity, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOverview } from '../../api/services';
import EmptyState from '../../components/EmptyState';

function StatCard({ icon: Icon, color, label, value }) {
  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', color: 'var(--text-muted)' }}>
        {Icon && <Icon size={16} />} <span style={{ fontSize: '12px', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 800 }}>{value ?? '—'}</div>
    </div>
  );
}

export default function OverviewPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getOverview()
      .then(({ data: d }) => { if (active) setData(d); })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  if (loading) return <div>{t('common:loading')}</div>;
  if (!data) return <div>{t('common:error.generic')}</div>;

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('common:nav.overview')}</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <StatCard icon={Store} color="green" label={t('overview.activeSellers')} value={data.activeSellers} />
        <StatCard icon={Clock} color="yellow" label={t('overview.pendingSellers')} value={data.pendingSellers} />
        <StatCard icon={XCircle} color="orange" label={t('overview.suspendedSellers')} value={data.suspendedSellers} />
        <StatCard icon={UserCog} color="purple" label={t('overview.platformStaffCount')} value={data.platformStaffCount} />
        <StatCard icon={Activity} color="blue" label={t('overview.adminActionsToday')} value={data.adminActionsToday} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <StatCard icon={Activity} color="blue" label={t('overview.ordersTotal')} value={data.ordersTotal} />
        <StatCard icon={Activity} color="blue" label={t('overview.salesTotal')} value={data.salesTotal} />
        <StatCard icon={Activity} color="blue" label={t('overview.commissionTotal')} value={data.commissionTotal} />
      </div>

      {data.zeroCommissionCategories > 0 && (
        <Link
          to="/admin/catalog"
          className="glass-card"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', marginBottom: '20px', textDecoration: 'none', color: 'var(--accent-primary-text)', fontWeight: 600, fontSize: '13px' }}
        >
          <AlertTriangle size={16} />
          {t('overview.zeroCommissionWarning', { count: data.zeroCommissionCategories })}
        </Link>
      )}

      <div className="glass-card" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>{t('overview.needsAttention')}</h2>
        {data.needsAttention.length === 0 ? (
          <EmptyState title={t('overview.noApplicationsPending')} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('applications.table.store')}</th>
                <th>{t('applications.table.status')}</th>
                <th>{t('applications.table.submitted')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.needsAttention.map((app) => (
                <tr key={app._id}>
                  <td>{app.storeName}</td>
                  <td><span className="badge badge-yellow">{t(`applications.status.${app.status}`)}</span></td>
                  <td>{dateFormatter.format(new Date(app.createdAt))}</td>
                  <td>
                    <Link className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} to={`/admin/applications/${app._id}`}>
                      {t('overview.viewApplication')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
