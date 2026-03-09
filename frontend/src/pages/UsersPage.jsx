import React, { useEffect, useState } from 'react';
import { fetchAllUsers, approveUser, promoteUser, deleteUser } from '../api/services';
import { 
  Users, UserCheck, ShieldAlert, Trash2, UserCog, 
  Mail, User as UserIcon, Calendar, CheckCircle2 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await fetchAllUsers();
      setUsers(res.data.users);
      setLoading(false);
    } catch (err) {
      toast.error("Failed to load staff data");
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAction = async (id, name, actionFn, message) => {
    try {
      await actionFn(id);
      toast.success(`${name} ${message}`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed");
    }
  };

  if (loading) return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div className="animate-pulse">Loading Staff Records...</div>
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>Staff Management</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Approve new registrations and manage employee roles.</p>
        </div>
        <div style={{ background: 'var(--bg-card)', padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="#6366f1" />
          <span style={{ fontWeight: 700 }}>{users.length} Total Users</span>
        </div>
      </div>

      {/* Users Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {users.map(u => (
          <div key={u._id} style={{
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
              background: u.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
              color: u.role === 'admin' ? '#ef4444' : '#6366f1',
              textTransform: 'uppercase'
            }}>
              {u.role}
            </div>

            <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                background: u.status === 'active' ? 'var(--bg-secondary)' : 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: u.status === 'active' ? '#10b981' : '#f59e0b'
              }}>
                <UserIcon size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{u.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Mail size={12} /> {u.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-light)', marginBottom: '15px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Status: <span style={{ fontWeight: 600, color: u.status === 'active' ? '#10b981' : '#f59e0b' }}>
                  {u.status.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <Calendar size={12} /> {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              {u.status === 'pending' && (
                <button 
                  onClick={() => handleAction(u._id, u.name, approveUser, "Approved!")}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <UserCheck size={16} /> Approve
                </button>
              )}
              
              <button 
                onClick={() => handleAction(u._id, u.name, promoteUser, "Role Updated!")}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', padding: '10px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}
              >
                <UserCog size={16} /> Toggle Role
              </button>

              <button 
                onClick={() => { if(window.confirm(`Delete ${u.name}?`)) handleAction(u._id, u.name, deleteUser, "Deleted!"); }}
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}