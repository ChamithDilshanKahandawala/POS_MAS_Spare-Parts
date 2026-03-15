import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // 👈 Link import kala
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, UserPlus } from 'lucide-react'; // 👈 UserPlus icon eka add kala
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@spareparts.lk');
  const [password, setPassword] = useState('admin123');
  const [showPass, setShowPass] = useState(false);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      if (result.user?.role === 'customer') {
        toast.error('Customers cannot login to the POS portal.');
        // Don't navigate, let them read the error
      } else {
        toast.success('Welcome back! 👋');
        navigate('/');
      }
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at top left, rgba(99,102,241,0.15) 0%, var(--bg-primary) 50%)',
      padding: '20px',
    }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo Section */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src="/logo.png"
            alt="Mudiyanse Auto Solutions"
            style={{
              width: '100px', height: '100px', borderRadius: '50%',
              objectFit: 'contain', margin: '0 auto 16px', display: 'block',
              background: 'white', padding: '4px',
              border: '3px solid rgba(220,38,38,0.5)',
              boxShadow: '0 20px 40px rgba(220,38,38,0.2)',
            }}
          />
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            MUDIYANSE
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Auto Solutions
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', color: 'var(--text-primary)' }}>
            Sign In
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.5px' }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@spareparts.lk"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', letterSpacing: '0.5px' }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: '42px' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '8px', fontSize: '15px' }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          {/* --- 🆕 REGISTER LINK ADDED HERE --- */}
          <div style={{ 
            marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-light)',
            textAlign: 'center', fontSize: '13px' 
          }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>New staff member?</p>
            <Link to="/register" style={{ 
              color: 'var(--accent-primary)', 
              fontWeight: 700, 
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <UserPlus size={16} /> Register for Approval
            </Link>
          </div>
          {/* --------------------------------- */}

        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
          © 2026 Mudiyanse Auto Solutions · Vehicle Spare Parts Management
        </p>
      </div>
    </div>
  );
}