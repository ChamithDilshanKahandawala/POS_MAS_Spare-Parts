import { useEffect } from 'react';

// Sets document.title and the <meta name="description"> tag for as long as
// the calling page is mounted, restoring index.html's defaults on unmount.
// No react-helmet (not an approved new dependency) — this is the whole of
// what this app needs: one title, one description, per route.
export default function useDocumentMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    const metaEl = document.querySelector('meta[name="description"]');
    const prevDescription = metaEl?.getAttribute('content') ?? null;

    if (title) document.title = title;
    if (description && metaEl) metaEl.setAttribute('content', description);

    return () => {
      document.title = prevTitle;
      if (prevDescription != null && metaEl) metaEl.setAttribute('content', prevDescription);
    };
  }, [title, description]);
}
