import { useState, useEffect } from 'react';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../api/services';
import { Truck, Plus, Search, Edit2, Trash2, X, Phone, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY = { company_name:'', contact_person:'', phone:'', email:'', address:'', outstanding_payment:0, categories:[], notes:'' };
const CATS  = ['Three-Wheel','Bike','Car','SUV','Off-Road'];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null);
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await getSuppliers({ search }); setSuppliers(data.suppliers||[]); }
    catch { toast.error('Failed to load'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const openAdd  = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (s) => { setSelected(s); setForm({...s, categories: s.categories||[]}); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const toggleCat = (cat) => setForm(p => ({
    ...p, categories: p.categories.includes(cat) ? p.categories.filter(c=>c!==cat) : [...p.categories, cat]
  }));

  const handleSave = async () => {
    if (!form.company_name.trim()) { toast.error('Company name required'); return; }
    setSaving(true);
    try {
      if (modal==='add') { await createSupplier(form); toast.success('Supplier added!'); }
      else               { await updateSupplier(selected._id, form); toast.success('Updated!'); }
      closeModal(); load();
    } catch (e) { toast.error(e.response?.data?.message||'Error'); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this supplier?')) return;
    await deleteSupplier(id); toast.success('Removed'); load();
  };

  const fmtRs = (v) => `Rs. ${Number(v||0).toLocaleString('en-LK',{minimumFractionDigits:2})}`;
  const totalOwed = suppliers.reduce((s,x)=>s+x.outstanding_payment,0);

  return (
    <div className="animate-fade">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p style={{color:'var(--text-muted)',fontSize:'14px',marginTop:'4px'}}>
            {suppliers.length} suppliers · Total owed: <b style={{color:'#ef4444'}}>{fmtRs(totalOwed)}</b>
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={16}/> Add Supplier</button>
      </div>

      <div style={{position:'relative',marginBottom:'20px',maxWidth:'400px'}}>
        <Search size={15} style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)'}}/>
        <input className="input-field" placeholder="Search suppliers..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:'36px'}}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:'16px'}}>
        {loading ? <p style={{color:'var(--text-muted)',gridColumn:'1/-1',textAlign:'center',padding:'40px'}}>Loading...</p>
        : suppliers.length===0 ? <p style={{color:'var(--text-muted)',gridColumn:'1/-1',textAlign:'center',padding:'40px'}}>No suppliers yet</p>
        : suppliers.map(s=>(
          <div key={s._id} className="glass-card" style={{padding:'20px',position:'relative'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'12px'}}>
              <div>
                <div style={{fontWeight:700,color:'var(--text-primary)',fontSize:'15px'}}>{s.company_name}</div>
                {s.contact_person && <div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{s.contact_person}</div>}
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>openEdit(s)} style={{background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:'6px',padding:'5px 8px',cursor:'pointer',color:'var(--accent-primary)'}}><Edit2 size={13}/></button>
                <button onClick={()=>handleDelete(s._id)} style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'6px',padding:'5px 8px',cursor:'pointer',color:'#ef4444'}}><Trash2 size={13}/></button>
              </div>
            </div>
            {s.phone && <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:'var(--text-secondary)',marginBottom:'6px'}}><Phone size={12}/>{s.phone}</div>}
            {s.outstanding_payment > 0 && (
              <div style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'8px',padding:'8px 12px',marginBottom:'8px'}}>
                <div style={{fontSize:'11px',color:'var(--text-muted)'}}>Outstanding Payment</div>
                <div style={{fontWeight:700,color:'#ef4444',fontSize:'16px'}}>{fmtRs(s.outstanding_payment)}</div>
              </div>
            )}
            {s.categories?.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
                {s.categories.map(c=><span key={c} className="badge badge-purple" style={{fontSize:'9px',padding:'2px 6px'}}>{c}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {(modal==='add'||modal==='edit') && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'20px'}}>
          <div className="glass-card" style={{width:'100%',maxWidth:'500px',padding:'28px',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <h2 style={{fontSize:'18px',fontWeight:700,color:'var(--text-primary)'}}>{modal==='add'?'Add Supplier':'Edit Supplier'}</h2>
              <button onClick={closeModal} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}><X size={20}/></button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
              {[['Company Name *','company_name'],['Contact Person','contact_person'],['Phone','phone'],['Email','email'],['Address','address']].map(([label,key])=>(
                <div key={key} style={{gridColumn:key==='address'||key==='company_name'?'span 2':'auto'}}>
                  <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>{label}</label>
                  <input className="input-field" value={form[key]||''} onChange={e=>setForm(p=>({...p,[key]:e.target.value}))} style={{width:'100%',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>Outstanding Payment (Rs.)</label>
                <input className="input-field" type="number" min="0" value={form.outstanding_payment||0} onChange={e=>setForm(p=>({...p,outstanding_payment:Number(e.target.value)}))} style={{width:'100%',boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'8px',textTransform:'uppercase'}}>Vehicle Categories</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                  {CATS.map(cat=>(
                    <button key={cat} type="button" onClick={()=>toggleCat(cat)} style={{padding:'4px 10px',borderRadius:'6px',border:'1px solid',fontSize:'11px',cursor:'pointer',transition:'all 0.15s',borderColor:form.categories?.includes(cat)?'var(--accent-primary)':'var(--border-light)',background:form.categories?.includes(cat)?'rgba(99,102,241,0.15)':'transparent',color:form.categories?.includes(cat)?'var(--accent-primary)':'var(--text-muted)'}}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px',textTransform:'uppercase'}}>Notes</label>
                <textarea className="input-field" rows={2} value={form.notes||''} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{width:'100%',boxSizing:'border-box',resize:'vertical'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{flex:1,justifyContent:'center'}}>{saving?'Saving...':modal==='add'?'Add Supplier':'Save'}</button>
              <button className="btn-secondary" onClick={closeModal} style={{padding:'10px 20px'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
