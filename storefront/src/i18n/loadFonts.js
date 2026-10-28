// Injects the Google Fonts <link> for a language's script on first use only
// — English never loads either font; switching to si/ta for the first time
// in a session fetches exactly one stylesheet, never both. font-display:swap
// keeps text visible (in the fallback font) while it loads instead of
// blocking render.
//
// Design refresh — each href now fetches TWO families in one request:
// Noto Sans (body, as before) and Noto Serif (headings, matching the
// Obsidian & Champagne direction's serif heading style — see
// src/index.css's h1-h6/.page-title rules). Still exactly one
// stylesheet fetch per language, still never loaded for English.
const FONT_HREF = {
  si: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700;800;900&family=Noto+Serif+Sinhala:wght@600;700&display=swap',
  ta: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800;900&family=Noto+Serif+Tamil:wght@600;700&display=swap',
};

const loaded = new Set();

export function ensureFontLoaded(lang) {
  const href = FONT_HREF[lang];
  if (!href || loaded.has(lang)) return;
  loaded.add(lang);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.lang = lang;
  document.head.appendChild(link);
}
