import { useEffect, useState } from 'react';
import { isMarketplace } from '../api/dataSource';
import { getSiteContent } from '../api/marketplaceServices';

// Published announcement, banners and info pages from Admin → Content. One
// fetch per page load, shared by every caller. null until loaded (or in pos
// mode, or if the request fails) — callers fall back to built-in copy.
let cache = null;
let inFlight = null;

export default function useSiteContent() {
  const [content, setContent] = useState(cache);

  useEffect(() => {
    if (cache || !isMarketplace) return;
    inFlight = inFlight || getSiteContent().then(({ data }) => { cache = data; return data; });
    inFlight.then(setContent).catch(() => { inFlight = null; });
  }, []);

  return content;
}

// Picks the reader's language, falling back to English, then to null.
export function pickLocalized(value, language) {
  if (!value) return null;
  return value[language]?.trim() || value.en?.trim() || null;
}

// A published info page in the reader's language, or null to use the
// page's built-in copy.
export function usePublishedPage(slug, language) {
  const content = useSiteContent();
  const page = content?.pages?.[slug];
  const title = pickLocalized(page?.title, language);
  const body = pickLocalized(page?.body, language);
  return title && body ? { title, body } : null;
}
