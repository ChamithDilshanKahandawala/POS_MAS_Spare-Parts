import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getListingQueue, getAdminCategoryTree } from '../../api/services';
import { localized } from '../../utils/localized';
import EmptyState from '../../components/EmptyState';
import MediaImage from '../../components/MediaImage';

function flattenCategories(nodes, out = []) {
  for (const node of nodes) {
    out.push(node.category);
    flattenCategories(node.children, out);
  }
  return out;
}

export default function ListingReviewPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const type = searchParams.get('type') || '';
  const category = searchParams.get('category') || '';
  const regulated = searchParams.get('regulated') || '';
  const seller = searchParams.get('seller') || '';

  const load = useCallback(() => {
    setLoading(true);
    getListingQueue({ type: type || undefined, category: category || undefined, regulated: regulated || undefined, seller: seller || undefined, limit: 50 })
      .then(({ data }) => setResult(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [type, category, regulated, seller, t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getAdminCategoryTree().then(({ data }) => setCategories(flattenCategories(data.tree))).catch(() => {});
  }, []);

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next);
  };

  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '20px' }}>{t('common:nav.listingReview')}</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select className="select-field" style={{ width: 'auto' }} value={type} onChange={(e) => updateParam('type', e.target.value)}>
          <option value="">{t('listingReview.filters.allTypes')}</option>
          <option value="new">{t('listingReview.filters.new')}</option>
          <option value="revision">{t('listingReview.filters.revision')}</option>
        </select>
        <select className="select-field" style={{ width: 'auto' }} value={category} onChange={(e) => updateParam('category', e.target.value)}>
          <option value="">{t('listingReview.filters.allCategories')}</option>
          {categories.map((c) => <option key={c._id} value={c._id}>{'— '.repeat(c.depth)}{localized(c.name, i18n.language)}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
          <input type="checkbox" checked={regulated === 'true'} onChange={(e) => updateParam('regulated', e.target.checked ? 'true' : '')} />
          {t('listingReview.filters.regulatedOnly')}
        </label>
        {seller && (
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => updateParam('seller', '')}>
            {t('listingReview.filters.clearSeller')}
          </button>
        )}
      </div>

      {loading ? (
        <div>{t('common:loading')}</div>
      ) : result.listings.length === 0 ? (
        <EmptyState title={t('listingReview.noResults')} />
      ) : (
        <div className="glass-card" style={{ padding: '20px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>{t('listingReview.table.title')}</th>
                <th>{t('listingReview.table.seller')}</th>
                <th>{t('listingReview.table.category')}</th>
                <th>{t('listingReview.table.type')}</th>
                <th>{t('listingReview.table.updated')}</th>
              </tr>
            </thead>
            <tbody>
              {result.listings.map((listing) => (
                <tr key={listing._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/listing-review/${listing._id}`)}>
                  <td style={{ width: '48px' }}>
                    <MediaImage mediaId={listing.images?.[0]} size="thumb" scope="admin" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} />
                  </td>
                  <td>{listing.title?.en || t('products.untitled')}</td>
                  <td>{listing.seller?.displayName || listing.seller?.name}</td>
                  <td>{localized(listing.categoryId?.name, i18n.language)}</td>
                  <td><span className={`badge ${listing.isRevision ? 'badge-yellow' : 'badge-blue'}`}>{t(listing.isRevision ? 'listingReview.filters.revision' : 'listingReview.filters.new')}</span></td>
                  <td>{dateFormatter.format(new Date(listing.updatedAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
