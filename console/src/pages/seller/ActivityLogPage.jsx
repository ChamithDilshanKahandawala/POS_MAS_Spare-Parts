import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getMyActivity } from '../../api/services';
import EmptyState from '../../components/EmptyState';

export default function ActivityLogPage() {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: '', to: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    getMyActivity({ ...params, limit: 50 })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [filters, t]);

  // load (useCallback) sets state internally — legitimate fetch-on-mount/filter-change.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dateTimeFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('activity.title')}</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input type="date" className="input-field" style={{ width: 'auto' }} value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        <input type="date" className="input-field" style={{ width: 'auto' }} value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        {(filters.from || filters.to) && (
          <button className="btn-secondary" onClick={() => setFilters({ from: '', to: '' })}>{t('activity.filters.clear')}</button>
        )}
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.entries.length === 0 ? (
        <EmptyState title={t('activity.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('activity.table.time')}</th>
                <th>{t('activity.table.actor')}</th>
                <th>{t('activity.table.role')}</th>
                <th>{t('activity.table.action')}</th>
                <th>{t('activity.table.summary')}</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <tr key={entry._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dateTimeFormatter.format(new Date(entry.createdAt))}</td>
                  <td>{entry.actor?.name || entry.actor?.email || '—'}</td>
                  <td>{entry.actorRole}</td>
                  <td>{entry.action}</td>
                  <td>{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
