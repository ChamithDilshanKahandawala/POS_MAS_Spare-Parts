import React, { useEffect, useState } from 'react';
import { fetchEcommerceCustomers, toggleUserStatus, deleteUser } from '../api/services';
import { Users, Trash2, Mail, User as UserIcon, Calendar, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function EcommerceCustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCustomers = async () => {
    try {
      const res = await fetchEcommerceCustomers();
      setCustomers(res.data.users);
      setLoading(false);
    } catch (err) {
      toast.error("Failed to load e-commerce customers");
      setLoading(false);
    }
  };

  useEffect(() => { loadCustomers(); }, []);

  const handleAction = async (id, name, actionFn, message) => {
    try {
      await actionFn(id);
      toast.success(`${name} ${message}`);
      loadCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    }
  };

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div className="animate-pulse">Loading Web Customers...</div>
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>Web Customers</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Manage registered e-commerce customers.</p>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="#6366f1" />
          <span style={{ fontWeight: 700 }}>{customers.length} Web Customers</span>
        </div>
      </div>

      {/* Customers Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {customers.map(c => (
          <div key={c._id} style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-light)',
            padding: '20px',
            transition: 'transform 0.2s',
            position: 'relative'
          }}>
            {/* Role Badge */}
            <div style={{
              position: 'absolute', top: '20px', right: '20px',
              padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 800,
              background: 'rgba(59,130,246,0.1)',
              color: '#3b82f6',
              textTransform: 'uppercase'
            }}>
              CUSTOMER
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: c.status === 'active' ? 'var(--bg-secondary)' : 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.status === 'active' ? '#10b981' : '#f59e0b'
              }}>
                <UserIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Mail size={12} /> {c.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)', marginBottom: '15px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Status: <span style={{ fontWeight: 600, color: c.status === 'active' ? '#10b981' : '#f59e0b' }}>
                  {c.status.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <Calendar size={12} /> {new Date(c.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => handleAction(c._id, c.name, toggleUserStatus, c.isActive ? "Deactivated" : "Activated")}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '10px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Power size={16} /> Toggle Access
              </button>

              {user?.role === 'super_admin' && (
                <button 
                  onClick={() => { if(window.confirm(`Delete ${c.name}?`)) handleAction(c._id, c.name, deleteUser, "Deleted!"); }}
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
        
        {customers.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No e-commerce customers found.
          </div>
        )}
      </div>
    </div>
  );
}
