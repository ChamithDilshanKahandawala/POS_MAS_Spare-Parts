import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';

export default function OtpPage() {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp } = useAuth();

  const userId = location.state?.userId;
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!userId) {
    // Arrived here directly (refresh, bookmark) without a login step first.
    navigate('/login', { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await verifyOtp(userId, code);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || t('otp.invalidCode'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <form onSubmit={handleSubmit} className="glass-card animate-fade" style={{ padding: '32px', width: '100%', maxWidth: '380px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px', fontSize: '22px' }}>{t('otp.heading')}</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('otp.subtitle')}</p>

        <label style={{ display: 'block', marginBottom: '20px' }}>
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('otp.codeLabel')}</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            className="input-field"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
            autoFocus
            required
          />
        </label>

        <button type="submit" className="btn-primary" disabled={submitting || code.length !== 6} style={{ width: '100%', justifyContent: 'center', marginBottom: '12px' }}>
          {t('otp.submit')}
        </button>

        <Link to="/login" style={{ display: 'block', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          {t('otp.backToLogin')}
        </Link>
      </form>
    </div>
  );
}
