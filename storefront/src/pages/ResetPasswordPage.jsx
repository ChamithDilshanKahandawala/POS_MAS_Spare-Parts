import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import ApexoraWordmark from '../components/layout/ApexoraWordmark';

// Marketplace-only — reached via the link printed to the marketplace-
// backend console by POST /auth/forgot-password: /reset-password?userId=
// ...&token=... . Missing/malformed params are treated as the same
// "invalid or expired" state the backend itself would return, rather
// than crashing or silently doing nothing.
export default function ResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common']);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!userId || !token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px' }}>
        <div className="glass-card animate-fade" style={{ maxWidth: '410px', padding: '32px', borderRadius: '20px', textAlign: 'center' }}>
          <AlertTriangle size={36} color="var(--accent-red)" style={{ margin: '0 auto 12px', display: 'block' }} />
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{t('resetPassword.invalidTitle')}</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{t('resetPassword.invalidBody')}</p>
          <Link to="/forgot-password" className="btn-primary" style={{ justifyContent: 'center', textDecoration: 'none' }}>{t('forgotPassword.title')}</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await resetPassword(userId, token, password);
    setLoading(false);
    if (!result.success) return toast.error(result.message);
    setDone(true);
    setTimeout(() => navigate('/login'), 2500);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px' }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: '410px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '14px' }}><ApexoraWordmark size={30} style={{ justifyContent: 'center' }} /></div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)' }}>{t('resetPassword.title')}</h1>
        </div>

        <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{t('resetPassword.successTitle')}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>{t('resetPassword.successBody')}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('resetPassword.newPasswordLabel')}</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showPass ? 'text' : 'password'} className="input-field" minLength={8} required
                    placeholder={t('resetPassword.newPasswordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingLeft: '38px', paddingRight: '42px' }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '15px' }}>
                {loading ? t('resetPassword.saving') : t('resetPassword.save')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
