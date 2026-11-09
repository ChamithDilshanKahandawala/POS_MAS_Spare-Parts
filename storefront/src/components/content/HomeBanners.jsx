import { Link } from 'react-router-dom';
import useSiteContent, { pickLocalized } from '../../hooks/useSiteContent';
import { buildContentBannerUrl } from '../../api/marketplaceServices';

// Homepage banners published from Admin → Content, for "all languages" or
// the reader's own. Several scroll sideways; nothing renders when none apply.
export default function HomeBanners({ language }) {
  const content = useSiteContent();
  const banners = (content?.banners || []).filter((b) => b.language === 'all' || b.language === language);
  if (banners.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', scrollSnapType: 'x mandatory', marginBottom: '24px', paddingBottom: '4px' }}>
      {banners.map((b) => {
        const title = pickLocalized(b.title, language) || '';
        const img = (
          <img
            src={buildContentBannerUrl(b.id, b.version)} alt={title} loading="lazy"
            style={{ display: 'block', width: '100%', aspectRatio: '10 / 3', objectFit: 'cover', borderRadius: '18px', background: 'var(--bg-secondary)' }}
          />
        );
        const style = { flex: banners.length > 1 ? '0 0 min(88%, 960px)' : '1 1 100%', scrollSnapAlign: 'start', display: 'block' };
        if (!b.link) return <div key={b.id} style={style}>{img}</div>;
        return b.link.startsWith('/')
          ? <Link key={b.id} to={b.link} style={style} aria-label={title}>{img}</Link>
          : <a key={b.id} href={b.link} target="_blank" rel="noopener noreferrer" style={style} aria-label={title}>{img}</a>;
      })}
    </div>
  );
}
