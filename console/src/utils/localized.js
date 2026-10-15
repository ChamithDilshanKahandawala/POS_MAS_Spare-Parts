// Reads a {en, si, ta} object in the current UI language, falling back to
// English — every category/field name/label in Milestone 2 is one of
// these, and `en` is the only language the backend requires non-empty.
export function localized(obj, lang) {
  if (!obj) return '';
  return obj[lang]?.trim() ? obj[lang] : obj.en || '';
}
