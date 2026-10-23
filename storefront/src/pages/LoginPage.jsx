import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, UserPlus, Mail, Lock, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import GoogleAuthButton, { hasGoogleAuth } from '../components/GoogleAuthButton';
import ApexoraWordmark from '../components/layout/ApexoraWordmark';
import { isMarketplace } from '../api/dataSource';

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  // Marketplace-only second step — login() returns needsOtp:true instead
  // of a session, and this page collects the code before calling
  // verifyOtp(). Never entered in pos mode (login() there resolves to a
  // full session in one call, same as it always has).
  const [step, setStep] = useState('credentials');
  const [pendingUserId, setPendingUserId] = useState(null);
  const [code, setCode] = useState('');
  const { login, verifyOtp, handleGoogleAuth, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Where CustomerRoute sent them from (e.g. /checkout), so a logged-out
  // customer lands back where they meant to go instead of the home page.
  const from = location.state?.from?.pathname || '/';

  const completeLogin = () => {
    toast.success(t('toast.welcomeBack'));
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) return toast.error(t('pwa:offlineLogin'));
    const result = await login(email, password);
    if (!result.success) return toast.error(result.message);

    if (result.needsOtp) {
      setPendingUserId(result.userId);
      setStep('otp');
      if (result.debugOtpCode) setCode(result.debugOtpCode); // dev convenience only — never present outside NODE_ENV=test on the backend
      return;
    }
    if (result.user?.role !== 'customer') {
      toast.error(t('toast.staffShouldUsePos'));
    } else {
      completeLogin();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const result = await verifyOtp(pendingUserId, code);
    if (result.success) completeLogin();
    else toast.error(result.message);
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
        {/* Signing in is a platform (Apexora) action, not specific to any
            one seller — same wordmark as the navbar, not the seller's own
            logo. */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '14px' }}>
            <ApexoraWordmark size={30} style={{ justifyContent: 'center' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {t('login.welcomeBack')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {t('login.subtitle')}
          </p>
        </div>

        <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
          {step === 'otp' ? (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('login.otpSentHint', { email })}</p>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.3px' }}>{t('login.otpLabel')}</label>
                <div style={{ position: 'relative' }}>
                  <ShieldCheck size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text" inputMode="numeric" maxLength={6} className="input-field"
                    placeholder={t('login.otpPlaceholder')} value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required
                    style={{ paddingLeft: '38px', letterSpacing: '4px', fontWeight: 700 }}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={loading || code.length !== 6} style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: '15px' }}>
                {loading ? t('login.verifying') : t('login.verifyCode')}
              </button>
              <button type="button" onClick={() => setStep('credentials')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                {t('login.backToCredentials')}
              </button>
            </form>
          ) : (
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
                {isMarketplace && (
                  <Link to="/forgot-password" style={{ display: 'block', textAlign: 'right', marginTop: '6px', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'none' }}>
                    {t('login.forgotPassword')}
                  </Link>
                )}
              </div>
              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', marginTop: '4px', justifyContent: 'center', fontSize: '15px' }}>
                {loading ? t('login.signingIn') : t('login.signIn')}
              </button>
            </form>
          )}

          {step === 'credentials' && hasGoogleAuth && !isMarketplace && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{t('login.orContinueWith')}</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <GoogleAuthButton onSuccess={onGoogleSuccess} onError={() => toast.error(t('toast.googleLoginFailed'))} />
              </div>
            </>
          )}

          {step === 'credentials' && (
            <div style={{ textAlign: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-light)', fontSize: '13px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '6px' }}>{t('login.noAccount')}</p>
              <Link to="/register" state={location.state} style={{
                color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}><UserPlus size={15} /> {t('login.createAccount')}</Link>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>{t('common:nav.backToStore')}</Link>
        </div>
      </div>
    </div>
  );
}