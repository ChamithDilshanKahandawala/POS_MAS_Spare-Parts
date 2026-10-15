import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getInvite, acceptInvite } from '../../api/services';
import { useAuth } from '../../context/useAuth';

export default function InviteAcceptPage() {
  const { t } = useTranslation(['seller', 'common']);
  const { token } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getInvite(token)
      .then(({ data }) => setInvite(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  // load (useCallback) sets state internally — legitimate fetch-on-mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await acceptInvite(token, invite.needsPassword ? { name, password } : {});
      if (invite.needsPassword) {
        // Chain straight into the normal two-step login with the
        // password they just set — "set password -> one-time code ->
        // lands on Seller Home", exactly as specced, reusing the real
        // login flow rather than minting a session a different way.
        const userId = await login(invite.email, password);
        navigate('/otp', { state: { userId } });
      } else {
        toast.success(t('inviteAccept.success'));
        navigate('/login');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t('common:loading')}
      </div>
    );
  }

  if (notFound || !invite) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="glass-card animate-fade" style={{ padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center' }}>
          <h1 className="page-title" style={{ fontSize: '20px', marginBottom: '10px' }}>{t('inviteAccept.invalidOrExpired')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('inviteAccept.invalidOrExpiredHint')}</p>
          <Link to="/login" className="btn-secondary">{t('inviteAccept.goToLogin')}</Link>
        </div>
      </div>
    );
  }

  const subtitleKey = invite.role === 'platform_staff' ? 'platformSubtitle' : invite.role === 'seller_owner' ? 'ownerSubtitle' : 'staffSubtitle';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <form onSubmit={handleSubmit} className="glass-card animate-fade" style={{ padding: '32px', width: '100%', maxWidth: '400px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px', fontSize: '22px' }}>{t('inviteAccept.heading')}</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          {t(`inviteAccept.${subtitleKey}`, { seller: invite.sellerName })}
        </p>

        {invite.needsPassword ? (
          <>
            <label style={{ display: 'block', marginBottom: '14px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('inviteAccept.nameLabel')}</span>
              <input type="text" className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label style={{ display: 'block', marginBottom: '20px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('inviteAccept.passwordLabel')}</span>
              <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </label>
          </>
        ) : (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>{t('inviteAccept.existingAccountNotice')}</p>
        )}

        <button type="submit" className="btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? t('inviteAccept.submitting') : t('inviteAccept.submit')}
        </button>
      </form>
    </div>
  );
}
