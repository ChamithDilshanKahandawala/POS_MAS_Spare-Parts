import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/services';
import toast from 'react-hot-toast';
import { User, Mail, Lock, Store, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', shop: 'Main Branch' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await registerUser(formData);
      toast.success(res.data.message || 'Registration request sent!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputWrapperStyle = {
    display: 'flex', alignItems: 'center',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-light)',
    borderRadius: '10px',
    marginBottom: '18px',
    paddingLeft: '14px',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
  };
  const iconStyle = { color: 'var(--text-muted)', flexShrink: 0, marginRight: '8px' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top right, rgba(99,102,241,0.1), transparent), radial-gradient(circle at bottom left, rgba(220,38,38,0.05), transparent), var(--bg-primary)', padding: '20px' }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', background: 'white', borderRadius: '24px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '2px solid rgba(220,38,38,0.1)' }}>
            <img src="/logo.png" alt="Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)' }}>Staff Enrollment</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Mudiyanse Auto Solutions · Internal Portal</p>
        </div>

        <div className="glass-card" style={{ padding: '40px', borderRadius: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div style={inputWrapperStyle}>
              <User size={18} style={iconStyle} />
              <input
                type="text" placeholder="Full Name" required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '12px 14px 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={inputWrapperStyle}>
              <Mail size={18} style={iconStyle} />
              <input
                type="email" placeholder="Email Address" required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '12px 14px 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={inputWrapperStyle}>
              <Lock size={18} style={iconStyle} />
              <input
                type="password" placeholder="Secure Password" required
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '12px 14px 12px 0', fontSize: '14px', color: 'var(--text-primary)' }}
              />
            </div>
            <div style={inputWrapperStyle}>
              <Store size={18} style={iconStyle} />
              <select
                value={formData.shop}
                onChange={e => setFormData({...formData, shop: e.target.value})}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '12px 14px 12px 0', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <option value="Main Branch">Main Branch - Headquarters</option>
                <option value="Mirigama Branch">Mirigama Shop</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              {loading ? 'Processing...' : 'Request Access'} {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(99,102,241,0.05)', borderRadius: '12px', border: '1px dashed rgba(99,102,241,0.2)' }}>
             <p style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}><CheckCircle2 size={14} style={{ color: '#6366f1', flexShrink: 0 }} />Registration requires manual approval by the administrator before you can sign in.</p>
          </div>
        </div>
        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Already a member? <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}