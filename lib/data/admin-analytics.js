import 'server-only';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { STATS_TIMEZONE, statsDay } from '@/lib/listing-stats';
import { toPlain } from '@/lib/utils';
import Category from '@/models/Category';
import ContactMessage from '@/models/ContactMessage';
import Conversation from '@/models/Conversation';
import ListingStat from '@/models/ListingStat';
import Order from '@/models/Order';
import Payout from '@/models/Payout';
import Product from '@/models/Product';
import Review from '@/models/Review';
import SiteStat from '@/models/SiteStat';
import Transaction from '@/models/Transaction';
import User from '@/models/User';

// Admin dashboard analytics (app/admin/page.js). Every figure is for one date range, in the marketplace timezone,
// next to the same figure for the period of equal length just before it. Demo-checkout (test) orders never count.

const REAL = { paymentProvider: { $ne: 'demo' } };
const NOT_DRAFT = { status: { $ne: 'draft' } };
const DAY_MS = 86_400_000;

export const RANGE_PRESETS = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '14d', label: 'Last 14 days', days: 14 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '12m', label: 'Last 12 months', months: 12 },
];
export const DEFAULT_RANGE = '30d';
const MAX_CUSTOM_DAYS = 366;

// ---- Days and ranges (keys are "YYYY-MM-DD" in STATS_TIMEZONE) ---------------------------------------------------

const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const addMonths = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};

/** Milliseconds STATS_TIMEZONE is ahead of UTC at `date`. */
function tzOffset(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: STATS_TIMEZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - (date.getTime() - date.getMilliseconds());
}
/** The instant a marketplace day starts. */
function dayStart(day) {
  const guess = Date.parse(`${day}T00:00:00Z`);
  return new Date(guess - tzOffset(new Date(guess)));
}

const dayLabel = (day, opts = { month: 'short', day: 'numeric' }) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const monthLabel = (month) => new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });

/**
 * The range from the page's search params: a preset (`range=7d|14d|30d|90d|12m`) or a custom `from`/`to` (days).
 * Returns the buckets to chart (days, or months for 12m), the same number of buckets for the previous period, and the
 * day boundaries of both.
 */
export function parseRange(params = {}) {
  const today = statsDay();
  let from;
  let to = today;
  let preset = RANGE_PRESETS.find((p) => p.key === params.range);
  if (!preset && isDay(params.from) && isDay(params.to)) {
    to = params.to > today ? today : params.to;
    from = params.from > to ? to : params.from;
    if (daysBetween(from, to) >= MAX_CUSTOM_DAYS) from = addDays(to, -(MAX_CUSTOM_DAYS - 1));
  } else {
    preset ??= RANGE_PRESETS.find((p) => p.key === DEFAULT_RANGE);
  }

  if (preset?.months) {
    const thisMonth = today.slice(0, 7);
    const months = Array.from({ length: preset.months }, (_, i) => addMonths(thisMonth, i - preset.months + 1));
    const prevMonths = months.map((m) => addMonths(m, -preset.months));
    return {
      key: preset.key,
      label: preset.label,
      unit: 'month',
      from: `${months[0]}-01`,
      to: today,
      prevFrom: `${prevMonths[0]}-01`,
      prevTo: addDays(`${months[0]}-01`, -1),
      buckets: months.map((m) => ({ key: m, label: monthLabel(m) })),
      prevBuckets: prevMonths.map((m) => ({ key: m, label: monthLabel(m) })),
      compareLabel: 'previous 12 months',
    };
  }

  if (preset) from = addDays(today, -(preset.days - 1));
  const length = daysBetween(from, to) + 1;
  const days = Array.from({ length }, (_, i) => addDays(from, i));
  const prevDays = days.map((d) => addDays(d, -length));
  return {
    key: preset?.key ?? 'custom',
    label: preset?.label ?? `${dayLabel(from, { month: 'short', day: 'numeric', year: 'numeric' })} to ${dayLabel(to, { month: 'short', day: 'numeric', year: 'numeric' })}`,
    unit: 'day',
    from,
    to,
    prevFrom: prevDays[0],
    prevTo: prevDays[length - 1],
    buckets: days.map((d) => ({ key: d, label: dayLabel(d) })),
    prevBuckets: prevDays.map((d) => ({ key: d, label: dayLabel(d) })),
    compareLabel: `previous ${length} day${length === 1 ? '' : 's'}`,
  };
}

