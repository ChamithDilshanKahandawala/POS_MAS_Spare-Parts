import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ChevronRight, ChevronDown, ShieldAlert, ClipboardCheck } from 'lucide-react';
import { getSellerCategoryTree } from '../../api/services';
import { localized } from '../../utils/localized';
import EmptyState from '../../components/EmptyState';

function CategoryRow({ node, depth, expandedIds, toggleExpand, lang, t }) {
  const { category, effective, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(category._id);

  return (
    <div>
      <div
        className="glass-card"
        style={{
          padding: '12px 14px', marginBottom: '8px', marginLeft: `${depth * 16}px`,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && toggleExpand(category._id)}
      >
        {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: '14px' }} />}
        <span style={{ fontSize: '13px', fontWeight: 700, flex: 1, minWidth: '120px' }}>{localized(category.name, lang)}</span>
        <span className="badge badge-green">{t('categoriesFees.commission', { pct: (effective.commissionRateBps / 100).toFixed(2) })}</span>
        <span className={`badge ${effective.returnPolicy.returnable ? 'badge-blue' : 'badge-orange'}`}>
          {effective.returnPolicy.returnable
            ? t('categoriesFees.returnableDays', { days: effective.returnPolicy.windowDays })
            : t('categoriesFees.notReturnable')}
        </span>
        {effective.regulated && <span className="badge badge-purple"><ShieldAlert size={11} /> {t('categoriesFees.regulated')}</span>}
        {effective.reviewRequired && <span className="badge badge-yellow"><ClipboardCheck size={11} /> {t('categoriesFees.reviewRequired')}</span>}
      </div>
      {hasChildren && isExpanded && children.map((child) => (
        <CategoryRow key={child.category._id} node={child} depth={depth + 1} expandedIds={expandedIds} toggleExpand={toggleExpand} lang={lang} t={t} />
      ))}
    </div>
  );
}

export default function CategoriesFeesPage() {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState(new Set());

  const load = useCallback(() => {
    setLoading(true);
    getSellerCategoryTree()
      .then(({ data }) => {
        setTree(data.tree);
        setExpandedIds(new Set(data.tree.map((n) => n.category._id)));
      })
      .catch(() => toast.error(t('common:error.generic')))
      .finally(() => setLoading(false));
  }, [t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id) => setExpandedIds((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (loading || !tree) return <div>{t('common:loading')}</div>;

  return (
    <div className="animate-fade">
      <h1 className="page-title" style={{ marginBottom: '6px' }}>{t('categoriesFees.title')}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('categoriesFees.subtitle')}</p>

      {tree.length === 0 ? (
        <EmptyState title={t('categoriesFees.empty')} />
      ) : (
        tree.map((node) => (
          <CategoryRow key={node.category._id} node={node} depth={0} expandedIds={expandedIds} toggleExpand={toggleExpand} lang={i18n.language} t={t} />
        ))
      )}
    </div>
  );
}
