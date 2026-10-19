import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { formatPrice, toPlain } from '@/lib/utils';
import User from '@/models/User';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import Payout from '@/models/Payout';

// Seller analytics, shared by the admin user page and the seller's own workspace. UNGUARDED: callers
// authorize first (requireAdmin / requireSellerStore) and pass a seller id they're allowed to see.
// Every query is served by the { seller, type, createdAt } ledger index or { sellerId, createdAt } on products.

export const SALES_PAGE_SIZE = 20;
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const usd = (cents) => formatPrice(cents, 'USD');

/** The last `count` calendar months as 'YYYY-MM' keys (UTC), oldest first, plus the first day of the range. */
function monthKeys(count) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return { keys, since: new Date(`${keys[0]}-01T00:00:00Z`) };
}

const monthLabel = (key) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthOf = { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } };

/** "jane.doe@gmail.com" → "j•••@gmail.com": enough for a seller to recognise repeat buyers, not to contact them. */
export function maskEmail(email = '') {
  const [user, domain] = String(email).split('@');
  return domain ? `${user.charAt(0)}•••@${domain}` : '—';
}

/** Monthly sales, gross, platform fee and seller earnings for the last `months` months (empty months = 0). */
export async function getMonthlyEarnings(sellerId, months = 12) {
  await connectDB();
  const { keys, since } = monthKeys(months);
  const rows = await Transaction.aggregate([
    { $match: { seller: oid(sellerId), type: 'sale', createdAt: { $gte: since } } },
    { $group: { _id: monthOf, sales: { $sum: 1 }, gross: { $sum: '$gross' }, commission: { $sum: '$commission' }, earnings: { $sum: '$sellerEarning' } } },
  ]);
  const byMonth = new Map(rows.map((r) => [r._id, r]));
  return keys.map((key) => {
    const r = byMonth.get(key);
    return { month: key, label: monthLabel(key), sales: r?.sales ?? 0, gross: r?.gross ?? 0, commission: r?.commission ?? 0, earnings: r?.earnings ?? 0 };
  });
}

/** Seller earnings per product per month (last `months` months), best-selling products first. */
export async function getProductMonthlyEarnings(sellerId, months = 6) {
  await connectDB();
  const { keys, since } = monthKeys(months);
  const rows = await Transaction.aggregate([
    { $match: { seller: oid(sellerId), type: 'sale', createdAt: { $gte: since } } },
    { $group: { _id: { product: '$product', month: monthOf }, sales: { $sum: 1 }, earnings: { $sum: '$sellerEarning' } } },
  ]);
  const ids = [...new Set(rows.map((r) => String(r._id.product)))];
  const titles = new Map(
    (await Product.find({ _id: { $in: ids } }).select('title slug').lean()).map((p) => [String(p._id), p]),
  );

  const products = new Map();
  for (const r of rows) {
    const id = String(r._id.product);
    if (!products.has(id)) products.set(id, { productId: id, title: titles.get(id)?.title ?? 'Deleted product', cells: {}, total: 0, sales: 0 });
    const p = products.get(id);
    p.cells[r._id.month] = r.earnings;
    p.total += r.earnings;
    p.sales += r.sales;
  }
  return {
    months: keys.map((key) => ({ month: key, label: monthLabel(key) })),
    rows: [...products.values()].sort((a, b) => b.total - a.total),
  };
}

