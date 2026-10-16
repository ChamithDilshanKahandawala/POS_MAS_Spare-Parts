import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Check } from 'lucide-react';
import { getSellerCategoryTree } from '../../../../api/services';
import { localized } from '../../../../utils/localized';

function CategoryNode({ node, depth, selectedId, onSelect, expandedIds, toggleExpand, lang }) {
  const { category, effective, children } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(category._id);
  const isSelected = selectedId === category._id;

  return (
    <div>
      <div
        onClick={() => onSelect(category)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', paddingLeft: `${10 + depth * 20}px`,
          borderRadius: '8px', cursor: 'pointer', background: isSelected ? 'var(--accent-light)' : 'transparent',
        }}
      >
        <button type="button" onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(category._id); }} style={{ background: 'none', border: 'none', display: 'flex', padding: 0 }}>
          {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: '14px', display: 'inline-block' }} />}
        </button>
        <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500, flex: 1 }}>{localized(category.name, lang)}</span>
        <span className="badge badge-green" style={{ fontSize: '10px' }}>{(effective.commissionRateBps / 100).toFixed(2)}%</span>
        {isSelected && <Check size={14} color="var(--accent-primary)" />}
      </div>
      {hasChildren && isExpanded && children.map((child) => (
        <CategoryNode key={child.category._id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} expandedIds={expandedIds} toggleExpand={toggleExpand} lang={lang} />
      ))}
    </div>
  );
}

export default function StepCategory({ listing, onCreate, onChange }) {
  const { t, i18n } = useTranslation(['seller', 'common']);
  const [tree, setTree] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getSellerCategoryTree().then(({ data }) => {
      setTree(data.tree);
      setExpandedIds(new Set(data.tree.map((n) => n.category._id)));
    }).catch(() => {});
  }, []);

  const toggleExpand = (id) => setExpandedIds((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleSelect = (category) => {
    setSelected(category);
    if (!listing) {
      onCreate(category._id);
    } else {
      onChange({ categoryId: category._id });
    }
  };

  if (!tree) return <div>{t('common:loading')}</div>;

  const currentId = listing?.categoryId?._id || listing?.categoryId || selected?._id;

  return (
    <div className="glass-card" style={{ padding: '16px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>{t('wizard.category.intro')}</p>
      {listing?.status === 'published' && (
        <p style={{ fontSize: '12px', color: 'var(--accent-primary-text)', marginBottom: '14px' }}>{t('wizard.category.changeWarning')}</p>
      )}
      <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
        {tree.map((node) => (
          <CategoryNode key={node.category._id} node={node} depth={0} selectedId={currentId} onSelect={handleSelect} expandedIds={expandedIds} toggleExpand={toggleExpand} lang={i18n.language} />
        ))}
      </div>
    </div>
  );
}
