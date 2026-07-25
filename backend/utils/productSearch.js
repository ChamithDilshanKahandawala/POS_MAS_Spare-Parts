const SEARCHABLE_PRODUCT_FIELDS = ['name', 'sku_code', 'barcode', 'brand', 'category', 'sub_category', 'supplier', 'description'];

function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizeSearchText(value = '') {
  const normalized = normalizeSearchText(value);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function buildSearchPrefixes(tokens = []) {
  const prefixes = new Set();

  tokens.forEach((token) => {
    const maxLength = Math.min(token.length, 12);
    for (let length = 2; length <= maxLength; length += 1) {
      prefixes.add(token.slice(0, length));
    }
    prefixes.add(token);
  });

  return [...prefixes];
}

function buildNGrams(value = '', gramSize = 3) {
  const compact = normalizeSearchText(value).replace(/\s+/g, '');
  if (!compact) return [];
  if (compact.length <= gramSize) return [compact];

  const grams = new Set();
  for (let index = 0; index <= compact.length - gramSize; index += 1) {
    grams.add(compact.slice(index, index + gramSize));
  }

  return [...grams];
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildProductSearchDocument(source = {}) {
  const rawTags = Array.isArray(source.tags)
    ? source.tags
    : String(source.tags || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

  const searchableText = normalizeSearchText([
    source.name,
    source.sku_code,
    source.barcode,
    source.brand,
    source.category,
    source.sub_category,
    source.supplier,
    source.description,
    rawTags.join(' '),
  ].filter(Boolean).join(' '));

  const tokens = tokenizeSearchText(searchableText);

  return {
    search_text: searchableText,
    search_terms: buildSearchPrefixes(tokens),
    search_ngrams: buildNGrams(searchableText),
    tags: rawTags,
  };
}

function normalizeProductPayload(payload = {}) {
  const normalizedTags = Array.isArray(payload.tags)
    ? payload.tags
    : String(payload.tags || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

  return {
    ...payload,
    barcode: String(payload.barcode || '').trim(),
    brand: String(payload.brand || '').trim(),
    supplier: String(payload.supplier || '').trim(),
    sub_category: String(payload.sub_category || '').trim(),
    description: String(payload.description || '').trim(),
    tags: normalizedTags,
  };
}

module.exports = {
  SEARCHABLE_PRODUCT_FIELDS,
  normalizeSearchText,
  tokenizeSearchText,
  buildSearchPrefixes,
  buildNGrams,
  escapeRegex,
  buildProductSearchDocument,
  normalizeProductPayload,
};