/** Paginated sales ledger: date, product, order, masked buyer, gross, fee, earning. `month` = 'YYYY-MM' filter. */
export async function getSellerSales(sellerId, { page = 1, month } = {}) {
  await connectDB();
  const filter = { seller: oid(sellerId), type: 'sale' };
  if (/^\d{4}-\d{2}$/.test(month ?? '')) {
    const start = new Date(`${month}-01T00:00:00Z`);
    filter.createdAt = { $gte: start, $lt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) };
  }
  const p = Math.max(1, Number.parseInt(page, 10) || 1);

  const [items, totals] = await Promise.all([
    Transaction.find(filter)
      .select('product order gross commission sellerEarning commissionRate paymentProvider createdAt')
      .populate('product', 'title slug')
      .populate('order', 'buyerEmail')
      .sort({ createdAt: -1 })
      .skip((p - 1) * SALES_PAGE_SIZE)
      .limit(SALES_PAGE_SIZE)
      .lean(),
    Transaction.aggregate([
      { $match: filter },
      { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: '$gross' }, commission: { $sum: '$commission' }, earnings: { $sum: '$sellerEarning' } } },
    ]),
  ]);

  const t = totals[0] ?? { count: 0, gross: 0, commission: 0, earnings: 0 };
  return toPlain({
    items: items.map((s) => ({
      id: s._id,
      createdAt: s.createdAt,
      product: s.product ? { title: s.product.title, slug: s.product.slug } : null,
      orderNumber: s.order ? String(s.order._id).slice(-8).toUpperCase() : null,
      buyer: maskEmail(s.order?.buyerEmail),
      gross: s.gross,
      commission: s.commission,
      earnings: s.sellerEarning,
      demo: s.paymentProvider === 'demo',
    })),
    totals: { count: t.count, gross: t.gross, commission: t.commission, earnings: t.earnings },
    pagination: { page: p, totalPages: Math.max(1, Math.ceil(t.count / SALES_PAGE_SIZE)), total: t.count },
  });
}

/**
 * Activity log, newest first: account + shop milestones, product uploads, every sale, payout requests and payments.
 * Built from the records themselves (ledger, products, payouts), so it can't drift from what actually happened.
 */
export async function getSellerActivity(sellerId, limit = 40) {
  await connectDB();
  const id = oid(sellerId);
  const [user, products, sales, payouts] = await Promise.all([
    User.findById(id).select('createdAt lastLoginAt seller.joinedAt seller.storeSetupAt seller.storeName').lean(),
    Product.find({ sellerId: id }).select('title status isPublished createdAt').sort({ createdAt: -1 }).limit(limit).lean(),
    Transaction.find({ seller: id, type: 'sale' }).select('product gross sellerEarning createdAt').populate('product', 'title').sort({ createdAt: -1 }).limit(limit).lean(),
    Payout.find({ seller: id }).select('amount status reference createdAt paidAt').sort({ createdAt: -1 }).limit(limit).lean(),
  ]);
  if (!user) return [];

  const events = [
    { type: 'account', at: user.seller?.joinedAt ?? user.createdAt, text: 'Created a seller account' },
    user.seller?.storeSetupAt && { type: 'shop', at: user.seller.storeSetupAt, text: `Set up the shop “${user.seller.storeName}”` },
    user.lastLoginAt && { type: 'login', at: user.lastLoginAt, text: 'Last logged in' },
    ...products.map((p) => ({
      type: 'product',
      at: p.createdAt,
      text: `Uploaded “${p.title}”`,
      note: { pending: 'In review', approved: p.isPublished ? 'Live' : 'Hidden', rejected: 'Rejected' }[p.status],
    })),
    ...sales.map((s) => ({
      type: 'sale',
      at: s.createdAt,
      text: `Sold “${s.product?.title ?? 'Deleted product'}” for ${usd(s.gross)}`,
      note: `+${usd(s.sellerEarning)} earned`,
    })),
    ...payouts.flatMap((p) => [
      { type: 'payout', at: p.createdAt, text: `Payout of ${usd(p.amount)} ${p.status === 'requested' ? 'requested' : 'recorded'}` },
      p.paidAt && { type: 'paid', at: p.paidAt, text: `Payout of ${usd(p.amount)} paid`, note: p.reference ? `Ref ${p.reference}` : undefined },
    ]),
  ].filter(Boolean);

  return toPlain(events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, limit));
}
