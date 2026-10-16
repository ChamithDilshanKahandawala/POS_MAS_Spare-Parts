// Automatic checks run on submit (draft -> in_review/published) and on
// any content revision — services/categoryRules.js's getEffectiveCategory
// already resolves the category's effective attributeSchema (incl.
// inherited fields) and merged prohibitedKeywords (platform + category),
// so this module only needs that `effective` object plus the listing
// itself. Pure and synchronous — easy to unit-test and to reuse for both
// "submit a draft" and "revise a published listing".

const TITLE_MIN = 10;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 5000;
const MIN_IMAGES = 1;
const MAX_IMAGES = 8;
const WAS_PRICE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// Sri Lankan mobile formats: "077 123 4567", "+94771234567",
// "0771234567", with optional spaces/dots/dashes as separators.
const PHONE_RE = /(?:\+?94[\s.-]?|0)7\d[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;

function textFields(listing) {
  return {
    title: [listing.title?.en, listing.title?.si, listing.title?.ta],
    description: [listing.description?.en, listing.description?.si, listing.description?.ta],
    brand: [listing.brand],
  };
}

function checkContactInfo(listing, problems) {
  const { title, description } = textFields(listing);
  for (const [field, values] of [['title', title], ['description', description]]) {
    const combined = values.filter(Boolean).join(' ');
    if (PHONE_RE.test(combined)) problems.push({ field, problem: 'Contains what looks like a phone number' });
    if (EMAIL_RE.test(combined)) problems.push({ field, problem: 'Contains what looks like an email address' });
    if (URL_RE.test(combined)) problems.push({ field, problem: 'Contains what looks like a web link' });
  }
}

function checkProhibitedKeywords(listing, keywords, problems) {
  if (!keywords || keywords.length === 0) return;
  const fields = textFields(listing);
  for (const [field, values] of Object.entries(fields)) {
    const combined = values.filter(Boolean).join(' ').toLowerCase();
    if (!combined) continue;
    for (const kw of keywords) {
      if (kw && combined.includes(kw.toLowerCase())) {
        problems.push({ field, problem: `Contains a prohibited word: "${kw}"` });
      }
    }
  }
}

function checkAttributeField(field, value, regulated, problems) {
  const label = field.label?.en || field.key;

  if (field.type === 'fitment') {
    // Fitment lives on the listing's own `fitment` array, not attributes.
    return;
  }

  const isEmpty = value === undefined || value === null || value === ''
    || (Array.isArray(value) && value.length === 0);

  if (field.required && isEmpty) {
    problems.push({ field: `attributes.${field.key}`, problem: `"${label}" is required` });
    return;
  }
  if (isEmpty) return; // optional and not provided — nothing further to check

  switch (field.type) {
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) { problems.push({ field: `attributes.${field.key}`, problem: `"${label}" must be a number` }); break; }
      if (field.min !== null && field.min !== undefined && num < field.min) problems.push({ field: `attributes.${field.key}`, problem: `"${label}" must be at least ${field.min}` });
      if (field.max !== null && field.max !== undefined && num > field.max) problems.push({ field: `attributes.${field.key}`, problem: `"${label}" must be at most ${field.max}` });
      break;
    }
    case 'text': {
      if (field.maxLength && String(value).length > field.maxLength) {
        problems.push({ field: `attributes.${field.key}`, problem: `"${label}" must be ${field.maxLength} characters or fewer` });
      }
      break;
    }
    case 'select': {
      const allowed = (field.options || []).map((o) => o.value);
      if (!allowed.includes(value)) problems.push({ field: `attributes.${field.key}`, problem: `"${label}" has an invalid value` });
      break;
    }
    case 'multiselect': {
      const allowed = (field.options || []).map((o) => o.value);
      const values = Array.isArray(value) ? value : [value];
      if (values.some((v) => !allowed.includes(v))) problems.push({ field: `attributes.${field.key}`, problem: `"${label}" has an invalid value` });
      break;
    }
    case 'date': {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        problems.push({ field: `attributes.${field.key}`, problem: `"${label}" is not a valid date` });
      } else if (regulated && date.getTime() <= Date.now()) {
        problems.push({ field: `attributes.${field.key}`, problem: `"${label}" must be a future date` });
      }
      break;
    }
    default:
      break;
  }
}

