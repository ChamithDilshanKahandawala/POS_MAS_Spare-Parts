import { useState } from 'react';
import { X } from 'lucide-react';

// Free-text tag list (category/global prohibited keywords) — Enter or
// comma commits the current input as a new tag; works the same for any
// script (English, Sinhala, Tamil), since it's just string equality,
// never regex word-boundary matching.
export default function TagInput({ value, onChange, placeholder, disabled }) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tag = draft.trim();
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag]);
    }
    setDraft('');
  };

  const remove = (tag) => onChange(value.filter((v) => v !== tag));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: value.length > 0 ? '10px' : 0 }}>
        {value.map((tag) => (
          <span key={tag} className="badge badge-purple">
            {tag}
            {!disabled && (
              <button type="button" onClick={() => remove(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'inherit', padding: 0 }}>
                <X size={11} />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <input
          type="text"
          className="input-field"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
          }}
          onBlur={commit}
        />
      )}
    </div>
  );
}
