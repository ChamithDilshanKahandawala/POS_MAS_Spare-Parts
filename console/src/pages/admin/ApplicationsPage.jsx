import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApplications } from '../../api/services';
import EmptyState from '../../components/EmptyState';

const STATUS_TABS = ['new', 'info_requested', 'approved', 'rejected'];
const STATUS_BADGE = { new: 'badge-blue', info_requested: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' };

export default function ApplicationsPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const status = searchParams.get('status') || 'new';

  const load = useCallback(() => {
    setLoading(true);
    getApplications({ status, limit: 50 })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [status, t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // this is the same legitimate case: fetch once on mount/filter-change,
  // not a render-triggered setState cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('applications.title')}</h1>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            className={status === s ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 14px', fontSize: '12px' }}
            onClick={() => setSearchParams({ status: s })}
          >
            {t(`applications.status.${s}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.applications.length === 0 ? (
        <EmptyState title={t('applications.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('applications.table.store')}</th>
                <th>{t('applications.table.owner')}</th>
                <th>{t('applications.table.district')}</th>
                <th>{t('applications.table.submitted')}</th>
                <th>{t('applications.table.status')}</th>
              </tr>
            </thead>
            <tbody>
              {result.applications.map((app) => (
                <tr key={app._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/applications/${app._id}`)}>
                  <td>{app.storeName}</td>
                  <td>{app.ownerName}</td>
                  <td>{app.district}</td>
                  <td>{dateFormatter.format(new Date(app.createdAt))}</td>
                  <td><span className={`badge ${STATUS_BADGE[app.status]}`}>{t(`applications.status.${app.status}`)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
