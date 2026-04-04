import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/services';
import toast from 'react-hot-toast';
import { User, Mail, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [loading, setLoading] = useState(false);
  const { handleGoogleAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await registerUser(formData);
      toast.success(res.data.message || 'Registration successful!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSuccess = async (credentialResponse) => {
    const result = await handleGoogleAuth(credentialResponse.credential);
    if (result.success) {
      if (result.user?.role !== 'customer') {
        toast.error('Staff/Admin should login through the POS Portal.');
      } else {
        toast.success('Welcome to Mudiyanse Auto Solutions! 👋');
        navigate('/');
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
          <div style={{
            width: '72px', height: '72px', margin: '0 auto 14px',
            borderRadius: '16px', overflow: 'hidden',
            border: '3px solid var(--accent-light)',
            boxShadow: '0 8px 24px rgba(230,126,34,0.15)',
          }}>
            <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'white' }} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>Create an Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Join us to buy genuine spare parts</p>
        </div>

        <div className="glass-card" style={{ padding: '32px', borderRadius: '20px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ position: 'relative' }}>
              <User size={16} style={iconStyle} />
              <input type="text" placeholder="Full Name" required className="input-field" style={{ paddingLeft: '42px' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={iconStyle} />
              <input type="email" placeholder="Email Address" required className="input-field" style={{ paddingLeft: '42px' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={iconStyle} />
              <input type="password" placeholder="Secure Password" required className="input-field" style={{ paddingLeft: '42px' }} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{
              width: '100%', padding: '13px', borderRadius: '12px', fontWeight: 700,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
              marginTop: '4px', fontSize: '15px',
            }}>
              {loading ? 'Processing...' : 'Create Account'} {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>OR CONTINUE WITH</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <GoogleLogin
              onSuccess={onGoogleSuccess}
              onError={() => toast.error('Google Registration Failed')}
              useOneTap shape="rectangular" theme="filled_black"
            />
          </div>

          <div style={{
            padding: '10px 14px', background: 'var(--accent-light)', borderRadius: '10px',
            border: '1px solid rgba(230,126,34,0.15)',
          }}>
            <p style={{ fontSize: '11px', color: 'var(--accent-primary)', display: 'flex', gap: '6px', fontWeight: 500 }}>
              <CheckCircle2 size={14} style={{ flexShrink: 0 }} /> Instant access – buy parts immediately after registering!
            </p>
          </div>
        </div>
        <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: 'var(--text-muted)' }}>
          Already a member? <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}