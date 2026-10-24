import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { registerUser } from '../api/services';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Phone, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import GoogleAuthButton, { hasGoogleAuth } from '../components/GoogleAuthButton';
import ApexoraWordmark from '../components/layout/ApexoraWordmark';
import { Trans, useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { isMarketplace } from '../api/dataSource';

export default function RegisterPage() {
  const { t } = useTranslation(['auth', 'common', 'marketplace']);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'customer' });
  const [loading, setLoading] = useState(false);
  // Marketplace-only OTP step — same pattern as LoginPage.
  const [step, setStep] = useState('form');
  const [pendingUserId, setPendingUserId] = useState(null);
  const [code, setCode] = useState('');
  const { handleGoogleAuth, register, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Same "where did they come from" carry-through as LoginPage.
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) return toast.error(t('pwa:offlineRegister'));
    setLoading(true);
    try {
      if (isMarketplace) {
        const result = await register(formData.name, formData.email, formData.phone, formData.password);
        if (!result.success) {
          toast.error(result.message);
        } else {
          setPendingUserId(result.userId);
          if (result.debugOtpCode) setCode(result.debugOtpCode);
          setStep('otp');
        }
        return;
      }
      const res = await registerUser(formData);
      toast.success(res.data.message || t('toast.registrationSuccessful'));
      // Email/password registration doesn't auto-login, so send them to log
      // in next — carrying the original destination forward with them.
      navigate('/login', { state: location.state });
    } catch (err) {
      toast.error(err.response?.data?.message || t('toast.registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Marketplace-only — register() above only got as far as "account
  // created, OTP sent"; this completes the session the same way
  // LoginPage's OTP step does.
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const result = await verifyOtp(pendingUserId, code);
    if (result.success) {
      toast.success(t('toast.welcomeNew'));
      navigate(from, { replace: true });
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
        toast.success(t('toast.welcomeNew'));
        navigate(from, { replace: true });
      }
    } else {
      toast.error(result.message);
    }
  };

  const iconStyle = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', bottom: '-100px', right: '-100px', width: '350px', height: '350px', borderRadius: '50%', background: 'var(--accent-glow)' }} />
      <div style={{ position: 'absolute', top: '-60px', left: '-60px', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(230,126,34,0.06)' }} />

      <div className="animate-fade" style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ marginBottom: '14px' }}>
            <ApexoraWordmark size={30} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>{t('register.title')}</h1>
          {/* Follow-up #2 — auth:register.subtitle ("...buy genuine spare
              parts") is the same unverifiable-guarantee pattern fixed
              elsewhere; marketplace:register.subtitle replaces it in
              marketplace mode only. pos mode keeps reading the original. */}
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>{isMarketplace ? t('marketplace:register.subtitle') : t('register.subtitle')}</p>
        </div>

        <div className="glass-card" style={{ padding: '32px', borderRadius: '20px' }}>
          {step === 'otp' ? (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{t('login.otpSentHint', { email: formData.email })}</p>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={16} style={iconStyle} />
                <input
                  type="text" inputMode="numeric" maxLength={6} required className="input-field"
                  style={{ paddingLeft: '42px', letterSpacing: '4px', fontWeight: 700 }}
                  placeholder={t('login.otpPlaceholder')} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button type="submit" disabled={loading || code.length !== 6} className="btn-primary" style={{ width: '100%', padding: '13px', borderRadius: '12px', justifyContent: 'center', fontSize: '15px' }}>
                {loading ? t('login.verifying') : t('login.verifyCode')}
              </button>
              <button type="button" onClick={() => setStep('form')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                {t('login.backToCredentials')}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ position: 'relative' }}>
              <User size={16} style={iconStyle} />
              <input type="text" placeholder={t('register.fullNamePlaceholder')} required className="input-field" style={{ paddingLeft: '42px' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={iconStyle} />
              <input type="email" placeholder={t('register.emailPlaceholder')} required className="input-field" style={{ paddingLeft: '42px' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            {isMarketplace && (
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={iconStyle} />
                <input type="tel" placeholder={t('register.phonePlaceholder')} required className="input-field" style={{ paddingLeft: '42px' }} value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input type="password" placeholder={t('register.passwordPlaceholder')} required minLength={8} className="input-field" style={{ paddingLeft: '42px' }} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{
              width: '100%', padding: '13px', borderRadius: '12px', fontWeight: 700,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
              marginTop: '4px', fontSize: '15px',
            }}>
              {loading ? t('register.processing') : t('register.submit')} {!loading && <ArrowRight size={16} />}
            </button>
          </form>
          )}

          {step === 'form' && hasGoogleAuth && !isMarketplace && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{t('register.orContinueWith')}</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <GoogleAuthButton onSuccess={onGoogleSuccess} onError={() => toast.error(t('toast.googleRegisterFailed'))} />
              </div>
            </>
          )}

          {step === 'form' && (
            <>
              <div style={{
                padding: '10px 14px', background: 'var(--accent-light)', borderRadius: '10px',
                border: '1px solid rgba(230,126,34,0.15)',
              }}>
                <p style={{ fontSize: '11px', color: 'var(--accent-primary)', display: 'flex', gap: '6px', fontWeight: 500 }}>
                  <CheckCircle2 size={14} style={{ flexShrink: 0 }} /> {t('register.instantAccess')}
                </p>
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '14px', lineHeight: 1.6 }}>
                <Trans
                  i18nKey="auth:register.termsNotice"
                  components={[
                    <Link key="0" to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />,
                    <Link key="2" to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />,
                  ]}
                />
              </p>
            </>
          )}
        </div>
        {step === 'form' && (
          <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: 'var(--text-muted)' }}>
            {t('register.alreadyMember')} <Link to="/login" state={location.state} style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>{t('register.signIn')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}