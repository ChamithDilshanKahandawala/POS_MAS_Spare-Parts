import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { getAuditLog, getAuditLogCsvBlob } from '../../api/services';
import EmptyState from '../../components/EmptyState';

export default function AuditLogPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', targetType: '', from: '', to: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    getAuditLog({ ...params, limit: 50 })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [filters, t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // this is the same legitimate case: fetch once on mount/filter-change,
  // not a render-triggered setState cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dateTimeFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });

  const handleExport = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await getAuditLogCsvBlob(params);
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-log.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error(t('common:error.generic'));
    }
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title">{t('auditLog.title')}</h1>
        <button className="btn-secondary" onClick={handleExport}><Download size={14} /> {t('auditLog.export')}</button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          className="input-field" style={{ width: 'auto' }} placeholder={t('auditLog.filters.action')}
          value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
        />
        <input
          className="input-field" style={{ width: 'auto' }} placeholder={t('auditLog.filters.targetType')}
          value={filters.targetType} onChange={(e) => setFilters((f) => ({ ...f, targetType: e.target.value }))}
        />
        <input
          type="date" className="input-field" style={{ width: 'auto' }}
          value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
        />
        <input
          type="date" className="input-field" style={{ width: 'auto' }}
          value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
        />
        {(filters.action || filters.targetType || filters.from || filters.to) && (
          <button className="btn-secondary" onClick={() => setFilters({ action: '', targetType: '', from: '', to: '' })}>
            {t('auditLog.filters.clear')}
          </button>
        )}
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.entries.length === 0 ? (
        <EmptyState title={t('auditLog.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('auditLog.table.time')}</th>
                <th>{t('auditLog.table.actor')}</th>
                <th>{t('auditLog.table.role')}</th>
                <th>{t('auditLog.table.action')}</th>
                <th>{t('auditLog.table.target')}</th>
                <th>{t('auditLog.table.summary')}</th>
              </tr>
            </thead>
            <tbody>
              {result.entries.map((entry) => (
                <tr key={entry._id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dateTimeFormatter.format(new Date(entry.createdAt))}</td>
                  <td>{entry.actor?.name || entry.actor?.email || '—'}</td>
                  <td>{entry.actorRole}</td>
                  <td>{entry.action}</td>
                  <td>{entry.targetType}</td>
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
