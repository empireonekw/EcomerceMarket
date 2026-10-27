// Pure helpers — safe to import from models, server code, client code and scripts.

export function slugify(input = '') {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const priceFormatters = new Map();

/**
 * Prices are stored as integer cents to avoid floating-point rounding errors.
 * Whole amounts render without decimals ("$25"); anything else always shows two ("$2.50", not "$2.5").
 */
export function formatPrice(cents, currency = 'USD') {
  const value = cents ?? 0;
  const decimals = value % 100 === 0 ? 0 : 2;
  const key = `${currency}:${decimals}`;
  if (!priceFormatters.has(key)) {
    priceFormatters.set(
      key,
      new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
    );
  }
  return priceFormatters.get(key).format(value / 100);
}

export function formatFileSize(bytes) {
  if (!bytes) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const PRODUCT_SORTS = {
  newest: { label: 'Newest', sort: { createdAt: -1 } },
  popular: { label: 'Popular', sort: { salesCount: -1, createdAt: -1 } },
  price_asc: { label: 'Price: low to high', sort: { price: 1, createdAt: -1 } },
  price_desc: { label: 'Price: high to low', sort: { price: -1, createdAt: -1 } },
};

/** True when a product is delivered as an access link (external delivery, or Figma / Notion templates). */
export const isAccessLink = ({ deliveryType, fileFormat } = {}) => deliveryType === 'external' || /\b(figma|notion)\b/i.test(fileFormat ?? '');

/** Buyer-facing delivery wording, shared by cards, the product page and the cart. */
export const deliveryLabel = (product) => (isAccessLink(product) ? 'Instant access link' : 'Instant digital download');

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Normalise product listing params from either URLSearchParams (route handlers)
 * or the plain `searchParams` object a page receives.
 */
export function parseProductQuery(params = {}) {
  const get = (key) => {
    const v = typeof params.get === 'function' ? params.get(key) : params[key];
    return (Array.isArray(v) ? v[0] : v)?.toString().trim() || undefined;
  };

  const rawSort = get('sort')?.toLowerCase();
  const sort = SORT_ALIASES[rawSort] ?? rawSort;
  return {
    page: toInt(get('page'), 1),
    limit: Math.min(toInt(get('limit'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    category: get('category')?.toLowerCase(),
    tag: get('tag')?.toLowerCase(),
    q: get('q')?.slice(0, 100),
    sort: sort && PRODUCT_SORTS[sort] ? sort : 'newest',
  };
}

// Friendly API spellings → canonical sort keys.
const SORT_ALIASES = {
  price: 'price_asc',
  'price-asc': 'price_asc',
  '-price': 'price_desc',
  'price-desc': 'price_desc',
  latest: 'newest',
  '-createdat': 'newest',
};

/** Neutral fallback for next/image `blurDataURL` when a product has no generated blur yet. */
export const NEUTRAL_BLUR_DATA_URL =
  'data:image/svg+xml;base64,' +
  btoa('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#e7e5e4"/></svg>');

/** How a person is named in public (reviews): "Sarah Mitchell" → "Sarah M.", "Sarah" → "Sarah". */
export function publicName(name) {
  const [first = '', ...rest] = String(name ?? '').trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits a search query into at most 5 lowercase words. Shared by the server-side filter and the
 * client-side match highlighting, so what's highlighted is exactly what matched.
 */
export function searchTokens(query) {
  return String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((t) => t.slice(0, 40));
}

/** Converts lean Mongoose docs (ObjectIds, Dates) into plain JSON-safe objects. */
export function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}
