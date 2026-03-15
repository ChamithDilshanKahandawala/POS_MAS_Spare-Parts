import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/services';
import toast from 'react-hot-toast';
import { User, Mail, Lock, ArrowRight, CheckCircle2, ShoppingBag } from 'lucide-react';

export default function RegisterPage() {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'customer' });
  const [loading, setLoading] = useState(false);
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

  const inputWrapperStyle = { position: 'relative', marginBottom: '18px' };
  const iconStyle = { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at bottom right, rgba(16,185,129,0.15) 0%, var(--bg-primary) 50%)', padding: '20px' }}>
      <div className="animate-fade" style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
           <div style={{ width: '80px', height: '80px', margin: '0 auto 16px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(16,185,129,0.5)', boxShadow: '0 10px 25px rgba(16,185,129,0.2)' }}>
            <ShoppingBag size={36} color="#10b981" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)' }}>Create an Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Join us to buy genuine spare parts</p>
        </div>

        <div className="glass-card" style={{ padding: '40px', borderRadius: '24px' }}>
          <form onSubmit={handleSubmit}>
            <div style={inputWrapperStyle}>
              <User size={18} style={iconStyle} />
              <input type="text" placeholder="Full Name" required className="input-field" style={{ paddingLeft: '44px' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div style={inputWrapperStyle}>
              <Mail size={18} style={iconStyle} />
              <input type="email" placeholder="Email Address" required className="input-field" style={{ paddingLeft: '44px' }} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div style={inputWrapperStyle}>
              <Lock size={18} style={iconStyle} />
              <input type="password" placeholder="Secure Password" required className="input-field" style={{ paddingLeft: '44px' }} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '14px', background: '#10b981', color: '#fff', borderRadius: '12px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              {loading ? 'Processing...' : 'Create Account'} {!loading && <ArrowRight size={18} />}
            </button>
          </form>
          <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(16,185,129,0.05)', borderRadius: '12px', border: '1px dashed rgba(16,185,129,0.2)' }}>
             <p style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}><CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />Instant Account Access: Buy parts immediately after registering!</p>
          </div>
        </div>
        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Already a member? <Link to="/login" style={{ color: '#10b981', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}