import { useRef } from 'react';
import { Bold, List } from 'lucide-react';

// A plain textarea with a minimal bold/bullet toolbar — wraps the
// selection in **markers** or prefixes the current line with "- ", the
// same lightweight convention the storefront (Milestone 5) will render.
// No rich-text editor dependency; this is exactly what the spec asks
// for ("a simple bold/bullet toolbar"), not a WYSIWYG editor.
export default function RichTextArea({ value, onChange, placeholder, rows = 5 }) {
  const ref = useRef(null);

  const wrapSelection = (before, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = `${value.slice(0, selectionStart)}${before}${selected}${after}${value.slice(selectionEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + before.length, selectionEnd + before.length);
    });
  };

  const prefixLine = (prefix) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart } = el;
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(selectionStart + prefix.length, selectionStart + prefix.length); });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
        <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => wrapSelection('**')}><Bold size={12} /></button>
        <button type="button" className="btn-secondary" style={{ padding: '4px 8px' }} onClick={() => prefixLine('- ')}><List size={12} /></button>
      </div>
      <textarea
        ref={ref}
        className="input-field"
        style={{ width: '100%', minHeight: `${rows * 20}px`, resize: 'vertical' }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
