import useDocumentMeta from '../../hooks/useDocumentMeta';
import { PLATFORM_INFO } from '../../config/store';
import ContentBody from './ContentBody';

// An info page published from Admin → Content, replacing the built-in copy.
export default function PublishedInfoPage({ page }) {
  useDocumentMeta(`${page.title} | ${PLATFORM_INFO.name}`, page.body.replace(/[#*[\]()-]/g, '').slice(0, 155));
  return (
    <div className="animate-fade" style={{ maxWidth: '760px', margin: '0 auto', paddingBottom: '40px' }}>
      <h1 className="page-title" style={{ textAlign: 'center', marginBottom: '24px' }}>{page.title}</h1>
      <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
        <ContentBody text={page.body} />
      </div>
    </div>
  );
}
