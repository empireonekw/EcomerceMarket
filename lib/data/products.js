import 'server-only';
import { cache } from 'react';
import { connectDB } from '@/lib/mongodb';
import { PRODUCT_SORTS, DEFAULT_PAGE_SIZE, escapeRegex, searchTokens, toPlain } from '@/lib/utils';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';
import Category from '@/models/Category';
import { getCategories } from '@/lib/data/categories';

// Lean projections: only what each view actually renders. downloadUrl is select:false on the schema.
const CARD_FIELDS = 'title slug shortDescription price compareAtPrice currency category coverImage coverBlurDataURL tags fileFormat deliveryType salesCount';
const DETAIL_FIELDS = `${CARD_FIELDS} description fileSize createdAt updatedAt`;
const CATEGORY_FIELDS = 'name slug';

const emptyPage = (page, limit) => ({
  items: [],
  pagination: { page, limit, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: page > 1 },
});

/**
 * Search filter shared by the product listing (/products?q=) and live autocomplete (/api/search),
 * so "View all N results" always lands on exactly those N results.
 * Every word must match the START of a word in the title, tags, summary, file format or category
 * name — "pdf play" finds a PDF playbook, "temp" finds everything in Templates — which, unlike $text,
 * works while the user is still typing. Categories come from the cached list (no extra DB query).
 */
async function buildSearchFilter(query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return {};
  const categories = await getCategories();
  return {
    $and: tokens.map((token) => {
      const rx = new RegExp(`\\b${escapeRegex(token)}`, 'i');
      const categoryIds = categories.filter((c) => rx.test(c.name)).map((c) => c._id);
      const anyOf = [{ title: rx }, { tags: rx }, { shortDescription: rx }, { fileFormat: rx }];
      if (categoryIds.length) anyOf.push({ category: { $in: categoryIds } });
      return { $or: anyOf };
    }),
  };
}

/**
 * Paginated, filtered product listing.
 * @param {{ page?: number, limit?: number, category?: string, tag?: string, q?: string, sort?: string }} opts
 */
export async function getProducts({ page = 1, limit = DEFAULT_PAGE_SIZE, category, tag, q, sort = 'newest' } = {}) {
  await connectDB();

  const filter = { ...PUBLIC_PRODUCT_FILTER };

  if (category) {
    const cat = await Category.findOne({ slug: category, isActive: true }).select('_id').lean();
    if (!cat) return emptyPage(page, limit);
    filter.category = cat._id;
  }
  if (tag) filter.tags = tag;
  Object.assign(filter, await buildSearchFilter(q));

  // Searches without an explicit sort show the most popular matches first.
  const sortSpec = PRODUCT_SORTS[q && sort === 'newest' ? 'popular' : sort].sort;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .select(CARD_FIELDS)
      .populate('category', CATEGORY_FIELDS)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    items: toPlain(items),
    pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  };
}

/**
 * Live-search suggestions: the best `limit` matches plus the total match count.
 * Candidates come back by popularity, then titles that start with the query rank first,
 * then titles where every word matches, then matches only in tags/summary.
 */
export async function searchProducts(query, limit = 6) {
  const tokens = searchTokens(query);
  if (!tokens.length) return { items: [], total: 0 };
  await connectDB();

  const filter = { ...PUBLIC_PRODUCT_FILTER, ...(await buildSearchFilter(query)) };
  const [candidates, total] = await Promise.all([
    Product.find(filter)
      .select('title slug price currency coverImage category')
      .populate('category', CATEGORY_FIELDS)
      .sort(PRODUCT_SORTS.popular.sort)
      .limit(limit * 4)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const phrase = tokens.join(' ');
  const rank = ({ title }) => {
    const t = title.toLowerCase();
    if (t.startsWith(phrase)) return 0;
    return tokens.every((tok) => new RegExp(`\\b${escapeRegex(tok)}`).test(t)) ? 1 : 2;
  };
  const items = candidates
    .map((p, i) => ({ p, r: rank(p), i }))
    .sort((a, b) => a.r - b.r || a.i - b.i) // stable: popularity order within each rank
    .slice(0, limit)
    .map(({ p }) => p);

  return { items: toPlain(items), total };
}

/** Single product by slug. Wrapped in React `cache` so generateMetadata + page share one query. */
export const getProductBySlug = cache(async (slug) => {
  await connectDB();
  const product = await Product.findOne({ slug: String(slug).toLowerCase(), ...PUBLIC_PRODUCT_FILTER })
    .select(DETAIL_FIELDS)
    .populate('category', CATEGORY_FIELDS)
    .lean();
  return product ? toPlain(product) : null;
});

export const getProductById = cache(async (id) => {
  await connectDB();
  const product = await Product.findOne({ _id: id, ...PUBLIC_PRODUCT_FILTER })
    .select(DETAIL_FIELDS)
    .populate('category', CATEGORY_FIELDS)
    .lean();
  return product ? toPlain(product) : null;
});

export async function getFeaturedProducts(limit = 8) {
  await connectDB();
  let items = await Product.find({ ...PUBLIC_PRODUCT_FILTER, isFeatured: true })
    .select(CARD_FIELDS)
    .populate('category', CATEGORY_FIELDS)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Fall back to newest products when nothing is flagged as featured yet.
  if (items.length === 0) {
    items = await Product.find(PUBLIC_PRODUCT_FILTER)
      .select(CARD_FIELDS)
      .populate('category', CATEGORY_FIELDS)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
  return toPlain(items);
}

/** Same-category best sellers first; topped up with popular items from elsewhere if the category is small. */
export async function getRelatedProducts(product, limit = 4) {
  if (!product?._id) return [];
  await connectDB();

  const query = (filter, n) =>
    Product.find({ ...PUBLIC_PRODUCT_FILTER, ...filter })
      .select(CARD_FIELDS)
      .populate('category', CATEGORY_FIELDS)
      .sort({ salesCount: -1, createdAt: -1 })
      .limit(n)
      .lean();

  const sameCategory = product.category?._id
    ? await query({ category: product.category._id, _id: { $ne: product._id } }, limit)
    : [];
  if (sameCategory.length >= limit) return toPlain(sameCategory);

  const exclude = [product._id, ...sameCategory.map((p) => p._id)];
  const fill = await query({ _id: { $nin: exclude } }, limit - sameCategory.length);
  return toPlain([...sameCategory, ...fill]);
}