function checkCategoryFields(listing, effective, problems) {
  for (const field of effective.attributeSchema || []) {
    if (field.type === 'fitment') {
      if (field.required && (!listing.fitment || listing.fitment.length === 0)) {
        problems.push({ field: 'fitment', problem: 'At least one vehicle fitment is required' });
      }
      continue;
    }
    checkAttributeField(field, listing.attributes?.[field.key], effective.regulated, problems);
  }
}

function warrantyMonths(warranty) {
  if (!warranty || warranty.type === 'none') return 0;
  if (warranty.type === 'months') return warranty.value || 0;
  if (warranty.type === 'days') return (warranty.value || 0) / 30;
  return 0;
}

function checkWarranty(listing, effective, problems) {
  const minMonths = effective.warrantyRule?.minMonths || 0;
  if (minMonths <= 0) return;
  if (warrantyMonths(listing.warranty) < minMonths) {
    problems.push({ field: 'warranty', problem: `This category requires a warranty of at least ${minMonths} month(s)` });
  }
}

function checkWasPrice(listing, problems) {
  if (listing.wasPriceCents === null || listing.wasPriceCents === undefined) return;
  const cutoff = Date.now() - WAS_PRICE_WINDOW_MS;
  const matchesHistory = (listing.priceHistory || []).some(
    (h) => h.priceCents === listing.wasPriceCents && new Date(h.setAt).getTime() >= cutoff
  );
  if (!matchesHistory) {
    problems.push({ field: 'wasPriceCents', problem: 'The "was" price must be a price this listing actually had in the last 30 days' });
  } else if (listing.wasPriceCents <= listing.priceCents) {
    problems.push({ field: 'wasPriceCents', problem: 'The "was" price must be higher than the current price' });
  }
}

// Returns an array of { field, problem } — empty means the listing is
// clean and may move to in_review/published (or have its revision
// accepted). Never throws; a malformed listing just produces problems.
function runListingChecks(listing, effective) {
  const problems = [];

  const titleEn = (listing.title?.en || '').trim();
  if (titleEn.length < TITLE_MIN || titleEn.length > TITLE_MAX) {
    problems.push({ field: 'title', problem: `English title must be ${TITLE_MIN}-${TITLE_MAX} characters` });
  }

  const descriptionEn = (listing.description?.en || '').trim();
  if (descriptionEn.length < DESCRIPTION_MIN || descriptionEn.length > DESCRIPTION_MAX) {
    problems.push({ field: 'description', problem: `English description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters` });
  }
  for (const lang of ['si', 'ta']) {
    const text = (listing.description?.[lang] || '');
    if (text && text.length > DESCRIPTION_MAX) {
      problems.push({ field: 'description', problem: `Description (${lang}) must be ${DESCRIPTION_MAX} characters or fewer` });
    }
  }

  const imageCount = (listing.images || []).length;
  if (imageCount < MIN_IMAGES || imageCount > MAX_IMAGES) {
    problems.push({ field: 'images', problem: `Must have between ${MIN_IMAGES} and ${MAX_IMAGES} photos` });
  }

  if (!Number.isInteger(listing.priceCents) || listing.priceCents <= 0) {
    problems.push({ field: 'priceCents', problem: 'Price must be a whole number greater than 0' });
  }
  if (!Number.isInteger(listing.stock) || listing.stock < 0) {
    problems.push({ field: 'stock', problem: 'Stock must be a whole number of 0 or more' });
  }
  if (!(listing.weightGrams > 0)) {
    problems.push({ field: 'weightGrams', problem: 'Weight must be greater than 0' });
  }

  checkProhibitedKeywords(listing, effective.prohibitedKeywords, problems);
  checkContactInfo(listing, problems);
  checkCategoryFields(listing, effective, problems);
  checkWarranty(listing, effective, problems);
  checkWasPrice(listing, problems);

  return problems;
}

module.exports = { runListingChecks, PHONE_RE, EMAIL_RE, URL_RE };
