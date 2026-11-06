import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { lastDays, statsDay } from '@/lib/listing-stats';
import { LISTING_LIMITS, listingStatus } from '@/lib/listing';
import { toPlain } from '@/lib/utils';
import ListingStat, { ListingSearchTerm, VISIT_SOURCES } from '@/models/ListingStat';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';

/** Tips like Etsy's "Improvement suggestions", from what the listing is missing. */
function suggestionsFor(p) {
  const tips = [];
  const photos = (p.images ?? []).length || (p.coverImage ? 1 : 0);
  if (photos < 5) tips.push('Add more photos so buyers can see every detail: different angles, close-ups and the item in use.');
  if ((p.tags ?? []).length < LISTING_LIMITS.tags) tips.push(`Use all ${LISTING_LIMITS.tags} tags: each one is another way for buyers to find your listing in search.`);
  if (String(p.description ?? '').length < 400) tips.push('Write a fuller description: what’s included, file formats, sizes and how to use it.');
  if (!p.shortDescription) tips.push('Add a short summary: it’s shown under the title in search results.');
  return tips;
}

/**
 * Everything the seller's Listing stats page shows for one of their listings over the last `days` days: the listing,
 * improvement tips, and per-day visits, add-to-carts, orders and revenue, plus totals, visit sources and the
 * Sellpify searches that led to it. Null when the listing isn't theirs.
 */
export async function getListingStats(userId, productId, days = 30) {
  if (!mongoose.isValidObjectId(productId)) return null;
  await connectDB();
  const product = await Product.findOne({ _id: productId, sellerId: userId })
    .select('title slug price currency coverImage images tags description shortDescription status isPublished')
    .lean();
  if (!product) return null;

  const range = lastDays(days);
  const first = range[0];
  const [stats, terms, sales] = await Promise.all([
    ListingStat.find({ product: product._id, day: { $gte: first } }).lean(),
    ListingSearchTerm.aggregate([
      { $match: { product: product._id, day: { $gte: first } } },
      { $group: { _id: '$term', count: { $sum: '$count' } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 10 },
    ]),
    // A day of margin either side of the timezone; bucketed by local day below.
    Transaction.find({ product: product._id, type: 'sale', createdAt: { $gte: new Date(Date.parse(`${first}T00:00:00Z`) - 86_400_000) } })
      .select('gross createdAt')
      .lean(),
  ]);

  const index = new Map(range.map((d, i) => [d, i]));
  const zeros = () => range.map(() => 0);
  const series = { visits: zeros(), carts: zeros(), orders: zeros(), revenue: zeros() };
  const sources = Object.fromEntries(VISIT_SOURCES.map((s) => [s, 0]));
  for (const s of stats) {
    const i = index.get(s.day);
    if (i == null) continue;
    series.visits[i] += s.visits ?? 0;
    series.carts[i] += s.carts ?? 0;
    for (const k of VISIT_SOURCES) sources[k] += s.sources?.[k] ?? 0;
  }
  for (const t of sales) {
    const i = index.get(statsDay(t.createdAt));
    if (i == null) continue;
    series.orders[i] += 1;
    series.revenue[i] += t.gross ?? 0;
  }
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  return toPlain({
    product: { ...product, statusLabel: listingStatus(product).label },
    suggestions: suggestionsFor(product),
    range,
    series,
    totals: { visits: sum(series.visits), carts: sum(series.carts), orders: sum(series.orders), revenue: sum(series.revenue) },
    sources,
    searchTerms: terms.map((t) => ({ term: t._id, count: t.count })),
    updatedAt: new Date(),
  });
}
