import { useEffect, useState } from 'react';
import { getMyMediaBlob, getAdminMediaBlob } from '../api/services';

// Listing photos are fetched with a Bearer token, not a cookie, so a
// plain <img src="/api/..."> can't work — same reasoning as the logo/
// banner/application-document blob fetches elsewhere in this console.
// `scope="admin"` uses the admin (any-seller) media route; the default
// "seller" scope uses the caller's own-seller-only route.
export default function MediaImage({ mediaId, size = 'medium', format = 'jpg', scope = 'seller', alt = '', style, className }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!mediaId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(null);
      return undefined;
    }
    let active = true;
    let objectUrl = null;
    const fetchBlob = scope === 'admin' ? getAdminMediaBlob : getMyMediaBlob;
    fetchBlob(mediaId, size, format)
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => { if (active) setUrl(null); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId, size, format, scope]);

  if (!url) {
    return <div className={className} style={{ background: 'var(--bg-secondary)', ...style }} />;
  }
  return <img src={url} alt={alt} className={className} style={style} />;
}
