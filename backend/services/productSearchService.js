const Product = require('../models/Product');
const {
  normalizeSearchText,
  tokenizeSearchText,
  buildSearchPrefixes,
  buildNGrams,
  escapeRegex,
} = require('../utils/productSearch');

const ATLAS_SEARCH_INDEX = process.env.MONGODB_ATLAS_SEARCH_INDEX || 'product_search_index';
const ATLAS_SEARCH_ENABLED = ['1', 'true', 'yes'].includes(String(process.env.USE_ATLAS_SEARCH || '').toLowerCase())
  || Boolean(process.env.MONGODB_ATLAS_SEARCH_INDEX);

function toSafeInt(value, fallback, maxValue) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, maxValue));
}

function buildBaseMatch({ category, lowStock }) {
  const match = { is_active: true };

  if (category && category !== 'All') {
    match.category = category;
  }

  if (lowStock === 'true') {
    match.$expr = { $lte: ['$stock_quantity', '$low_stock_threshold'] };
  }

  return match;
}

function buildAtlasPipeline({ query, category, lowStock, page, limit }) {
  const searchQuery = normalizeSearchText(query);
  const skip = (page - 1) * limit;
  const shouldClauses = [];
  const filterClauses = [{ equals: { path: 'is_active', value: true } }];

  if (category && category !== 'All') {
    filterClauses.push({ equals: { path: 'category', value: category } });
  }

  if (searchQuery.length > 0) {
    const fuzzy = { maxEdits: 1, prefixLength: 2 };
    shouldClauses.push({ autocomplete: { query: searchQuery, path: 'name', fuzzy } });
    shouldClauses.push({ autocomplete: { query: searchQuery, path: 'sku_code', fuzzy } });
    shouldClauses.push({ autocomplete: { query: searchQuery, path: 'barcode', fuzzy } });
    shouldClauses.push({ autocomplete: { query: searchQuery, path: 'brand', fuzzy } });
    shouldClauses.push({ autocomplete: { query: searchQuery, path: 'category', fuzzy } });
    shouldClauses.push({ autocomplete: { query: searchQuery, path: 'sub_category', fuzzy } });
    shouldClauses.push({ text: { query: searchQuery, path: ['tags', 'description'], fuzzy: { maxEdits: 1 } } });
  }

  const pipeline = [
    {
      $search: {
        index: ATLAS_SEARCH_INDEX,
        compound: {
          filter: filterClauses,
          should: shouldClauses.length > 0 ? shouldClauses : [{ exists: { path: 'name' } }],
          minimumShouldMatch: 1,
        },
      },
    },
    { $addFields: { relevance: { $meta: 'searchScore' } } },
  ];

  if (lowStock === 'true') {
    pipeline.push({ $match: { $expr: { $lte: ['$stock_quantity', '$low_stock_threshold'] } } });
  }

  pipeline.push(
    { $sort: { relevance: -1, updatedAt: -1 } },
    {
      $facet: {
        results: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  );

  return pipeline;
}

function buildFallbackPipeline({ query, category, lowStock, page, limit }) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(normalizedQuery);
  const queryPrefixes = buildSearchPrefixes(queryTokens);
  const queryNGrams = buildNGrams(normalizedQuery);
  const escapedQuery = escapeRegex(normalizedQuery);
  const skip = (page - 1) * limit;

  const baseMatch = buildBaseMatch({ category, lowStock });

  const pipeline = [
    { $match: baseMatch },
    {
      $addFields: {
        normalizedName: { $toLower: '$name' },
        normalizedSku: { $toLower: '$sku_code' },
        normalizedBarcode: { $toLower: { $ifNull: ['$barcode', ''] } },
        normalizedBrand: { $toLower: { $ifNull: ['$brand', ''] } },
        normalizedCategory: { $toLower: '$category' },
        normalizedSubCategory: { $toLower: { $ifNull: ['$sub_category', ''] } },
        normalizedSupplier: { $toLower: { $ifNull: ['$supplier', ''] } },
        normalizedDescription: { $toLower: { $ifNull: ['$description', ''] } },
        normalizedTagsText: {
          $toLower: {
            $reduce: {
              input: { $ifNull: ['$tags', []] },
              initialValue: '',
              in: { $concat: ['$$value', ' ', '$$this'] },
            },
          },
        },
      },
    },
  ];

  if (normalizedQuery.length > 0) {
    pipeline.push({
      $match: {
        $or: [
          { search_terms: { $in: queryPrefixes } },
          { search_ngrams: { $in: queryNGrams } },
          { normalizedName: { $regex: escapedQuery, $options: 'i' } },
          { normalizedSku: { $regex: escapedQuery, $options: 'i' } },
          { normalizedBarcode: { $regex: escapedQuery, $options: 'i' } },
          { normalizedBrand: { $regex: escapedQuery, $options: 'i' } },
          { normalizedCategory: { $regex: escapedQuery, $options: 'i' } },
          { normalizedSubCategory: { $regex: escapedQuery, $options: 'i' } },
          { normalizedSupplier: { $regex: escapedQuery, $options: 'i' } },
          { normalizedDescription: { $regex: escapedQuery, $options: 'i' } },
          { normalizedTagsText: { $regex: escapedQuery, $options: 'i' } },
        ],
      },
    });

    pipeline.push({
      $addFields: {
        exactName: { $cond: [{ $eq: ['$normalizedName', normalizedQuery] }, 140, 0] },
        exactSku: { $cond: [{ $eq: ['$normalizedSku', normalizedQuery] }, 200, 0] },
        exactBarcode: { $cond: [{ $eq: ['$normalizedBarcode', normalizedQuery] }, 180, 0] },
        exactBrand: { $cond: [{ $eq: ['$normalizedBrand', normalizedQuery] }, 120, 0] },
        prefixName: { $cond: [{ $regexMatch: { input: '$normalizedName', regex: `^${escapedQuery}` } }, 100, 0] },
        prefixSku: { $cond: [{ $regexMatch: { input: '$normalizedSku', regex: `^${escapedQuery}` } }, 130, 0] },
        prefixBarcode: { $cond: [{ $regexMatch: { input: '$normalizedBarcode', regex: `^${escapedQuery}` } }, 125, 0] },
        prefixBrand: { $cond: [{ $regexMatch: { input: '$normalizedBrand', regex: `^${escapedQuery}` } }, 90, 0] },
        prefixCategory: { $cond: [{ $regexMatch: { input: '$normalizedCategory', regex: `^${escapedQuery}` } }, 75, 0] },
        containsName: { $cond: [{ $regexMatch: { input: '$normalizedName', regex: escapedQuery } }, 60, 0] },
        containsDescription: { $cond: [{ $regexMatch: { input: '$normalizedDescription', regex: escapedQuery } }, 12, 0] },
        termOverlap: { $size: { $setIntersection: [{ $ifNull: ['$search_terms', []] }, queryPrefixes] } },
        ngramOverlap: { $size: { $setIntersection: [{ $ifNull: ['$search_ngrams', []] }, queryNGrams] } },
      },
    });

    pipeline.push({
      $addFields: {
        relevance: {
          $add: [
            '$exactSku',
            '$exactBarcode',
            '$exactName',
            '$exactBrand',
            '$prefixSku',
            '$prefixBarcode',
            '$prefixName',
            '$prefixBrand',
            '$prefixCategory',
            '$containsName',
            '$containsDescription',
            { $multiply: ['$termOverlap', 12] },
            { $multiply: ['$ngramOverlap', 6] },
          ],
        },
      },
    });

    pipeline.push({ $match: { relevance: { $gt: 0 } } });
    pipeline.push({ $sort: { relevance: -1, updatedAt: -1 } });
  } else {
    pipeline.push({ $sort: { updatedAt: -1 } });
  }

  pipeline.push({
    $facet: {
      results: [{ $skip: skip }, { $limit: limit }],
      total: [{ $count: 'count' }],
    },
  });

  return pipeline;
}

async function executeProductSearch({ query, category, lowStock, page = 1, limit = 10 }) {
  const safePage = toSafeInt(page, 1, 100000);
  const safeLimit = toSafeInt(limit, 10, 50);
  const searchQuery = normalizeSearchText(query);

  if (!searchQuery) {
    return { products: [], total: 0, page: safePage, pages: 0 };
  }

  const pipelineFactory = ATLAS_SEARCH_ENABLED
    ? buildAtlasPipeline({ query: searchQuery, category, lowStock, page: safePage, limit: safeLimit })
    : buildFallbackPipeline({ query: searchQuery, category, lowStock, page: safePage, limit: safeLimit });

  try {
    const [result] = await Product.aggregate(pipelineFactory);
    const total = result?.total?.[0]?.count || 0;
    const products = result?.results || [];

    return {
      products,
      total,
      page: safePage,
      pages: Math.ceil(total / safeLimit),
    };
  } catch (error) {
    if (ATLAS_SEARCH_ENABLED) {
      const [fallbackResult] = await Product.aggregate(
        buildFallbackPipeline({ query: searchQuery, category, lowStock, page: safePage, limit: safeLimit }),
      );
      const total = fallbackResult?.total?.[0]?.count || 0;
      const products = fallbackResult?.results || [];

      return {
        products,
        total,
        page: safePage,
        pages: Math.ceil(total / safeLimit),
      };
    }

    throw error;
  }
}

module.exports = {
  executeProductSearch,
  buildAtlasPipeline,
  buildFallbackPipeline,
  buildBaseMatch,
};