// ---- Query helpers -------------------------------------------------------------------------------------------------

const dayOf = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: STATS_TIMEZONE } });

/** Per-day rows → { current: number[], previous: number[] } aligned to the range's buckets, for each value key. */
function toSeries(range, rowsByDay, keys) {
  const bucketOf = (day) => (range.unit === 'month' ? day.slice(0, 7) : day);
  const sum = (buckets) => {
    const index = new Map(buckets.map((b, i) => [b.key, i]));
    const out = Object.fromEntries(keys.map((k) => [k, new Array(buckets.length).fill(0)]));
    for (const [day, row] of rowsByDay) {
      const i = index.get(bucketOf(day));
      if (i === undefined) continue;
      for (const k of keys) out[k][i] += row[k] ?? 0;
    }
    return out;
  };
  const current = sum(range.buckets);
  const previous = sum(range.prevBuckets);
  return Object.fromEntries(keys.map((k) => [k, { current: current[k], previous: previous[k] }]));
}

const total = (arr) => arr.reduce((a, b) => a + b, 0);
const inCurrent = (range, day) => day >= range.from && day <= range.to;

/** Summed counters ({ a: 3, b: 1 }) over the days of the current period. */
function sumCounters(docs, range, field) {
  const out = {};
  for (const d of docs) {
    if (!inCurrent(range, d.day)) continue;
    for (const [k, v] of Object.entries(d[field] ?? {})) out[k] = (out[k] ?? 0) + (Number(v) || 0);
  }
  return out;
}

const lookupProduct = [
  { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'p', pipeline: [{ $project: { title: 1, slug: 1, coverImage: 1 } }] } },
  { $unwind: '$p' },
];

