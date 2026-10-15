import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { getMyStaff, inviteMyStaff, removeMyStaff } from '../../api/services';
import { useAuth } from '../../context/useAuth';
import EmptyState from '../../components/EmptyState';

export default function StaffPage() {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getMyStaff()
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // load (useCallback) sets state internally — legitimate fetch-on-mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  const submitInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await inviteMyStaff(inviteEmail.trim());
      toast.success(t('staff.inviteSent'));
      setInviteOpen(false);
      setInviteEmail('');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const confirmRemove = async () => {
    try {
      await removeMyStaff(removeTarget._id);
      toast.success(t('staff.removed'));
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
        <h1 className="page-title">{t('staff.title')}</h1>
        <button className="btn-primary" onClick={() => setInviteOpen(true)}><UserPlus size={14} /> {t('staff.inviteButton')}</button>
      </div>

      <div className="glass-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('staff.table.name')}</th>
              <th>{t('staff.table.email')}</th>
              <th>{t('staff.table.role')}</th>
              <th>{t('staff.table.joined')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.members.map((member) => {
              const isSelf = member.user?._id === user?.id;
              const isOwnerRow = member.role === 'seller_owner';
              return (
                <tr key={member._id}>
                  <td>{member.user?.name}</td>
                  <td>{member.user?.email}</td>
                  <td><span className="badge badge-blue">{isOwnerRow ? t('staff.ownerLabel') : t('staff.roleLabel')}</span></td>
                  <td>{dateFormatter.format(new Date(member.createdAt))}</td>
                  <td style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {!isOwnerRow && !isSelf && (
                      <button className="btn-danger" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => setRemoveTarget(member)}>
                        {t('staff.remove')}
                      </button>
                    )}
                    {isSelf && isOwnerRow && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('staff.cannotRemoveSelf')}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="glass-card" style={{ padding: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>{t('staff.pendingInvites')}</h2>
        {data.pendingInvites.length === 0 ? (
          <EmptyState title={t('staff.noPendingInvites')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.pendingInvites.map((inv) => (
              <div key={inv._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>{inv.email}</span>
                <span style={{ color: 'var(--text-muted)' }}>{t('staff.expiresAt', { date: dateFormatter.format(new Date(inv.expiresAt)) })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {inviteOpen && (
        <div className="modal-overlay" onClick={() => setInviteOpen(false)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('staff.inviteButton')}</h3>
            <input
              type="email" className="input-field" style={{ width: '100%', marginBottom: '16px' }}
              placeholder={t('staff.invitePlaceholder')}
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
            <p style={{ marginBottom: '16px' }}>{t('staff.removeConfirm', { name: removeTarget.user?.name })}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setRemoveTarget(null)}>{t('common:cancel')}</button>
              <button className="btn-danger" onClick={confirmRemove}>{t('staff.remove')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
