import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, UserPlus, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { login, handleGoogleAuth, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Where CustomerRoute sent them from (e.g. /checkout), so a logged-out
  // customer lands back where they meant to go instead of the home page.
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      if (result.user?.role !== 'customer') {
        toast.error(t('toast.staffShouldUsePos'));
      } else {
        toast.success(t('toast.welcomeBack'));
        navigate(from, { replace: true });
      }
    } else {
      toast.error(result.message);
    }
  };

  const onGoogleSuccess = async (credentialResponse) => {
    const result = await handleGoogleAuth(credentialResponse.credential);
    if (result.success) {
      if (result.user?.role !== 'customer') {
        toast.error(t('toast.staffShouldUsePos'));
      } else {
        toast.success(t('toast.welcomeBack'));
        navigate(from, { replace: true });
      }
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '20px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative background circles */}
      <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '400px', height: '400px', borderRadius: '50%', background: 'var(--accent-glow)' }} />
      <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(230,126,34,0.06)' }} />

      <div className="animate-fade" style={{ width: '100%', maxWidth: '410px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '72px', height: '72px', margin: '0 auto 14px',
            borderRadius: '16px', overflow: 'hidden',
            border: '3px solid var(--accent-light)',
            boxShadow: '0 8px 24px rgba(230,126,34,0.15)',
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {t('login.welcomeBack')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {t('login.subtitle')}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.3px' }}>{t('login.emailLabel')}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type="email" className="input-field" placeholder={t('login.emailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} required style={{ paddingLeft: '38px' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.3px' }}>{t('login.passwordLabel')}</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input type={showPass ? 'text' : 'password'} className="input-field" placeholder={t('login.passwordPlaceholder')} value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingLeft: '38px', paddingRight: '42px' }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', marginTop: '4px', justifyContent: 'center', fontSize: '15px' }}>
              {loading ? t('login.signingIn') : t('login.signIn')}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{t('login.orContinueWith')}</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <GoogleLogin
              onSuccess={onGoogleSuccess}
              onError={() => toast.error(t('toast.googleLoginFailed'))}
              useOneTap
              shape="rectangular"
              theme="filled_black"
            />
          </div>

          <div style={{ textAlign: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-light)', fontSize: '13px' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>{t('login.noAccount')}</p>
            <Link to="/register" state={location.state} style={{
              color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}><UserPlus size={15} /> {t('login.createAccount')}</Link>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>{t('common:nav.backToStore')}</Link>
        </div>
      </div>
    </div>
  );
}