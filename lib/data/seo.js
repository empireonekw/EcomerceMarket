import 'server-only';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { categoryHref, descendantIds } from '@/lib/category-tree';
import { getCategories } from '@/lib/data/categories';
import { siteConfig } from '@/lib/site';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';
import User from '@/models/User';

// The SEO catalog: one cached snapshot of what search engines should see (live products, categories that have
// listings, shops with listings, tags and the programmatic "collections"), refreshed at most hourly. Sitemaps, the
// collection pages and the HTML sitemap all read it, so they always agree on what exists.

export const absoluteUrl = (path) => (/^https?:\/\//.test(path) ? path : `${siteConfig.url}${path.startsWith('/') ? '' : '/'}${path}`);

// ---- Collections: programmatic landing pages ------------------------------------------------------------------------
// A collection = a scope (the whole store, or one main / sub-category) × a modifier (free, under $5, commercial use…).
// Quality gates (thin content and index bloat): at least MIN_LISTINGS listings; for a category, not (almost) the same
// listings as the category page itself; not (almost) the same listings as another collection (MAX_OVERLAP); at most
// MAX_COLLECTIONS in all (largest first) so they roll out in batches.
export const COLLECTION_RULES = { MIN_LISTINGS: 6, MAX_SHARE_OF_CATEGORY: 0.9, MAX_OVERLAP: 0.9, MAX_COLLECTIONS: 100 };
// A tag page is indexed (and in the sitemap) only with at least this many listings: thinner ones are near-duplicates.
export const TAG_INDEX_MIN = 5;

const words = (p) => `${p.title} ${(p.tags ?? []).join(' ')} ${p.fileFormat ?? ''}`;
export const MODIFIERS = [
  {
    key: 'free',
    label: 'Free',
    site: { slug: 'free-digital-downloads', name: 'Free digital downloads' },
    name: (c) => `Free ${c} downloads`,
    test: (p) => p.price === 0,
    where: { price: 0 },
    blurb: 'free to download',
  },
  {
    key: 'under-5',
    label: 'Under $5',
    site: { slug: 'digital-downloads-under-5', name: 'Digital downloads under $5' },
    name: (c) => `${c} downloads under $5`,
    test: (p) => p.price > 0 && p.price <= 500,
    where: { price: { $gt: 0, $lte: 500 } },
    blurb: 'priced at $5 or less',
  },
  {
    key: 'commercial-use',
    label: 'Commercial use',
    site: { slug: 'commercial-use-digital-products', name: 'Digital products for commercial use' },
    name: (c) => `${c} for commercial use`,
    test: (p) => p.license === 'commercial',
    where: { license: 'commercial' },
    blurb: 'licensed for personal and commercial use',
  },
  {
    key: 'editable-canva',
    label: 'Editable in Canva',
    site: { slug: 'editable-canva-templates', name: 'Editable Canva templates' },
    name: (c) => `Editable Canva ${c} templates`,
    redundant: /\bcanva\b/i,
    test: (p) => /\bcanva\b/i.test(words(p)),
    where: { $or: [{ title: /\bcanva\b/i }, { tags: /\bcanva\b/i }, { fileFormat: /\bcanva\b/i }] },
    blurb: 'editable in Canva',
  },
  {
    key: 'printable',
    label: 'Printable',
    site: { slug: 'printables', name: 'Printables' },
    name: (c) => `${c} printables`,
    redundant: /\bprint/i,
    test: (p) => /\bprintables?\b/i.test(words(p)),
    where: { $or: [{ title: /\bprintables?\b/i }, { tags: /\bprintables?\b/i }] },
    blurb: 'ready to print at home',
  },
  {
    key: 'spreadsheet',
    label: 'Excel & Google Sheets',
    site: { slug: 'spreadsheet-templates', name: 'Spreadsheet templates (Excel & Google Sheets)' },
    name: (c) => `${c} spreadsheets`,
    redundant: /\b(spreadsheet|excel|sheets?)\b/i,
    test: (p) => /\b(excel|google sheets?|spreadsheets?|xlsx)\b/i.test(words(p)),
    where: { $or: [{ title: /\b(excel|google sheets?|spreadsheets?|xlsx)\b/i }, { tags: /\b(excel|google sheets?|spreadsheets?|xlsx)\b/i }] },
    blurb: 'for Excel or Google Sheets',
  },
];
export const modifierOf = (key) => MODIFIERS.find((m) => m.key === key);

/**
 * "wedding" → "Wedding", "art & collectibles" → "Art & Collectibles" (category names are typed by hand), without stray
 * punctuation at the end ("Art & Collectibles |").
 */
const titleCase = (s) =>
  String(s)
    .trim()
    .replace(/[\s|,;:\-–—/]+$/, '')
    .replace(/(^|[\s/(-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function loadCatalog() {
  await connectDB();
  const [products, categories, shops, tagRows] = await Promise.all([
    Product.find(PUBLIC_PRODUCT_FILTER)
      .select('slug title price license tags category sellerId updatedAt coverImage fileFormat')
      .sort({ updatedAt: -1 })
      .limit(50000)
      .lean(),
    getCategories(),
    User.find({ role: 'seller', 'seller.storeName': { $type: 'string' }, blockedAt: { $exists: false } })
      .select('seller.storeName updatedAt')
      .lean(),
    // Tag pages with at least TAG_INDEX_MIN listings (the tag page noindexes thinner ones).
    Product.aggregate([
      { $match: PUBLIC_PRODUCT_FILTER },
      { $unwind: '$tags' },
      { $match: { tags: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$tags', count: { $sum: 1 }, updatedAt: { $max: '$updatedAt' } } },
      { $match: { count: { $gte: TAG_INDEX_MIN } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5000 },
    ]),
  ]);
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  // Each product's category and every category above it (a listing counts towards all of them).
  const chainOf = (categoryId) => {
    const c = byId.get(String(categoryId));
    return c ? [String(c._id), ...(c.ancestors ?? []).map(String)] : [];
  };
  const mainOf = (categoryId) => {
    const c = byId.get(String(categoryId));
    if (!c) return null;
    return c.parent ? String((c.ancestors ?? [])[0] ?? c._id) : String(c._id);
  };

  // Shops with at least one live listing, and when they last changed.
  const live = new Map();
  for (const p of products) {
    if (!p.sellerId) continue;
    const id = String(p.sellerId);
    const prev = live.get(id);
    if (!prev || p.updatedAt > prev) live.set(id, p.updatedAt);
  }
  const shopList = shops
    .filter((s) => live.has(String(s._id)))
    .map((s) => ({ id: String(s._id), name: s.seller.storeName, updatedAt: live.get(String(s._id)) }));

  // Categories with listings (directly or below), with their newest listing date.
  const latestIn = new Map();
  for (const p of products)
    for (const id of chainOf(p.category)) if (!latestIn.has(id) || p.updatedAt > latestIn.get(id)) latestIn.set(id, p.updatedAt);
  const liveCategories = categories
    .filter((c) => (c.totalCount ?? 0) > 0)
    .map((c) => ({
      id: String(c._id),
      name: c.name,
      path: c.path ?? c.name,
      href: categoryHref(c),
      depth: c.depth ?? 0,
      parent: c.parent ? String(c.parent) : null,
      main: c.parent ? String((c.ancestors ?? [])[0]) : String(c._id),
      mainSlug: byId.get(c.parent ? String((c.ancestors ?? [])[0]) : String(c._id))?.slug ?? 'other',
      total: c.totalCount,
      updatedAt: latestIn.get(String(c._id)) ?? null,
    }));

  // ---- Collections ----
  const candidates = [];
  const scopes = [
    { id: null, name: null, slug: null, total: products.length, depth: -1 },
    ...liveCategories.filter((c) => c.depth <= 1).map((c) => ({ ...c, slug: byId.get(c.id)?.slug })),
  ];
  // Two sub-categories can share a slug ("digital" under two parents): those get their parent's slug in front.
  const slugCount = new Map();
  for (const s of scopes) if (s.slug) slugCount.set(s.slug, (slugCount.get(s.slug) ?? 0) + 1);
  for (const scope of scopes) {
    const inScope = scope.id ? products.filter((p) => chainOf(p.category).includes(scope.id)) : products;
    for (const m of MODIFIERS) {
      if (scope.name && m.redundant?.test(scope.name)) continue; // "Prints" + printable would read "Prints printables"
      const hits = inScope.filter(m.test);
      if (hits.length < COLLECTION_RULES.MIN_LISTINGS) continue;
      if (scope.id && hits.length > scope.total * COLLECTION_RULES.MAX_SHARE_OF_CATEGORY) continue; // the category page already covers it
      // Only a sub-category takes its parent's slug when two scopes share one (a main category keeps its own).
      const scopeSlug = scope.slug && scope.parent && slugCount.get(scope.slug) > 1 ? `${byId.get(scope.parent)?.slug}-${scope.slug}` : scope.slug;
      const slug = scope.id ? slugify(`${m.key}-${scopeSlug}`) : m.site.slug;
      candidates.push({
        slug,
        name: scope.id ? m.name(titleCase(scope.name)) : m.site.name,
        modifier: m.key,
        categoryId: scope.id,
        categoryName: scope.name ? titleCase(scope.name) : null,
        categoryHref: scope.href ?? null,
        mainSlug: scope.mainSlug ?? null,
        count: hits.length,
        shops: new Set(hits.map((p) => String(p.sellerId ?? 'platform'))).size,
        updatedAt: hits.reduce((d, p) => (p.updatedAt > d ? p.updatedAt : d), hits[0].updatedAt),
        ids: new Set(hits.map((p) => p.slug)),
      });
    }
  }
  // Store-wide collections first, then the biggest category ones. A candidate whose listings are (almost) the same as
  // one already kept (a category and its only sub-category, "Digital" inside "Digital"…) would be a duplicate page.
  const overlap = (a, b) => {
    let both = 0;
    for (const id of a) if (b.has(id)) both += 1;
    return both / (a.size + b.size - both);
  };
  const kept = [];
  for (const c of candidates.sort((a, b) => (a.categoryId === null ? 0 : 1) - (b.categoryId === null ? 0 : 1) || b.count - a.count)) {
    if (kept.length >= COLLECTION_RULES.MAX_COLLECTIONS) break;
    // Same listings, same URL or the same heading as a page already kept: a duplicate.
    if (kept.some((k) => k.slug === c.slug || k.name.toLowerCase() === c.name.toLowerCase() || overlap(k.ids, c.ids) >= COLLECTION_RULES.MAX_OVERLAP))
      continue;
    kept.push(c);
  }
  const collections = kept.map(({ ids: _ids, ...c }) => c);

  return {
    products: products.map((p) => ({
      slug: p.slug,
      title: p.title,
      updatedAt: p.updatedAt,
      coverImage: p.coverImage ?? null,
      mainSlug: byId.get(mainOf(p.category))?.slug ?? 'other',
    })),
    categories: liveCategories,
    shops: shopList,
    tags: tagRows.map((t) => ({ tag: t._id, count: t.count, updatedAt: t.updatedAt })),
    collections,
    generatedAt: new Date().toISOString(),
  };
}

const cachedCatalog = unstable_cache(loadCatalog, ['seo:catalog:v7'], { revalidate: 3600, tags: ['categories', 'seo'] });

/** The SEO catalog (plain JSON; dates as ISO strings). */
export async function getSeoCatalog() {
  return JSON.parse(JSON.stringify(await cachedCatalog()));
}

/** One collection by slug, or null. */
export async function getCollection(slug) {
  const { collections } = await getSeoCatalog();
  return collections.find((c) => c.slug === slug) ?? null;
}

/** The MongoDB filter for a collection's listings (combined with the category scope by getProducts). */
export function collectionWhere(collection) {
  return modifierOf(collection.modifier)?.where ?? {};
}

/**
 * Facts about a collection's listings, for its page copy and FAQ: price range, average, top formats and tags, and the
 * shops with the most listings in it. All real numbers, so no two pages read alike. Cached per request (the page
 * and its metadata share one set of queries). A category collection covers its category and everything below it.
 */
export const getCollectionFacts = cache(async (slug) => {
  const collection = await getCollection(slug);
  if (!collection) return null;
  const categoryIds = collection.categoryId
    ? [collection.categoryId, ...[...descendantIds(collection.categoryId, await getCategories())].map(String)]
    : null;
  await connectDB();
  const match = {
    ...PUBLIC_PRODUCT_FILTER,
    ...collectionWhere(collection),
    ...(categoryIds && { category: { $in: categoryIds.map((id) => new mongoose.Types.ObjectId(id)) } }),
  };
  const [prices, formats, tags, shops] = await Promise.all([
    Product.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          min: { $min: '$price' },
          max: { $max: '$price' },
          avg: { $avg: '$price' },
          free: { $sum: { $cond: [{ $eq: ['$price', 0] }, 1, 0] } },
          commercial: { $sum: { $cond: [{ $eq: ['$license', 'commercial'] }, 1, 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
    Product.aggregate([
      { $match: { ...match, fileFormat: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$fileFormat', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 4 },
    ]),
    Product.aggregate([
      { $match: match },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', n: { $sum: 1 } } },
      { $match: { n: { $gte: 2 } } },
      { $sort: { n: -1 } },
      { $limit: 12 },
    ]),
    Product.aggregate([
      { $match: { ...match, sellerId: { $ne: null } } },
      { $group: { _id: '$sellerId', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { 'seller.storeName': 1 } }] } },
      { $unwind: '$u' },
    ]),
  ]);
  const p = prices[0] ?? { min: 0, max: 0, avg: 0, free: 0, commercial: 0, count: 0 };
  return {
    count: p.count,
    minPrice: p.min,
    maxPrice: p.max,
    avgPrice: Math.round(p.avg ?? 0),
    free: p.free,
    commercial: p.commercial,
    formats: formats.map((f) => ({ format: f._id, count: f.n })),
    tags: tags.map((t) => ({ tag: t._id, count: t.n })),
    shops: shops.map((s) => ({ id: String(s._id), name: s.u.seller?.storeName, count: s.n })),
  };
});
