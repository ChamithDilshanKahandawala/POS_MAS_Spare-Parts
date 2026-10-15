import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Car } from 'lucide-react';
import { getAdminCategoryTree, getAdminCategoryDetail, reorderCategories } from '../../api/services';
import { useAuth } from '../../context/useAuth';
import EmptyState from '../../components/EmptyState';
import CategoryTree from './catalog/CategoryTree';
import CategoryCreateForm from './catalog/CategoryCreateForm';
import CategoryEditPanel from './catalog/CategoryEditPanel';

function flattenTree(nodes, out = []) {
  for (const node of nodes) {
    out.push(node.category);
    flattenTree(node.children, out);
  }
  return out;
}

function collectRootIds(nodes) {
  return nodes.map((n) => n.category._id);
}

export default function CatalogPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { isPlatformOwner } = useAuth();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creatingParentId, setCreatingParentId] = useState(undefined); // undefined = not creating, null = root, string = child

  const load = useCallback(() => {
    setLoading(true);
    getAdminCategoryTree()
      .then(({ data }) => {
        setTree(data.tree);
        setExpandedIds((cur) => (cur.size === 0 ? new Set(collectRootIds(data.tree)) : cur));
      })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback((id) => {
    setDetailLoading(true);
    getAdminCategoryDetail(id)
      .then(({ data }) => setDetail(data))
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setDetailLoading(false));
  }, [t]);

  // Fetches the selected category's effective rules on every selection
  // change — a fetch-on-change effect, not a render-triggered cascade
  // (same legitimate case as every other page's load() effect in this
  // console, e.g. SellerDetailPage.jsx). `detail` is cleared FIRST, every
  // time: CategoryEditPanel is keyed by selectedId, so a stale `detail`
  // from the previous selection would otherwise get captured as that
  // fresh mount's permanent initial state the instant the key changes,
  // one render before the real fetch resolves — the panel would then
  // silently keep showing the previous category's data forever.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const toggleExpand = (id) => setExpandedIds((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleAddChild = (parentId) => {
    setSelectedId(null);
    setCreatingParentId(parentId);
  };

  const handleReorder = async (parentId, orderedIds) => {
    try {
      await reorderCategories({ parentId, orderedIds });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common:error.generic'));
    }
  };

  const handleCreated = (category) => {
    setCreatingParentId(undefined);
    setExpandedIds((cur) => new Set([...cur, ...(category.parentId ? [String(category.parentId)] : [])]));
    load();
    setSelectedId(category._id);
  };

  const handleSaved = () => {
    load();
    loadDetail(selectedId);
  };

  const handleDeleted = () => {
    setSelectedId(null);
    setDetail(null);
    load();
  };

  if (loading || !tree) return <div>{t('common:loading')}</div>;

  const flatCategories = flattenTree(tree);
  const parentNode = creatingParentId ? flatCategories.find((c) => c._id === creatingParentId) : null;

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title">{t('common:nav.catalog')}</h1>
        <Link className="btn-secondary" to="/admin/catalog/vehicles">
          <Car size={14} /> {t('catalog.vehiclesLink')}
        </Link>
      </div>

      <div className="catalog-layout">
        <div className="glass-card" style={{ padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('catalog.tree.title')}
            </span>
            <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => { setSelectedId(null); setCreatingParentId(null); }}>
              <Plus size={12} /> {t('catalog.tree.addRoot')}
            </button>
          </div>
          {tree.length === 0 ? (
            <EmptyState title={t('catalog.tree.empty')} />
          ) : (
            <CategoryTree
              nodes={tree}
              parentId={null}
              depth={0}
              selectedId={selectedId}
              onSelect={(id) => { setCreatingParentId(undefined); setSelectedId(id); }}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onAddChild={handleAddChild}
              onReorder={handleReorder}
            />
          )}
        </div>

        <div>
          {creatingParentId !== undefined && (
            <CategoryCreateForm
              parentId={creatingParentId}
              parentName={parentNode?.name}
              onCreated={handleCreated}
              onCancel={() => setCreatingParentId(undefined)}
            />
          )}
          {creatingParentId === undefined && !selectedId && (
            <EmptyState icon={Plus} title={t('catalog.noSelection')} />
          )}
          {creatingParentId === undefined && selectedId && (detailLoading || !detail) && <div>{t('common:loading')}</div>}
          {creatingParentId === undefined && selectedId && detail && (
            <CategoryEditPanel
              key={selectedId}
              detail={detail}
              flatCategories={flatCategories}
              isPlatformOwner={isPlatformOwner}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          )}
        </div>
      </div>
    </div>
  );
}
