import { useState, useEffect, useCallback } from 'react';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer, updateCredit } from '../api/services';
import { Users, Plus, Search, Edit2, Trash2, X, Phone, Car, CreditCard, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const VEHICLE_TYPES = ['Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road', 'Other'];
const EMPTY = { name:'', phone:'', email:'', address:'', vehicle_plate:'', vehicle_type:'Other', credit_limit:0, discount_pct:0, notes:'' };

export default function CustomersPage() {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState('');
  const [modal, setModal]           = useState(null); // null | 'add' | 'edit' | 'credit'
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [creditAmt, setCreditAmt]   = useState('');
  const [creditType, setCreditType] = useState('add');
  const [saving, setSaving]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getCustomers({ search });
      setCustomers(data.customers || []);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (c) => { setSelected(c); setForm({ ...c }); setModal('edit'); };
  const openCredit=(c) => { setSelected(c); setCreditAmt(''); setCreditType('add'); setModal('credit'); };
  const closeModal= () => { setModal(null); setSelected(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (modal === 'add') { await createCustomer(form); toast.success('Customer added!'); }
      else                 { await updateCustomer(selected._id, form); toast.success('Updated!'); }
      closeModal(); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this customer?')) return;
    await deleteCustomer(id);
    toast.success('Removed'); load();
  };

  const handleCredit = async () => {
    const amount = Number(creditAmt);
    if (!amount || amount <= 0) { toast.error('Enter valid amount'); return; }
    setSaving(true);
    try {
      await updateCredit(selected._id, { amount, type: creditType });
      toast.success(creditType === 'add' ? 'Credit added!' : 'Payment recorded!');
      closeModal(); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const fmtRs = (v) => `Rs. ${Number(v||0).toLocaleString('en-LK', {minimumFractionDigits:2})}`;

  const totalDue = customers.reduce((s,c)=>s+c.balance_due,0);

  return (
    <div className="animate-fade">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 className="page-title">Customers (CRM)</h1>
          <p style={{color:'var(--text-muted)',fontSize:'14px',marginTop:'4px'}}>
            {customers.length} customers · Total due: <b style={{color:'#ef4444'}}>{fmtRs(totalDue)}</b>
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={16}/> Add Customer</button>
      </div>

      {/* Search */}
      <div style={{position:'relative',marginBottom:'20px',maxWidth:'400px'}}>
        <Search size={15} style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
        <input className="input-field" placeholder="Search by name, phone, plate..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:'36px'}}/>
      </div>

      {/* Table */}
      <div className="glass-card" style={{overflow:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--border-light)'}}>
              {['Name','Phone','Vehicle','Credit Limit','Balance Due','Discount','Actions'].map(h=>(
                <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:'11px',fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{padding:'40px',textAlign:'center',color:'var(--text-muted)'}}>Loading...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} style={{padding:'40px',textAlign:'center',color:'var(--text-muted)'}}>No customers yet</td></tr>
            ) : customers.map(c => (
              <tr key={c._id} style={{borderBottom:'1px solid var(--border-light)',transition:'background 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card-hover)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{padding:'12px 16px'}}>
                  <div style={{fontWeight:600,color:'var(--text-primary)'}}>{c.name}</div>
                  {c.email && <div style={{fontSize:'11px',color:'var(--text-muted)'}}>{c.email}</div>}
                </td>
                <td style={{padding:'12px 16px',color:'var(--text-secondary)',fontSize:'13px'}}>{c.phone||'—'}</td>
                <td style={{padding:'12px 16px'}}>
                  {c.vehicle_plate && <span className="badge badge-purple" style={{fontSize:'10px',marginRight:'4px'}}>{c.vehicle_plate}</span>}
                  <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{c.vehicle_type}</span>
                </td>
                <td style={{padding:'12px 16px',color:'var(--text-secondary)',fontSize:'13px'}}>{fmtRs(c.credit_limit)}</td>
                <td style={{padding:'12px 16px'}}>
                  <span style={{fontWeight:700,color:c.balance_due>0?'#ef4444':'#22c55e',fontSize:'13px'}}>{fmtRs(c.balance_due)}</span>
                </td>
                <td style={{padding:'12px 16px'}}>
                  {c.discount_pct > 0 && <span className="badge badge-green" style={{fontSize:'10px'}}>{c.discount_pct}% OFF</span>}
                  {!c.discount_pct && <span style={{color:'var(--text-muted)',fontSize:'12px'}}>—</span>}
                </td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:'6px'}}>
                    {c.credit_limit > 0 && (
                      <button onClick={()=>openCredit(c)} style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:'6px',padding:'5px 8px',cursor:'pointer',color:'#22c55e',fontSize:'11px',display:'flex',alignItems:'center',gap:'3px'}}>
                        <CreditCard size={12}/> Credit
                      </button>
                    )}
                    <button onClick={()=>openEdit(c)} style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:'6px',padding:'5px 8px',cursor:'pointer',color:'var(--accent-primary)'}}>
                      <Edit2 size={13}/>
                    </button>
                    <button onClick={()=>handleDelete(c._id)} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'6px',padding:'5px 8px',cursor:'pointer',color:'#ef4444'}}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(modal==='add'||modal==='edit') && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'20px'}}>
          <div className="glass-card" style={{width:'100%',maxWidth:'520px',padding:'28px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <h2 style={{fontSize:'18px',fontWeight:700,color:'var(--text-primary)'}}>{modal==='add'?'Add Customer':'Edit Customer'}</h2>
              <button onClick={closeModal} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={20}/></button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              {[['Name *','name','text'],['Phone','phone','text'],['Email','email','email'],['Address','address','text'],['Vehicle Plate','vehicle_plate','text']].map(([label,key,type])=>(
                <div key={key} style={{gridColumn:key==='address'?'span 2':'auto'}}>
                  <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>{label}</label>
                  <input className="input-field" type={type} value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{width:'100%',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>Vehicle Type</label>
                <select className="input-field" value={form.vehicle_type} onChange={e=>setForm(p=>({...p,vehicle_type:e.target.value}))} style={{width:'100%'}}>
                  {VEHICLE_TYPES.map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>Credit Limit (Rs.)</label>
                <input className="input-field" type="number" min="0" value={form.credit_limit||0} onChange={e=>setForm(p=>({...p,credit_limit:Number(e.target.value)}))} style={{width:'100%',boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>Discount %</label>
                <input className="input-field" type="number" min="0" max="100" value={form.discount_pct||0} onChange={e=>setForm(p=>({...p,discount_pct:Number(e.target.value)}))} style={{width:'100%',boxSizing:'border-box'}}/>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>Notes</label>
                <textarea className="input-field" rows={2} value={form.notes||''} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{width:'100%',boxSizing:'border-box',resize:'vertical'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{flex:1,justifyContent:'center'}}>
                {saving?'Saving...':modal==='add'?'Add Customer':'Save Changes'}
              </button>
              <button className="btn-secondary" onClick={closeModal} style={{padding:'10px 20px'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Modal */}
      {modal==='credit' && selected && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'20px'}}>
          <div className="glass-card" style={{width:'100%',maxWidth:'400px',padding:'28px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <h2 style={{fontSize:'18px',fontWeight:700,color:'var(--text-primary)'}}>Credit / Payment</h2>
              <button onClick={closeModal} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={20}/></button>
            </div>
            <div style={{background:'var(--bg-secondary)',borderRadius:'10px',padding:'14px',marginBottom:'16px'}}>
              <div style={{fontSize:'13px',color:'var(--text-muted)'}}>Customer</div>
              <div style={{fontWeight:700,color:'var(--text-primary)',marginBottom:'4px'}}>{selected.name}</div>
              <div style={{display:'flex',gap:'16px'}}>
                <div><div style={{fontSize:'11px',color:'var(--text-muted)'}}>Credit Limit</div><div style={{fontWeight:600,color:'var(--text-secondary)'}}>{fmtRs(selected.credit_limit)}</div></div>
                <div><div style={{fontSize:'11px',color:'var(--text-muted)'}}>Balance Due</div><div style={{fontWeight:700,color:selected.balance_due>0?'#ef4444':'#22c55e'}}>{fmtRs(selected.balance_due)}</div></div>
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',marginBottom:'14px'}}>
              {[['add','Add Credit (Naya)','#ef4444'],['pay','Record Payment','#22c55e']].map(([t,label,col])=>(
                <button key={t} onClick={()=>setCreditType(t)} style={{flex:1,padding:'10px',borderRadius:'8px',border:`2px solid ${creditType===t?col:'var(--border-light)'}`,background:creditType===t?`${col}22`:'transparent',color:creditType===t?col:'var(--text-secondary)',cursor:'pointer',fontWeight:600,fontSize:'13px',transition:'all 0.2s'}}>
                  {label}
                </button>
              ))}
            </div>
            <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>Amount (Rs.)</label>
            <input className="input-field" type="number" min="1" value={creditAmt} onChange={e=>setCreditAmt(e.target.value)} placeholder="0.00" style={{width:'100%',boxSizing:'border-box',marginBottom:'16px'}}/>
            <button className="btn-primary" onClick={handleCredit} disabled={saving} style={{width:'100%',justifyContent:'center'}}>
              {saving?'Processing...':`Confirm ${creditType==='add'?'Credit':'Payment'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
