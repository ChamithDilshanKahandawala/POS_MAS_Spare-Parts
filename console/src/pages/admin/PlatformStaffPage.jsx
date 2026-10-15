import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { getPlatformStaff, invitePlatformStaff, removePlatformStaff } from '../../api/services';
import { useAuth } from '../../context/useAuth';
import EmptyState from '../../components/EmptyState';

export default function PlatformStaffPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getPlatformStaff()
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // load (useCallback) sets state internally, so the static analysis
  // flags this the same way as AuthContext.jsx's session-restore effect —
  // this is the same legitimate case: fetch once on mount/filter-change,
  // not a render-triggered setState cascade.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  const submitInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await invitePlatformStaff(inviteEmail.trim());
      toast.success(t('platformStaff.inviteSent'));
      setInviteOpen(false);
      setInviteEmail('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const confirmRemove = async () => {
    try {
      await removePlatformStaff(removeTarget._id);
      toast.success(t('platformStaff.removed'));
      setRemoveTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  if (loading) return <div>{t('common:loading')}</div>;
  if (!data) return <div>{t('common:error.generic')}</div>;

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title">{t('platformStaff.title')}</h1>
        <button className="btn-primary" onClick={() => setInviteOpen(true)}><UserPlus size={14} /> {t('platformStaff.inviteButton')}</button>
      </div>

      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('platformStaff.table.name')}</th>
              <th>{t('platformStaff.table.email')}</th>
              <th>{t('platformStaff.table.role')}</th>
              <th>{t('platformStaff.table.joined')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.staff.map((member) => {
              const isSelf = member._id === user?.id;
              const isOwner = member.platformRole === 'platform_owner';
              return (
                <tr key={member._id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td><span className="badge badge-blue">{t(`platformStaff.role.${member.platformRole}`)}</span></td>
                  <td>{dateFormatter.format(new Date(member.createdAt))}</td>
                  <td style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {!isOwner && !isSelf && (
                      <button className="btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => setRemoveTarget(member)}>
                        {t('platformStaff.remove')}
                      </button>
                    )}
                    {isSelf && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('platformStaff.cannotChangeSelf')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>{t('platformStaff.pendingInvites')}</h2>
        {data.pendingInvites.length === 0 ? (
          <EmptyState title={t('platformStaff.noPendingInvites')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.pendingInvites.map((inv) => (
              <div key={inv._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>{inv.email}</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('platformStaff.expiresAt', { date: dateFormatter.format(new Date(inv.expiresAt)) })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {inviteOpen && (
        <div className="modal-overlay" onClick={() => setInviteOpen(false)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('platformStaff.inviteButton')}</h3>
            <input
              type="email" className="input-field" style={{ width: '100%', marginBottom: '16px' }}
              placeholder={t('platformStaff.invitePlaceholder')}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setInviteOpen(false)}>{t('common:cancel')}</button>
              <button className="btn-primary" disabled={!inviteEmail.trim()} onClick={submitInvite}>{t('common:save')}</button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="modal-overlay" onClick={() => setRemoveTarget(null)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ marginBottom: '16px' }}>{t('platformStaff.removeConfirm', { name: removeTarget.name })}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setRemoveTarget(null)}>{t('common:cancel')}</button>
              <button className="btn-danger" onClick={confirmRemove}>{t('platformStaff.remove')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
