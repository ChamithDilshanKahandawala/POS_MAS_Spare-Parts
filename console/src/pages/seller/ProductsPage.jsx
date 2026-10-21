import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMyListings, updateMyListing, hideMyListing, showMyListing, deleteMyListing, duplicateMyListing, getSellerCategoryTree, getMyPosStatus,
} from '../../api/services';
import { localized } from '../../utils/localized';
import EmptyState from '../../components/EmptyState';
import MediaImage from '../../components/MediaImage';

const TABS = ['all', 'draft', 'in_review', 'published', 'rejected', 'hidden', 'suspended', 'needsUpdate'];
const STATUS_BADGE = { draft: 'badge-blue', in_review: 'badge-yellow', published: 'badge-green', rejected: 'badge-red', hidden: 'badge-orange', suspended: 'badge-red' };

function flattenCategories(nodes, out = []) {
  for (const node of nodes) {
    out.push(node.category);
    flattenCategories(node.children, out);
  }
  return out;
}

function InlineNumber({ value, onSave, prefix, min = 0 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value); setEditing(true); }}
        style={{ background: 'none', border: '1px dashed transparent', cursor: 'pointer', font: 'inherit', color: 'inherit', padding: '2px 4px', borderRadius: '6px' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {prefix}{value}
      </button>
    );
  }
  return (
    <input
      type="number" min={min} autoFocus className="input-field"
      style={{ width: '90px', padding: '4px 6px', fontSize: '13px' }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (Number(draft) !== value) onSave(Number(draft)); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

export default function ProductsPage() {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [posEnabled, setPosEnabled] = useState(false);

  const tab = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const page = Number(searchParams.get('page') || 1);

  const load = useCallback(() => {
    setLoading(true);
    const params = { search: search || undefined, categoryId: categoryId || undefined, page, limit: 20 };
    if (tab === 'needsUpdate') params.needsUpdate = 'true';
    else if (tab !== 'all') params.status = tab;
    getMyListings(params)
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [tab, search, categoryId, page, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getSellerCategoryTree().then(({ data }) => setCategories(flattenCategories(data.tree))).catch(() => {});
  }, []);

  // "Import from POS" only ever makes sense once the owner has turned
  // the connection on (admin side) — getMyPosStatus never 404s, it just
  // reports enabled: false for every seller that isn't connected.
  useEffect(() => {
    getMyPosStatus().then(({ data }) => setPosEnabled(data.enabled)).catch(() => {});
  }, []);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const saveField = async (listing, field, value) => {
    try {
      await updateMyListing(listing._id, { [field]: value });
      toast.success(t('products.saved'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const toggleVisibility = async (listing) => {
    try {
      if (listing.status === 'published') await hideMyListing(listing._id);
      else await showMyListing(listing._id);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const handleDuplicate = async (listing) => {
    try {
      const { data } = await duplicateMyListing(listing._id);
      toast.success(t('products.duplicated'));
      navigate(`/seller/products/${data.listing._id}/edit`);
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteMyListing(pendingDelete._id);
      toast.success(t('products.deleted'));
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
      setPendingDelete(null);
    }
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title">{t('seller:nav.products')}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {posEnabled && (
            <Link className="btn-secondary" to="/seller/products/import-pos">
              <Download size={14} /> {t('products.importFromPos')}
            </Link>
          )}
          <Link className="btn-primary" to="/seller/products/new">
            <Plus size={14} /> {t('products.addListing')}
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)', paddingBottom: '2px' }}>
        {TABS.map((key) => (
          <button
            key={key}
            className={tab === key ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '7px 14px', fontSize: '12px' }}
            onClick={() => updateParam('status', key === 'all' ? '' : key)}
          >
            {t(`products.tabs.${key}`)} {result ? `(${result.counts[key]})` : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div className="console-search" style={{ maxWidth: '320px' }}>
          <Search size={14} />
          <input
            type="text"
            placeholder={t('products.searchPlaceholder')}
            defaultValue={search}
            onKeyDown={(e) => { if (e.key === 'Enter') updateParam('search', e.currentTarget.value); }}
            onBlur={(e) => updateParam('search', e.currentTarget.value)}
          />
        </div>
        <select className="select-field" style={{ width: 'auto' }} value={categoryId} onChange={(e) => updateParam('categoryId', e.target.value)}>
          <option value="">{t('products.allCategories')}</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{'— '.repeat(c.depth)}{localized(c.name, i18n.language)}</option>)}
        </select>
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.listings.length === 0 ? (
        <EmptyState title={t('products.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>{t('products.table.title')}</th>
                <th>{t('products.table.price')}</th>
                <th>{t('products.table.stock')}</th>
                <th>{t('products.table.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.listings.map((listing) => (
                <tr key={listing._id}>
                  <td style={{ width: '48px' }}>
                    <MediaImage
                      mediaId={listing.images?.[0]?._id} size="thumb"
                      style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                  </td>
                  <td>
                    <Link to={`/seller/products/${listing._id}/edit`} style={{ color: 'inherit', fontWeight: 600, textDecoration: 'none' }}>
                      {listing.title?.en || t('products.untitled')}
                    </Link>
                    {listing.sku && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{listing.sku}</div>}
                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {listing.needsUpdate && <span className="badge badge-orange"><AlertTriangle size={10} /> {t('products.needsUpdateBadge')}</span>}
                      {listing.hasPendingRevision && <span className="badge badge-yellow">{t('products.pendingRevisionBadge')}</span>}
                      {listing.stock === 0 && <span className="badge badge-red">{t('products.outOfStockBadge')}</span>}
                      {listing.stock > 0 && listing.lowStockAlert && listing.stock <= listing.lowStockAlert && (
                        <span className="badge badge-yellow">{t('products.lowStockBadge')}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <InlineNumber value={listing.priceCents / 100} prefix="Rs " onSave={(v) => saveField(listing, 'priceCents', Math.round(v * 100))} />
                  </td>
                  <td>
                    <InlineNumber value={listing.stock} onSave={(v) => saveField(listing, 'stock', v)} />
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[listing.status]}`}>{t(`products.status.${listing.status}`)}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {['published', 'hidden'].includes(listing.status) && (
                        <button className="btn-secondary" style={{ padding: '6px' }} title={t(listing.status === 'published' ? 'products.hide' : 'products.show')} onClick={() => toggleVisibility(listing)}>
                          {listing.status === 'published' ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      <button className="btn-secondary" style={{ padding: '6px' }} title={t('products.duplicate')} onClick={() => handleDuplicate(listing)}>
                        <Copy size={13} />
                      </button>
                      {listing.status === 'draft' && (
                        <button className="btn-danger" style={{ padding: '6px' }} title={t('products.delete')} onClick={() => setPendingDelete(listing)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('products.pagination', { page: result.page, pages: result.pages })}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" disabled={page <= 1} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page - 1))}>
                <ChevronLeft size={14} />
              </button>
              <button className="btn-secondary" disabled={page >= result.pages} style={{ padding: '6px 10px' }} onClick={() => updateParam('page', String(page + 1))}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <div className="modal-overlay" onClick={() => setPendingDelete(null)}>
          <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '12px' }}>{t('products.deleteConfirmTitle')}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>{pendingDelete.title?.en || t('products.untitled')}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setPendingDelete(null)}>{t('common:cancel')}</button>
              <button className="btn-danger" onClick={confirmDelete}>{t('products.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
