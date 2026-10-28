// Mirrors storefront/src/i18n/loadFonts.js — injects the Google Fonts
// <link> for a language's script on first use only, English never
// loads either. font-display:swap keeps text visible (fallback font)
// while it loads instead of blocking render.
//
// Pre-existing gap this fixes: console's CSS already declared
// "Noto Sans Sinhala"/"Noto Sans Tamil" font-family rules (index.css),
// but nothing ever actually loaded those fonts — si/ta text was
// silently falling back to the OS's default font the whole time.
// Wiring this up (called from setLanguage() in ./index.js) is part of
// the design refresh's typography work, not a behaviour change: the
// CSS already asked for these fonts, this just makes that request
// real, the same way storefront already does it.
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
