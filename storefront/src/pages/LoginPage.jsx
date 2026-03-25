import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, UserPlus, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { login, handleGoogleAuth, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      if (result.user?.role !== 'customer') {
        toast.error('Staff/Admin should login through the POS Portal.');
      } else {
        toast.success('Welcome back to the Store! 👋');
        navigate('/');
      }
    } else {
      toast.error(result.message);
    }
  };

  const onGoogleSuccess = async (credentialResponse) => {
    const result = await handleGoogleAuth(credentialResponse.credential);
    if (result.success) {
      if (result.user?.role !== 'customer') {
        toast.error('Staff/Admin should login through the POS Portal.');
      } else {
        toast.success('Welcome back to the Store! 👋');
        navigate('/');
      }
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at top left, rgba(16,185,129,0.15) 0%, var(--bg-primary) 50%)',
      padding: '20px',
    }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 16px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(16,185,129,0.5)', boxShadow: '0 10px 25px rgba(16,185,129,0.2)' }}>
            <ShoppingBag size={36} color="#10b981" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Customer Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Mudiyanse Auto Solutions
          </p>
        </div>

        <div className="glass-card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>Sign In to Shop</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>EMAIL ADDRESS</label>
              <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
               <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>PASSWORD</label>
               <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} className="input-field" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: '42px' }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
               </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '12px', marginTop: '8px', background: '#10b981' }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <GoogleLogin
              onSuccess={onGoogleSuccess}
              onError={() => toast.error('Google Login Failed')}
              useOneTap
              shape="rectangular"
              theme="filled_black"
            />
          </div>

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-light)', textAlign: 'center', fontSize: '13px' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Not a member yet?</p>
             <Link to="/register" style={{ color: '#10b981', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><UserPlus size={16} /> Create an Account</Link>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>&larr; Back to Store</Link>
        </div>
      </div>
    </div>
  );
}