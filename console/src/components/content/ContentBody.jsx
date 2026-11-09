import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// Copy of storefront/src/components/content/ContentBody.jsx, so the preview
// matches what customers see. Renders the markup as React elements — never
// as HTML, so pasted content can't inject markup or scripts. Supported: blank-line
// paragraphs, "## " and "### " headings, "- " bullet lists, **bold**, and
// [text](/path or https://…) links.
const SAFE_LINK = /^(\/(?!\/)|https?:\/\/)/;

function inline(text, keyBase) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = pattern.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`${keyBase}-${i++}`}>{token.slice(2, -2)}</strong>);
    } else {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (!SAFE_LINK.test(href)) parts.push(label);
      else if (href.startsWith('/')) parts.push(<Link key={`${keyBase}-${i++}`} to={href} style={{ color: 'var(--accent-primary)' }}>{label}</Link>);
      else parts.push(<a key={`${keyBase}-${i++}`} href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>{label}</a>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export default function ContentBody({ text }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div style={{ fontSize: '14px', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={bi} style={{ paddingLeft: '20px', margin: '0 0 14px', listStyle: 'disc' }}>
              {lines.map((l, li) => <li key={li}>{inline(l.trim().slice(2), `${bi}-${li}`)}</li>)}
            </ul>
          );
        }
        return (
          <Fragment key={bi}>
            {lines.map((l, li) => {
              const line = l.trim();
              if (line.startsWith('### ')) return <h3 key={li} style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: '18px 0 6px' }}>{inline(line.slice(4), `${bi}-${li}`)}</h3>;
              if (line.startsWith('## ')) return <h2 key={li} style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: '22px 0 8px' }}>{inline(line.slice(3), `${bi}-${li}`)}</h2>;
              return null;
            })}
            {(() => {
              const prose = lines.filter((l) => !/^#{2,3} /.test(l.trim()));
              if (!prose.length) return null;
              return <p style={{ margin: '0 0 14px' }}>{prose.map((l, li) => <Fragment key={li}>{li > 0 && <br />}{inline(l.trim(), `${bi}-p${li}`)}</Fragment>)}</p>;
            })()}
          </Fragment>
        );
      })}
    </div>
  );
}
