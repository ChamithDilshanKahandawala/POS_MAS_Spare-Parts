import { useEffect, useState } from 'react';

// Return photos sit behind the same Bearer-token auth as every other
// console route, so a plain <img src> can't load them. The caller passes a
// blob fetcher bound to (id, index) and this turns the response into an
// object URL, revoking it on unmount.
export default function AuthImage({ fetchBlob, index, alt = '', style, className }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl = null;
    fetchBlob(index)
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
  }, [fetchBlob, index]);

  if (!url) return <div className={className} style={{ background: 'var(--bg-secondary)', ...style }} />;
  return <img src={url} alt={alt} className={className} style={style} />;
}
