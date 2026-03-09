import { useEffect, useState, useCallback, useRef } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct, importProductsExcel, exportProductsExcel } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Edit2, Trash2, X, Package, ChevronLeft, ChevronRight, Upload, Download, Scan } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['Three-Wheel', 'Bike', 'Car', 'SUV', 'Off-Road'];
const EMPTY_FORM = {
  name: '', sku_code: '', category: 'Car', sub_category: '',
  buying_price: '', selling_price: '', stock_quantity: '',
  low_stock_threshold: 5, supplier: '', description: '',
};

export default function InventoryPage() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);
  const barcodeRef = useRef(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef(null);

  // ── Barcode scanner (keyboard wedge) ─────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Enter' && barcodeBuffer.current.length > 2) {
        setSearch(barcodeBuffer.current);
        toast.success(`🔍 Scanned: ${barcodeBuffer.current}`, { duration: 2000 });
        barcodeBuffer.current = '';
        return;
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getProducts({ search, category, page, limit: 15 });
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, category, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [search, category]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditProduct(null); setModalOpen(true); };
  const openEdit = (p) => {
    setForm({ ...p, buying_price: p.buying_price, selling_price: p.selling_price, stock_quantity: p.stock_quantity });
    setEditProduct(p);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editProduct) {
        await updateProduct(editProduct._id, form);
        toast.success('Product updated!');
      } else {
        await createProduct(form);
        toast.success('Product added!');
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await deleteProduct(id);
      toast.success('Product removed');
      fetchProducts();
    } catch {
      toast.error('Failed to delete product');
    }
  };

  // ── Excel Import ─────────────────────────────────────────────────────────────
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await importProductsExcel(fd);
      toast.success(`✅ ${data.created} added, ${data.updated} updated!`);
      if (data.errors?.length) toast.error(`${data.errors.length} rows had errors`);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // ── Excel Export ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await exportProductsExcel();
      const url  = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Mudiyanse_Inventory_${new Date().toISOString().slice(0,10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded! 📊');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const margin = (bp, sp) => bp && sp ? (((sp - bp) / sp) * 100).toFixed(1) : '0';

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 className="page-title">Inventory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {total} spare parts · <span style={{color:'var(--accent-primary)',fontSize:'12px'}}>📡 Barcode scanner ready</span>
          </p>
        </div>
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {/* Barcode scan tip */}
          <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',background:'rgba(99,102,241,0.08)',borderRadius:'8px',border:'1px solid rgba(99,102,241,0.2)',fontSize:'12px',color:'var(--accent-primary)'}}>
            <Scan size={14}/> Scan barcode to search
          </div>
          {isAdmin && (
            <>
              {/* Import */}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} style={{display:'none'}}/>
              <button className="btn-secondary" onClick={()=>fileInputRef.current.click()} disabled={importing} style={{gap:'6px'}}>
                <Upload size={15}/> {importing?'Importing...':'Import Excel'}
              </button>
              {/* Export */}
              <button className="btn-secondary" onClick={handleExport} disabled={exporting} style={{gap:'6px',borderColor:'rgba(34,197,94,0.3)',color:'#22c55e'}}>
                <Download size={15}/> {exporting?'Exporting...':'Export Excel'}
              </button>
              {/* Add */}
              <button className="btn-primary" onClick={openAdd}>
                <Plus size={16} /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input-field" placeholder="Search by name or SKU..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '36px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['All', ...CATEGORIES].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              style={{
                padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                cursor: 'pointer', border: '1px solid',
                borderColor: category === cat ? 'var(--accent-primary)' : 'var(--border-light)',
                background: category === cat ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                color: category === cat ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Buying</th>
                <th>Selling</th>
                <th>Margin</th>
                <th>Stock</th>
                <th>Supplier</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                  <div>No products found</div>
                </td></tr>
              ) : products.map(p => (
                <tr key={p._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    {p.sub_category && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.sub_category}</div>}
                  </td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--accent-primary)' }}>{p.sku_code}</span></td>
                  <td><span className="badge badge-purple">{p.category}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>Rs. {p.buying_price.toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>Rs. {p.selling_price.toLocaleString()}</td>
                  <td><span className="badge badge-green">{margin(p.buying_price, p.selling_price)}%</span></td>
                  <td>
                    <span className={`badge ${p.stock_quantity === 0 ? 'badge-red' : p.stock_quantity <= p.low_stock_threshold ? 'badge-yellow' : 'badge-green'}`}>
                      {p.stock_quantity} units
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{p.supplier || '—'}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(p)} style={{ padding: '6px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#6366f1', display: 'flex' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(p._id, p.name)} style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px', borderTop: '1px solid var(--border)' }}>
            <button className="btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Page {page} of {pages}</span>
            <button className="btn-secondary" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ padding: '6px 12px' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Name *</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. NGK Spark Plug B6S" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SKU Code *</label>
                <input className="input-field" value={form.sku_code} onChange={e => setForm({ ...form, sku_code: e.target.value.toUpperCase() })} required placeholder="e.g. NGK-B6S" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category *</label>
                <select className="select-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sub-Category</label>
                <input className="input-field" value={form.sub_category} onChange={e => setForm({ ...form, sub_category: e.target.value })} placeholder="e.g. Engine Parts" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Buying Price (Rs.) *</label>
                <input className="input-field" type="number" min="0" step="0.01" value={form.buying_price} onChange={e => setForm({ ...form, buying_price: e.target.value })} required placeholder="0.00" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selling Price (Rs.) *</label>
                <input className="input-field" type="number" min="0" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} required placeholder="0.00" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stock Quantity *</label>
                <input className="input-field" type="number" min="0" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} required placeholder="0" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Low Stock Alert at</label>
                <input className="input-field" type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: e.target.value })} placeholder="5" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier</label>
                <input className="input-field" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editProduct ? 'Update Product' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