/** Everything the admin dashboard shows for `params` (search params: range, from, to). Admins only. */
export async function getAdminAnalytics(params = {}) {
  await requireAdmin();
  await connectDB();
  const range = parseRange(params);
  const start = dayStart(range.prevFrom);
  const end = dayStart(addDays(range.to, 1));
  const curStart = dayStart(range.from);
  const window = { $gte: start, $lt: end };
  const current = { $gte: curStart, $lt: end };

  const [
    orderRows,
    userRows,
    shopRows,
    listingRows,
    siteDocs,
    listingStatRows,
    reviewCounts,
    topProducts,
    mostViewed,
    topSellers,
    categoryRows,
    sellersByCountry,
    recentOrders,
    recentSignups,
    cohort,
    health,
    firstSiteDay,
  ] = await Promise.all([
    // Orders per day: every order started, and the paid ones with their revenue.
    Order.aggregate([
      { $match: { ...REAL, createdAt: window } },
      {
        $group: {
          _id: dayOf('$createdAt'),
          started: { $sum: 1 },
          orders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totalAmount', 0] } },
        },
      },
    ]),
    // Sign-ups per day, by the role the account has now.
    User.aggregate([
      { $match: { createdAt: window, role: { $ne: 'admin' } } },
      {
        $group: {
          _id: dayOf('$createdAt'),
          signups: { $sum: 1 },
          customers: { $sum: { $cond: [{ $eq: ['$role', 'customer'] }, 1, 0] } },
          sellers: { $sum: { $cond: [{ $eq: ['$role', 'seller'] }, 1, 0] } },
        },
      },
    ]),
    User.aggregate([{ $match: { 'seller.storeSetupAt': window } }, { $group: { _id: dayOf('$seller.storeSetupAt'), shops: { $sum: 1 } } }]),
    Product.aggregate([{ $match: { ...NOT_DRAFT, createdAt: window } }, { $group: { _id: dayOf('$createdAt'), listings: { $sum: 1 } } }]),
    SiteStat.find({ day: { $gte: range.prevFrom, $lte: range.to } }).lean(),
    ListingStat.aggregate([
      { $match: { day: { $gte: range.prevFrom, $lte: range.to } } },
      {
        $group: {
          _id: '$day',
          productViews: { $sum: '$visits' },
          carts: { $sum: '$carts' },
          ...Object.fromEntries(['direct', 'sellpify', 'search_engine', 'facebook', 'instagram', 'pinterest', 'twitter', 'tumblr', 'other'].map((s) => [`src_${s}`, { $sum: `$sources.${s}` }])),
        },
      },
    ]),
    Review.aggregate([
      { $match: { createdAt: window } },
      { $group: { _id: { $gte: ['$createdAt', curStart] }, count: { $sum: 1 }, ratingSum: { $sum: '$rating' } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'sale', product: { $ne: null }, createdAt: current, ...REAL } },
      { $group: { _id: '$product', sold: { $sum: 1 }, gross: { $sum: '$gross' } } },
      { $sort: { sold: -1, gross: -1 } },
      { $limit: 6 },
      ...lookupProduct,
    ]),
    ListingStat.aggregate([
      { $match: { day: { $gte: range.from, $lte: range.to } } },
      { $group: { _id: '$product', views: { $sum: '$visits' }, carts: { $sum: '$carts' } } },
      { $match: { views: { $gt: 0 } } },
      { $sort: { views: -1 } },
      { $limit: 6 },
      ...lookupProduct,
    ]),
    Transaction.aggregate([
      { $match: { type: 'sale', seller: { $ne: null }, createdAt: current, ...REAL } },
      { $group: { _id: '$seller', sales: { $sum: 1 }, gross: { $sum: '$gross' } } },
      { $sort: { gross: -1, sales: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { name: 1, 'seller.storeName': 1 } }] } },
      { $unwind: '$u' },
    ]),
    // New listings in the period by category.
    Product.aggregate([
      { $match: { ...NOT_DRAFT, createdAt: current } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 7 },
    ]),
    User.aggregate([
      { $match: { role: 'seller', 'seller.storeName': { $type: 'string' } } },
      { $group: { _id: { $ifNull: ['$seller.country', 'ZZ'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Order.find(REAL).select('buyerEmail items.title totalAmount currency status paymentStatus paymentProvider createdAt').sort({ createdAt: -1 }).limit(6).lean(),
    User.find({ role: { $ne: 'admin' } }).select('name email role seller.storeName createdAt').sort({ createdAt: -1 }).limit(7).lean(),
    sellerCohort(current),
    healthCounts(),
    SiteStat.findOne().sort({ day: 1 }).select('day').lean(),
  ]);

  // ---- Series ------------------------------------------------------------------------------------------------------
  const byDay = new Map();
  const merge = (rows, key = '_id') => {
    for (const r of rows) {
      const day = r[key];
      if (!day) continue;
      byDay.set(day, { ...(byDay.get(day) ?? {}), ...r });
    }
  };
  merge(orderRows);
  merge(userRows);
  merge(shopRows);
  merge(listingRows);
  merge(listingStatRows);
  merge(siteDocs, 'day');

  const KEYS = ['revenue', 'orders', 'started', 'signups', 'customers', 'sellers', 'shops', 'listings', 'views', 'visitors', 'newVisitors', 'productViews', 'carts'];
  const series = toSeries(range, byDay, KEYS);
  const sum = (k) => total(series[k].current);
  const prevSum = (k) => total(series[k].previous);

  const aov = (orders, revenue) => (orders ? Math.round(revenue / orders) : 0);
  // Paid orders per visitor, over the days that have visitor data only (visitor tracking is newer than orders). Null
  // when there's nothing to go on, or when the counts can't be right yet (more orders than visitors).
  const conversion = (period) => {
    let orders = 0;
    let visitors = 0;
    series.visitors[period].forEach((v, i) => {
      if (v > 0) (visitors += v), (orders += series.orders[period][i]);
    });
    return visitors > 0 && orders <= visitors ? orders / visitors : null;
  };
  const kpis = {
    revenue: { value: sum('revenue'), previous: prevSum('revenue') },
    orders: { value: sum('orders'), previous: prevSum('orders') },
    aov: { value: aov(sum('orders'), sum('revenue')), previous: aov(prevSum('orders'), prevSum('revenue')) },
    visitors: { value: sum('visitors'), previous: prevSum('visitors') },
    views: { value: sum('views'), previous: prevSum('views') },
    signups: { value: sum('signups'), previous: prevSum('signups') },
    shops: { value: sum('shops'), previous: prevSum('shops') },
    listings: { value: sum('listings'), previous: prevSum('listings') },
    productViews: { value: sum('productViews'), previous: prevSum('productViews') },
    conversion: { value: conversion('current'), previous: conversion('previous') },
    reviews: { value: 0, previous: 0, rating: 0 },
  };
  for (const r of reviewCounts) {
    if (r._id) Object.assign(kpis.reviews, { value: r.count, rating: r.count ? r.ratingSum / r.count : 0 });
    else kpis.reviews.previous = r.count;
  }

  // ---- Traffic (storefront visits; before visitor tracking existed, product-page visits) ----------------------------
  const siteSources = sumCounters(siteDocs, range, 'sources');
  const productSources = {};
  for (const r of listingStatRows) {
    if (!inCurrent(range, r._id)) continue;
    for (const [k, v] of Object.entries(r)) if (k.startsWith('src_')) productSources[k.slice(4)] = (productSources[k.slice(4)] ?? 0) + v;
  }
  const hasSiteTraffic = total(Object.values(siteSources)) > 0;

  // ---- Names for the category rows -------------------------------------------------------------------------------
  // Sub-categories can share a name ("Digital" under two parents), so each is labelled "Parent › Name".
  const categories = await Category.find({ _id: { $in: categoryRows.map((c) => c._id).filter(Boolean) } }).select('name parent').lean();
  const parents = await Category.find({ _id: { $in: categories.map((c) => c.parent).filter(Boolean) } }).select('name').lean();
  const parentName = new Map(parents.map((p) => [String(p._id), p.name]));
  const categoryName = new Map(categories.map((c) => [String(c._id), c.parent && parentName.has(String(c.parent)) ? `${parentName.get(String(c.parent))} › ${c.name}` : c.name]));

  return toPlain({
    range: { ...range, tracking: { since: firstSiteDay?.day ?? null } },
    kpis,
    series,
    funnel: [
      { key: 'visitors', label: 'Visitors', value: sum('visitors') },
      { key: 'productViews', label: 'Product views', value: sum('productViews') },
      { key: 'carts', label: 'Added to cart', value: sum('carts') },
      { key: 'started', label: 'Checkout started', value: sum('started') },
      { key: 'orders', label: 'Paid orders', value: sum('orders') },
    ],
    traffic: { source: hasSiteTraffic ? 'site' : 'products', sources: hasSiteTraffic ? siteSources : productSources },
    devices: sumCounters(siteDocs, range, 'devices'),
    sections: sumCounters(siteDocs, range, 'sections'),
    countries: Object.entries(sumCounters(siteDocs, range, 'countries'))
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => ({ code, count })),
    newVisitors: sum('newVisitors'),
    sellersByCountry: sellersByCountry.map((r) => ({ code: r._id, count: r.count })),
    sellerFunnel: cohort,
    topProducts: topProducts.map((r) => ({ id: r._id, title: r.p.title, slug: r.p.slug, coverImage: r.p.coverImage, sold: r.sold, gross: r.gross })),
    mostViewed: mostViewed.map((r) => ({ id: r._id, title: r.p.title, slug: r.p.slug, coverImage: r.p.coverImage, views: r.views, carts: r.carts })),
    topSellers: topSellers.map((r) => ({ id: r._id, name: r.u.seller?.storeName || r.u.name, sales: r.sales, gross: r.gross })),
    categories: categoryRows.map((r) => ({ id: r._id, name: categoryName.get(String(r._id)) ?? 'Uncategorised', count: r.count })),
    recentOrders,
    recentSignups,
    health,
  });
}

/**
 * Of the accounts created in the period that set out to sell (seller accounts, and shoppers who started the shop
 * wizard): how many started the wizard, opened a shop, added payout details, listed something and sold something.
 */
async function sellerCohort(createdAt) {
  const people = await User.aggregate([
    { $match: { createdAt, $or: [{ role: 'seller' }, { sellerOnboarding: { $exists: true } }] } },
    {
      $project: {
        started: { $or: [{ $gt: ['$sellerOnboarding', null] }, { $gt: ['$seller.storeName', null] }] },
        opened: { $gt: ['$seller.storeName', null] },
        payout: {
          $and: [
            { $gt: ['$seller.storeName', null] },
            {
              $or: [
                { $gt: ['$seller.bankDetailsEnc', null] },
                { $gt: [{ $strLenCP: { $ifNull: ['$seller.bankDetails.accountNumber', ''] } }, 0] },
                { $gt: [{ $strLenCP: { $ifNull: ['$seller.bankDetails.walletNumber', ''] } }, 0] },
              ],
            },
          ],
        },
      },
    },
  ]);
  const opened = people.filter((p) => p.opened).map((p) => p._id);
  const [listed, sold] = opened.length
    ? await Promise.all([
        Product.distinct('sellerId', { sellerId: { $in: opened }, ...NOT_DRAFT }),
        Transaction.distinct('seller', { type: 'sale', seller: { $in: opened }, ...REAL }),
      ])
    : [[], []];
  return [
    { key: 'signedUp', label: 'Signed up to sell', value: people.length },
    { key: 'started', label: 'Started shop setup', value: people.filter((p) => p.started).length },
    { key: 'opened', label: 'Opened a shop', value: opened.length },
    { key: 'payout', label: 'Added payout details', value: people.filter((p) => p.payout).length },
    { key: 'listed', label: 'Listed a product', value: listed.length },
    { key: 'sold', label: 'Made a sale', value: sold.length },
  ];
}

/** What needs the team's attention now (not limited to the period). */
async function healthCounts() {
  const noPayout = {
    role: 'seller',
    'seller.storeName': { $type: 'string' },
    'seller.bankDetailsEnc': { $exists: false },
    'seller.bankDetails.accountNumber': { $in: [null, ''] },
    'seller.bankDetails.walletNumber': { $in: [null, ''] },
  };
  const [pendingListings, setupPending, stuckShoppers, payoutMissing, idsToReview, payoutRequests, openChats, newContact] = await Promise.all([
    Product.countDocuments({ status: 'pending' }),
    User.countDocuments({ role: 'seller', 'seller.storeName': { $exists: false } }),
    User.countDocuments({ role: 'customer', sellerOnboarding: { $exists: true } }),
    User.countDocuments(noPayout),
    User.countDocuments({ role: 'seller', 'seller.verification.status': 'pending' }),
    Payout.countDocuments({ status: 'requested' }),
    Conversation.countDocuments({ support: true, 'supportState.status': 'open' }),
    ContactMessage.countDocuments({ status: 'new' }),
  ]);
  return { pendingListings, setupPending, stuckShoppers, payoutMissing, idsToReview, payoutRequests, openChats, newContact };
}
