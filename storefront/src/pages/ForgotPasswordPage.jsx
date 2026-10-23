import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ApexoraWordmark from '../components/layout/ApexoraWordmark';

// Marketplace-only — never routed to in pos mode (there is no forgot/
// reset password flow there). Dev: the reset link is printed to the
// marketplace-backend console, same as the login OTP; debugResetToken
// below is a dev convenience (never present outside NODE_ENV=test on the
// backend, same guard as every other debug* field in this app).
export default function ForgotPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await forgotPassword(email);
    setLoading(false);
    if (!result.success) return toast.error(result.message);
    setSent(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px' }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: '410px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '14px' }}><ApexoraWordmark size={30} style={{ justifyContent: 'center' }} /></div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>{t('forgotPassword.title')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('forgotPassword.subtitle')}</p>
        </div>

        <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>{t('forgotPassword.sentTitle')}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('forgotPassword.sentBody')}</p>
              {import.meta.env.DEV && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px' }}>{t('forgotPassword.devHint')}</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('login.emailLabel')}</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="email" className="input-field" placeholder={t('login.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required style={{ paddingLeft: '38px' }} />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '15px' }}>
                {loading ? t('forgotPassword.sending') : t('forgotPassword.sendLink')}
              </button>
            </form>
          )}

          <div style={{ textAlign: 'center', paddingTop: '16px', marginTop: '16px', borderTop: '1px solid var(--border-light)' }}>
            <Link to="/login" style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={14} /> {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
