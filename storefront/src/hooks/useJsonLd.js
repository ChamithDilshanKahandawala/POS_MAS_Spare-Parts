import { useEffect } from 'react';

// Injects a <script type="application/ld+json"> for as long as the calling
// page is mounted. `data` is a plain schema.org object (or array of them).
export default function useJsonLd(data) {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
    return () => script.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);
}
