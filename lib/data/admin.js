import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex, toPlain } from '@/lib/utils';
import { autoOrderStatus } from '@/lib/order-status';
import { InputError } from '@/lib/data/product-writes';
import { filesForEdit, mediaBytes } from '@/lib/uploads';
import { getCategories } from '@/lib/data/categories';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';
import Order, { ORDER_STATUSES } from '@/models/Order';

// Seller drafts are private works in progress: admins never see or count them.
const NOT_DRAFT = { status: { $ne: 'draft' } };
import User from '@/models/User';
import Transaction from '@/models/Transaction';

// Admin-only reads. Each function authorizes itself (Data Access Layer pattern),
// so a page can never forget the check.

export const ADMIN_PAGE_SIZE = 20;

// Orders and ledger lines from the demo checkout (DEMO_CHECKOUT, test purchases) are not real money: the dashboard
// figures leave them out. Orders and Transactions both record the payment provider.
const REAL_ORDER = { paymentProvider: { $ne: 'demo' } };

const toInt = (v, d) => (Number.parseInt(v, 10) > 0 ? Number.parseInt(v, 10) : d);
const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

export async function getDashboardStats() {
  await requireAdmin();
  await connectDB();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [revenue, orderCount, orders30d, demoOrders, productCounts, recentOrders, topProducts, users, ledger] = await Promise.all([
    // Revenue = paid orders. Demo-checkout (test) orders are left out of every figure here: real money only.
    Order.aggregate([
      { $match: { paymentStatus: 'paid', ...REAL_ORDER } },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          last30d: { $sum: { $cond: [{ $gte: ['$createdAt', since30d] }, '$totalAmount', 0] } },
        },
      },
    ]),
    Order.countDocuments(REAL_ORDER),
    Order.countDocuments({ ...REAL_ORDER, createdAt: { $gte: since30d } }),
    Order.countDocuments({ paymentProvider: 'demo' }),
    // All four catalogue counts in one round trip.
    Product.aggregate([
      { $match: NOT_DRAFT },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $and: [{ $eq: ['$isPublished', true] }, { $eq: ['$status', 'approved'] }] }, 1, 0] } },
          drafts: { $sum: { $cond: [{ $eq: ['$isPublished', false] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        },
      },
    ]),
    Order.find(REAL_ORDER)
      .select('buyerEmail items.title totalAmount currency status paymentProvider createdAt')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    // Best sellers by real sales (the ledger), not Product.salesCount, which also counts demo orders.
    Transaction.aggregate([
      { $match: { type: 'sale', product: { $ne: null }, ...REAL_ORDER } },
      { $group: { _id: '$product', sold: { $sum: 1 }, gross: { $sum: '$gross' } } },
      { $sort: { sold: -1, gross: -1 } },
      { $limit: 5 },
      { $lookup: { from: Product.collection.name, localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { _id: '$product._id', title: '$product.title', coverImage: '$product.coverImage', sold: 1, gross: 1 } },
    ]),
    // People: totals per role + sellers who haven't finished shop setup.
    User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          noShop: { $sum: { $cond: [{ $and: [{ $eq: ['$role', 'seller'] }, { $not: ['$seller.storeName'] }] }, 1, 0] } },
        },
      },
    ]),
    // Platform earnings from the ledger: commission on seller sales + 100% of platform-owned sales.
    Transaction.aggregate([
      { $match: { type: 'sale', ...REAL_ORDER } },
      { $group: { _id: null, gross: { $sum: '$gross' }, commission: { $sum: '$commission' } } },
    ]),
  ]);
  const pc = productCounts[0] ?? { total: 0, active: 0, drafts: 0, pending: 0 };

  const r = revenue[0] ?? { total: 0, last30d: 0 };
  const roles = Object.fromEntries(users.map((u) => [u._id, u]));
  return toPlain({
    users: {
      total: users.reduce((sum, u) => sum + u.count, 0),
      customers: roles.customer?.count ?? 0,
      sellers: roles.seller?.count ?? 0,
      sellersWithoutShop: roles.seller?.noShop ?? 0,
    },
    platform: { commission: ledger[0]?.commission ?? 0, salesGross: ledger[0]?.gross ?? 0 },
    revenue: { total: r.total, last30d: r.last30d },
    orders: { total: orderCount, last30d: orders30d, demo: demoOrders },
    products: { total: pc.total, active: pc.active, drafts: pc.drafts, pendingReview: pc.pending },
    recentOrders,
    topProducts,
  });
}

