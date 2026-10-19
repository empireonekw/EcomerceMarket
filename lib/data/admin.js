import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex, toPlain } from '@/lib/utils';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';
import Order, { ORDER_STATUSES } from '@/models/Order';
import User from '@/models/User';
import Transaction from '@/models/Transaction';

// Admin-only reads. Each function authorizes itself (Data Access Layer pattern),
// so a page can never forget the check.

export const ADMIN_PAGE_SIZE = 20;

const toInt = (v, d) => (Number.parseInt(v, 10) > 0 ? Number.parseInt(v, 10) : d);
const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

export async function getDashboardStats() {
  await requireAdmin();
  await connectDB();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [revenue, orderCount, orders30d, activeProducts, draftProducts, pendingReview, recentOrders, topProducts, users, ledger, productCount] = await Promise.all([
    // Revenue = paid orders. Demo orders are reported separately so test data never inflates real numbers.
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          demo: { $sum: { $cond: [{ $eq: ['$paymentProvider', 'demo'] }, '$totalAmount', 0] } },
          last30d: { $sum: { $cond: [{ $gte: ['$createdAt', since30d] }, '$totalAmount', 0] } },
        },
      },
    ]),
    Order.estimatedDocumentCount(),
    Order.countDocuments({ createdAt: { $gte: since30d } }),
    Product.countDocuments(PUBLIC_PRODUCT_FILTER),
    Product.countDocuments({ isPublished: false }),
    Product.countDocuments({ status: 'pending' }),
    Order.find().select('buyerEmail items.title totalAmount currency status paymentProvider createdAt').sort({ createdAt: -1 }).limit(6).lean(),
    Product.find().select('title slug price salesCount coverImage').sort({ salesCount: -1 }).limit(5).lean(),
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
    Transaction.aggregate([{ $match: { type: 'sale' } }, { $group: { _id: null, gross: { $sum: '$gross' }, commission: { $sum: '$commission' } } }]),
    Product.estimatedDocumentCount(),
  ]);

  const r = revenue[0] ?? { total: 0, demo: 0, last30d: 0 };
  const roles = Object.fromEntries(users.map((u) => [u._id, u]));
  return toPlain({
    users: {
      total: users.reduce((sum, u) => sum + u.count, 0),
      customers: roles.customer?.count ?? 0,
      sellers: roles.seller?.count ?? 0,
      sellersWithoutShop: roles.seller?.noShop ?? 0,
    },
    platform: { commission: ledger[0]?.commission ?? 0, salesGross: ledger[0]?.gross ?? 0 },
    revenue: { total: r.total, demo: r.demo, last30d: r.last30d },
    orders: { total: orderCount, last30d: orders30d },
    products: { total: productCount, active: activeProducts, drafts: draftProducts, pendingReview },
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
  const filter = {};
  if (params.q) {
    const rx = new RegExp(escapeRegex(String(params.q).slice(0, 100)), 'i');
    filter.$or = [{ title: rx }, { slug: rx }, { tags: rx }];
  }
  if (params.category && mongoose.isValidObjectId(params.category)) filter.category = params.category;
  if (params.status === 'published') Object.assign(filter, PUBLIC_PRODUCT_FILTER);
  if (params.status === 'draft') filter.isPublished = false;
  if (params.status === 'pending' || params.status === 'rejected') filter.status = params.status;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .select('title slug price currency coverImage category isPublished isFeatured status sellerId salesCount createdAt')
      .populate('category', 'name slug')
      .populate('sellerId', 'name seller.storeName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { items: toPlain(items), pagination: pageMeta(page, limit, total) };
}

/** Full product for the edit form — includes the private downloadUrl. */
export async function getAdminProduct(id) {
  await requireAdmin();
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const product = await Product.findById(id).select('+downloadUrl').populate('category', 'name slug').lean();
  return product ? toPlain(product) : null;
}

/** Orders ledger for admin pages. */
export async function getAdminOrders(params = {}) {
  await requireAdmin();
  return findOrders(params);
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
      .select('buyerEmail items.title items.slug items.price subtotal taxAmount feeAmount totalAmount currency status paymentStatus paymentProvider createdAt')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items: toPlain(items), pagination: pageMeta(page, limit, total) };
}
