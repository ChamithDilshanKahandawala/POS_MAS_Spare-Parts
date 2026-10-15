import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, Plus, GripVertical } from 'lucide-react';
import { localized } from '../../../utils/localized';

// One level of siblings. Recurses into its own children with a fresh
// drag state — a drag never crosses parents, matching "reorder within a
// parent" from the spec (cross-parent re-parenting is a Basics-tab edit,
// not a drag).
export default function CategoryTree({
  nodes, parentId, depth, selectedId, onSelect, expandedIds, onToggleExpand, onAddChild, onReorder,
}) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const handleDrop = (targetId) => {
    if (dragId && dragId !== targetId) {
      const ids = nodes.map((n) => n.category._id);
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      if (from >= 0 && to >= 0) {
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        onReorder(parentId, ids);
      }
    }
    setDragId(null);
    setOverId(null);
  };

  return (
    <div>
      {nodes.map((node) => {
        const { category, children } = node;
        const hasChildren = children.length > 0;
        const isExpanded = expandedIds.has(category._id);
        const isSelected = selectedId === category._id;
        const isDragOver = overId === category._id && dragId !== category._id;

        return (
          <div key={category._id}>
            <div
              draggable
              onDragStart={() => setDragId(category._id)}
              onDragOver={(e) => { e.preventDefault(); setOverId(category._id); }}
              onDragLeave={() => setOverId((cur) => (cur === category._id ? null : cur))}
              onDrop={() => handleDrop(category._id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onClick={() => onSelect(category._id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 10px', paddingLeft: `${10 + depth * 20}px`,
                borderRadius: '8px', cursor: 'pointer', userSelect: 'none',
                background: isSelected ? 'var(--accent-light)' : (isDragOver ? 'var(--accent-glow)' : 'transparent'),
                border: isDragOver ? '1px dashed var(--accent-primary)' : '1px solid transparent',
              }}
            >
              <GripVertical size={14} color="var(--text-muted)" style={{ cursor: 'grab', flexShrink: 0 }} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(category._id); }}
                style={{ background: 'none', border: 'none', cursor: hasChildren ? 'pointer' : 'default', display: 'flex', padding: 0, flexShrink: 0 }}
              >
                {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: '14px', display: 'inline-block' }} />}
              </button>

              <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {localized(category.name, i18n.language)}
              </span>

              {!category.active && <span className="badge badge-orange">{t('catalog.tree.inactive')}</span>}
              {category.listingCount > 0 && <span className="badge badge-blue">{t('catalog.tree.listingCount', { count: category.listingCount })}</span>}

              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11px', flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); onAddChild(category._id); }}
                title={t('catalog.tree.addChild')}
              >
                <Plus size={12} />
              </button>
            </div>

            {hasChildren && isExpanded && (
              <CategoryTree
                nodes={children}
                parentId={category._id}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                onAddChild={onAddChild}
                onReorder={onReorder}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
