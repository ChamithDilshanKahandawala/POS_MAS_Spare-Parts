import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Mail, MessageSquare, RotateCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAdminMessages, retryAdminMessage } from '../../api/services';
import EmptyState from '../../components/EmptyState';

const PAGE_SIZE = 25;
const STATUSES = ['pending', 'sending', 'sent', 'failed'];
const CHANNELS = ['email', 'sms'];
const STATUS_BADGE = { pending: 'badge-yellow', sending: 'badge-blue', sent: 'badge-green', failed: 'badge-red' };

// Every outgoing email/SMS: what was sent, to whom (masked), through which
// provider, and why it failed. Failed messages can be queued again; codes
// and links were never stored, so those can't.
export default function MessagesPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const status = searchParams.get('status') || '';
  const channel = searchParams.get('channel') || '';
  const page = Number(searchParams.get('page') || 1);

  const load = useCallback(() => {
    setLoading(true);
    getAdminMessages({ status: status || undefined, channel: channel || undefined, page, limit: PAGE_SIZE })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [status, channel, page, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const retry = async (id) => {
    setRetrying(id);
    try {
      await retryAdminMessage(id);
      toast.success(t('messagesPage.retried'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setRetrying(null);
    }
  };

  const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });
  const pages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '6px' }}>{t('nav.messages', { ns: 'common' })}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('messagesPage.subtitle')}</p>

      {result?.failedCount > 0 && status !== 'failed' && (
        <button className="btn-secondary" style={{ marginBottom: '14px', fontSize: '12.5px' }} onClick={() => updateParam('status', 'failed')}>
          {t('messagesPage.failedBanner', { count: result.failedCount })}
        </button>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select className="input-field" style={{ width: 'auto', maxWidth: '100%' }} value={status} onChange={(e) => updateParam('status', e.target.value)}>
          <option value="">{t('messagesPage.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`messagesPage.status.${s}`)}</option>)}
        </select>
        <select className="input-field" style={{ width: 'auto', maxWidth: '100%' }} value={channel} onChange={(e) => updateParam('channel', e.target.value)}>
          <option value="">{t('messagesPage.allChannels')}</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{t(`messagesPage.channel.${c}`)}</option>)}
        </select>
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : !result || result.messages.length === 0 ? (
        <EmptyState icon={Mail} title={t('messagesPage.empty')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('messagesPage.table.date')}</th>
                <th>{t('messagesPage.table.channel')}</th>
                <th>{t('messagesPage.table.template')}</th>
                <th>{t('messagesPage.table.to')}</th>
                <th>{t('messagesPage.table.status')}</th>
                <th>{t('messagesPage.table.provider')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.messages.map((m) => (
                <Fragment key={m._id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === m._id ? null : m._id)}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatter.format(new Date(m.createdAt))}</td>
                    <td>{m.channel === 'sms' ? <MessageSquare size={14} aria-label="SMS" /> : <Mail size={14} aria-label="Email" />}</td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{m.template} · {m.language}</td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{m.to}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[m.status]}`}>{t(`messagesPage.status.${m.status}`)}</span>
                      {m.attempts > 1 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('messagesPage.attempts', { count: m.attempts })}</div>}
                    </td>
                    <td style={{ fontSize: '11.5px' }}>
                      <div>{m.provider || '—'}</div>
                      {m.providerMessageId && <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{m.providerMessageId}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {m.status === 'failed' && !m.redacted && (
                        <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} disabled={retrying === m._id} onClick={(e) => { e.stopPropagation(); retry(m._id); }}>
                          <RotateCw size={12} /> {t('messagesPage.retry')}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === m._id && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--bg-secondary)', fontSize: '12.5px' }}>
                        {m.lastError && <div style={{ color: 'var(--badge-red-text)', marginBottom: '8px' }}><strong>{t('messagesPage.error')}:</strong> {m.lastError}</div>}
                        {m.subject && <div style={{ fontWeight: 700, marginBottom: '4px' }}>{m.subject}</div>}
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{m.body}</div>
                        {m.redacted && <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('messagesPage.redacted')}</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('messagesPage.pagination', { page, pages })}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" disabled={page <= 1} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page - 1))}><ChevronLeft size={14} /></button>
              <button className="btn-secondary" disabled={page >= pages} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page + 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
