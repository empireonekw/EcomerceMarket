import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex, toPlain } from '@/lib/utils';
import { validateBankDetails, WALLET_OPTIONS } from '@/lib/validation';
import User, { USER_ROLES } from '@/models/User';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import Payout from '@/models/Payout';

// Admin → Users. Every function authorizes itself (same Data Access Layer pattern as lib/data/admin.js).

export const USERS_PAGE_SIZE = 20;

const toInt = (v, d) => (Number.parseInt(v, 10) > 0 ? Number.parseInt(v, 10) : d);

// Listing nested paths keeps the private bank details out of everything but the payout-method check.
const USER_FIELDS =
  'name email role createdAt lastLoginAt termsAcceptedAt seller.storeName seller.storeDescription seller.totalEarnings seller.pendingPayout seller.paidPayout seller.joinedAt seller.bankDetails';

const hasPayoutMethod = (bankDetails) => Object.keys(validateBankDetails(bankDetails ?? {})).length === 0;

/**
 * One headline status per account, most actionable first. `tone` maps onto StatusBadge colours.
 *   seller without a shop      → shop setup pending
 *   seller without payout info → payout details missing
 *   never logged in            → never logged in
 *   otherwise                  → active
 */
function accountStatus(u) {
  if (u.role === 'seller' && !u.seller?.storeName) return { key: 'setup', label: 'Shop setup pending', tone: 'pending' };
  if (u.role === 'seller' && !hasPayoutMethod(u.seller?.bankDetails)) return { key: 'payout', label: 'Payout details missing', tone: 'requested' };
  if (!u.lastLoginAt) return { key: 'inactive', label: 'Never logged in', tone: 'cancelled' };
  return { key: 'active', label: 'Active', tone: 'completed' };
}

/** "Bank · Meezan Bank · ••••6702" / "EasyPaisa · ••••4567" — enough to recognise, never the full number. */
function payoutMethods(bankDetails = {}) {
  const tail = (v) => `••••${String(v).slice(-4)}`;
  const methods = [];
  if (bankDetails.accountNumber) methods.push(`Bank · ${bankDetails.bankName || 'Account'} · ${tail(bankDetails.accountNumber)}`);
  if (bankDetails.walletNumber) {
    const provider = WALLET_OPTIONS.find((w) => w.value === bankDetails.walletProvider)?.label ?? 'Wallet';
    methods.push(`${provider} · ${tail(bankDetails.walletNumber)}`);
  }
  return methods;
}

/** Paid purchases grouped by buyer email (covers guest checkouts made with the same address). */
async function purchaseTotals(emails) {
  if (!emails.length) return new Map();
  const rows = await Order.aggregate([
    { $match: { buyerEmail: { $in: emails }, paymentStatus: 'paid' } },
    { $group: { _id: '$buyerEmail', orders: { $sum: 1 }, spent: { $sum: '$totalAmount' }, lastAt: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map((r) => [r._id, r]));
}

async function sellingTotals(sellerIds) {
  if (!sellerIds.length) return { products: new Map(), sales: new Map() };
  const [products, sales] = await Promise.all([
    Product.aggregate([
      { $match: { sellerId: { $in: sellerIds } } },
      {
        $group: {
          _id: '$sellerId',
          total: { $sum: 1 },
          live: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'approved'] }, '$isPublished'] }, 1, 0] } },
          inReview: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { seller: { $in: sellerIds }, type: 'sale' } },
      { $group: { _id: '$seller', count: { $sum: 1 }, gross: { $sum: '$gross' } } },
    ]),
  ]);
  return { products: new Map(products.map((r) => [String(r._id), r])), sales: new Map(sales.map((r) => [String(r._id), r])) };
}

function shapeUser(u, purchases, selling) {
  const id = String(u._id);
  const bought = purchases.get(u.email);
  const products = selling.products.get(id);
  const sales = selling.sales.get(id);
  return {
    id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt ?? null,
    status: accountStatus(u),
    purchases: { orders: bought?.orders ?? 0, spent: bought?.spent ?? 0, lastAt: bought?.lastAt ?? null },
    selling:
      u.role === 'seller'
        ? {
            storeName: u.seller?.storeName ?? null,
            products: products?.total ?? 0,
            live: products?.live ?? 0,
            inReview: products?.inReview ?? 0,
            sales: sales?.count ?? 0,
            gross: sales?.gross ?? 0,
            earnings: u.seller?.totalEarnings ?? 0,
            pendingPayout: u.seller?.pendingPayout ?? 0,
            paidPayout: u.seller?.paidPayout ?? 0,
          }
        : null,
  };
}

/** Paginated user list with role tabs, search and per-row purchase / selling totals. */
export async function getAdminUsers(params = {}) {
  await requireAdmin();
  await connectDB();

  const page = toInt(params.page, 1);
  const limit = USERS_PAGE_SIZE;
  const filter = {};
  if (USER_ROLES.includes(params.role)) filter.role = params.role;
  if (params.q) {
    const rx = new RegExp(escapeRegex(String(params.q).trim().slice(0, 100)), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { 'seller.storeName': rx }];
  }
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [users, total, roleRows, setupPending, newLast30d] = await Promise.all([
    User.find(filter).select(USER_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'seller', 'seller.storeName': { $exists: false } }),
    User.countDocuments({ createdAt: { $gte: since30d } }),
  ]);

  const sellerIds = users.filter((u) => u.role === 'seller').map((u) => u._id);
  const [purchases, selling] = await Promise.all([purchaseTotals(users.map((u) => u.email)), sellingTotals(sellerIds)]);

  const byRole = Object.fromEntries(USER_ROLES.map((r) => [r, 0]));
  for (const row of roleRows) byRole[row._id] = row.count;

  return toPlain({
    items: users.map((u) => shapeUser(u, purchases, selling)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    summary: { total: Object.values(byRole).reduce((a, b) => a + b, 0), byRole, setupPending, newLast30d },
  });
}

/** Everything the user detail page shows. Returns null for unknown ids. */
export async function getAdminUserDetail(id) {
  await requireAdmin();
  if (!mongoose.isValidObjectId(id)) return null;
  await connectDB();

  const u = await User.findById(id).select(USER_FIELDS).lean();
  if (!u) return null;
  const isSeller = u.role === 'seller';

  const [purchases, selling, recentOrders, products, recentSales, payouts] = await Promise.all([
    purchaseTotals([u.email]),
    sellingTotals(isSeller ? [u._id] : []),
    Order.find({ buyerEmail: u.email })
      .select('items.title totalAmount currency status paymentStatus paymentProvider createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    isSeller
      ? Product.find({ sellerId: u._id }).select('title slug price currency status isPublished salesCount createdAt').sort({ createdAt: -1 }).limit(50).lean()
      : [],
    isSeller
      ? Transaction.find({ seller: u._id, type: 'sale' })
          .select('product gross commission sellerEarning createdAt')
          .populate('product', 'title')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      : [],
    isSeller ? Payout.find({ seller: u._id }).select('amount status reference paidAt createdAt').sort({ createdAt: -1 }).limit(10).lean() : [],
  ]);

  return toPlain({
    ...shapeUser(u, purchases, selling),
    termsAcceptedAt: u.termsAcceptedAt ?? null,
    shop: isSeller
      ? {
          storeName: u.seller?.storeName ?? null,
          storeDescription: u.seller?.storeDescription ?? '',
          joinedAt: u.seller?.joinedAt ?? null,
          payoutMethods: payoutMethods(u.seller?.bankDetails),
        }
      : null,
    recentOrders,
    products,
    recentSales,
    payouts,
  });
}