/** All products (drafts included) with search, category and status filters. */
export async function getAdminProducts(params = {}) {
  await requireAdmin();
  await connectDB();

  const page = toInt(params.page, 1);
  const limit = ADMIN_PAGE_SIZE;
  const filter = { ...NOT_DRAFT };
  if (params.q) {
    const rx = new RegExp(escapeRegex(String(params.q).slice(0, 100)), 'i');
    filter.$or = [{ title: rx }, { slug: rx }, { tags: rx }];
  }
  if (params.category && mongoose.isValidObjectId(params.category)) {
    // A main category includes everything under it (the filter lists main categories; there are over a thousand in all).
    const tree = await getCategories();
    const ids = tree.filter((c) => String(c._id) === params.category || (c.ancestors ?? []).map(String).includes(params.category)).map((c) => c._id);
    filter.category = { $in: ids.length ? ids : [params.category] };
  }
  if (params.status === 'published') Object.assign(filter, PUBLIC_PRODUCT_FILTER);
  if (params.status === 'draft') filter.isPublished = false;
  if (params.status === 'pending' || params.status === 'rejected') filter.status = params.status;

  const [items, total, awaitingReview, countRows] = await Promise.all([
    Product.find(filter)
      .select('title slug price currency coverImage category isPublished isFeatured status sellerId salesCount createdAt')
      .populate('category', 'name slug')
      .populate('sellerId', 'name seller.storeName seller.verification.status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
    Product.countDocuments({ status: 'pending' }),
    // Status tab counts for the whole catalog (drafts are the sellers' own, never counted).
    Product.aggregate([
      { $match: NOT_DRAFT },
      {
        $group: {
          _id: null,
          all: { $sum: 1 },
          published: { $sum: { $cond: [{ $and: [{ $eq: ['$isPublished', true] }, { $eq: ['$status', 'approved'] }] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ['$isPublished', false] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const counts = countRows[0] ?? { all: 0, published: 0, draft: 0, pending: 0, rejected: 0 };
  return {
    items: toPlain(items),
    pagination: pageMeta(page, limit, total),
    awaitingReview,
    counts: { all: counts.all, published: counts.published, draft: counts.draft, pending: counts.pending, rejected: counts.rejected },
  };
}

/** Full product for the edit form — includes the private downloadUrl. */
export async function getAdminProduct(id) {
  await requireAdmin();
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const product = await Product.findOne({ _id: id, ...NOT_DRAFT })
    .select('+downloadUrl +files')
    .populate('category', 'name slug')
    .lean();
  if (!product) return null;
  return toPlain({ ...product, files: filesForEdit(product), mediaBytes: await mediaBytes([...(product.images ?? []), ...(product.videos ?? [])]) });
}

/** Orders ledger for admin pages. */
export async function getAdminOrders(params = {}) {
  await requireAdmin();
  return findOrders(params);
}

/** Admin → Orders cards and status tabs: how many orders in each status, and paid revenue (test orders excluded). */
export async function getOrderSummary() {
  await requireAdmin();
  await connectDB();
  const [byStatus, paid] = await Promise.all([
    Order.aggregate([{ $match: REAL_ORDER }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { ...REAL_ORDER, paymentStatus: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
  ]);
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const r of byStatus) counts[r._id] = r.count;
  return {
    counts: { all: Object.values(counts).reduce((a, b) => a + b, 0), ...counts },
    revenue: paid[0]?.revenue ?? 0,
    paidOrders: paid[0]?.count ?? 0,
  };
}

/**
 * Unguarded query — ONLY for API routes that have already run authorizeAdminRequest()
 * (which also accepts the Bearer API key, unlike the cookie-based requireAdmin()).
 */
export async function findOrders(params = {}) {
  await connectDB();

  const page = toInt(params.page, 1);
  const limit = toInt(params.limit, ADMIN_PAGE_SIZE) > 100 ? 100 : toInt(params.limit, ADMIN_PAGE_SIZE);
  const filter = {};
  if (params.q) {
    const q = String(params.q).trim().slice(0, 100);
    filter.$or = [{ buyerEmail: new RegExp(escapeRegex(q), 'i') }];
    if (mongoose.isValidObjectId(q)) filter.$or.push({ _id: q });
  }
  if (ORDER_STATUSES.includes(params.status)) filter.status = params.status;

  const [items, total] = await Promise.all([
    Order.find(filter)
      .select(
        'buyerEmail items.title items.slug items.price subtotal taxAmount feeAmount totalAmount currency status statusSetBy paymentStatus paymentProvider createdAt',
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  // Older orders (or ones changed outside the app) whose automatic status no longer matches their payment: fix them
  // as they're listed. Statuses an admin set by hand are left alone.
  const stale = items.filter((o) => o.statusSetBy !== 'admin' && o.status !== autoOrderStatus(o));
  if (stale.length) {
    await Order.bulkWrite(
      stale.map((o) => ({ updateOne: { filter: { _id: o._id, statusSetBy: { $ne: 'admin' } }, update: { $set: { status: autoOrderStatus(o) } } } })),
    );
    for (const o of stale) o.status = autoOrderStatus(o);
  }
  return { items: toPlain(items), pagination: pageMeta(page, limit, total) };
}

/**
 * Admin → Orders status dropdown: 'pending' | 'completed' | 'cancelled' sets it by hand (kept from then on);
 * 'auto' goes back to following the payment. Only the fulfilment status changes — payments, seller earnings and the
 * ledger are untouched. Downloads still need a paid order, so "Completed" never releases files that weren't paid for,
 * and "Cancelled" stops the buyer's downloads. UNGUARDED — the route authorizes the admin first.
 */
export async function setOrderStatus(id, status) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('Order not found.', {}, 404);
  if (status !== 'auto' && !ORDER_STATUSES.includes(status))
    throw new InputError('Choose pending, completed or cancelled.', { status: 'Invalid status.' }, 400);
  await connectDB();
  const order = await Order.findById(id).select('status paymentStatus paymentProvider totalAmount').lean();
  if (!order) throw new InputError('Order not found.', {}, 404);

  const next = status === 'auto' ? { status: autoOrderStatus(order), statusSetBy: 'auto' } : { status, statusSetBy: 'admin' };
  await Order.updateOne({ _id: order._id }, { $set: { ...next, statusUpdatedAt: new Date() } });
  return { id: String(order._id), ...next };
}
