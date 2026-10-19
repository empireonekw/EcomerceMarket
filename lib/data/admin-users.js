import 'server-only';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex, formatPrice, toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
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
    {
      $group: {
        _id: '$buyerEmail',
        orders: { $sum: 1 },
        items: { $sum: { $size: '$items' } },
        spent: { $sum: '$totalAmount' },
        lastAt: { $max: '$createdAt' },
      },
    },
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
    purchases: { orders: bought?.orders ?? 0, items: bought?.items ?? 0, spent: bought?.spent ?? 0, lastAt: bought?.lastAt ?? null },
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

/**
 * Permanently deletes a customer or seller account. UNGUARDED — only call after the caller has verified
 * an admin session (DELETE /api/admin/users/[id]). Refuses admins, the acting admin, and sellers who are
 * still owed money. Seller products: never-sold ones are deleted; purchased ones are unpublished so their
 * buyers keep downloading. Orders stay for the records (they're unlinked from the account).
 */
export async function deleteUserAccount(id, { actingAdminId }) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('User not found.', {}, 404);
  if (String(id) === String(actingAdminId)) throw new InputError('You can’t delete your own account.', {}, 409);
  await connectDB();

  const user = await User.findById(id).select('name role seller.pendingPayout').lean();
  if (!user) throw new InputError('User not found.', {}, 404);
  if (user.role === 'admin') throw new InputError('Admin accounts can’t be deleted here.', {}, 403);
  const owed = user.seller?.pendingPayout ?? 0;
  if (owed > 0) {
    throw new InputError(`This seller is still owed ${formatPrice(owed, 'USD')}. Pay it out from Seller payouts before deleting the account.`, {}, 409);
  }

  const result = { role: user.role, productsDeleted: 0, productsUnpublished: 0, ordersUnlinked: 0 };
  await mongoose.connection.transaction(async (session) => {
    if (user.role === 'seller') {
      const productIds = await Product.find({ sellerId: user._id }).distinct('_id').session(session);
      // distinct() also returns OTHER sellers' products from the same orders — keep only this seller's.
      const inOrders = new Set(
        (await Order.distinct('items.product', { 'items.product': { $in: productIds } }).session(session)).map(String),
      );
      const sold = productIds.filter((pid) => inOrders.has(String(pid)));
      const unsold = productIds.filter((pid) => !inOrders.has(String(pid)));
      result.productsDeleted = (await Product.deleteMany({ _id: { $in: unsold } }, { session })).deletedCount;
      result.productsUnpublished = (
        await Product.updateMany({ _id: { $in: sold } }, { $set: { isPublished: false, isFeatured: false } }, { session })
      ).modifiedCount;
    }
    result.ordersUnlinked = (await Order.updateMany({ user: user._id }, { $unset: { user: 1 } }, { session })).modifiedCount;
    await User.deleteOne({ _id: user._id }, { session }); // existing sessions die with the account (lib/auth.js)
  });
  return result;
}

export const BULK_DELETE_MAX = 100;

// Re-auth throttle: only WRONG passwords count (5 per 15 minutes), so normal deleting is never blocked.
export const REAUTH_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

/**
 * Re-authentication for destructive admin actions: the acting admin's own password. Throws a field error on
 * a wrong password. Rate limiting is the route's job (lib/rate-limit.js).
 */
export async function verifyAdminPassword(adminId, password) {
  if (typeof password !== 'string' || !password) throw new InputError('Enter your password to confirm.', { password: 'Enter your password to confirm.' }, 400);
  await connectDB();
  const admin = await User.findOne({ _id: adminId, role: 'admin' }).select('+password').lean();
  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    throw new InputError('That password isn’t right.', { password: 'That password isn’t right.' }, 403);
  }
}

/**
 * Deletes several accounts, each with the same rules and its own transaction as deleteUserAccount().
 * An account that can't be deleted (admin, yourself, seller still owed money, already gone) is skipped with
 * the reason, so one blocker never cancels the rest. UNGUARDED — verify the admin (and password) first.
 */
export async function deleteUserAccounts(ids, { actingAdminId }) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  if (unique.length === 0) throw new InputError('Select at least one account.', {}, 400);
  if (unique.length > BULK_DELETE_MAX) throw new InputError(`Select at most ${BULK_DELETE_MAX} accounts at a time.`, {}, 400);

  await connectDB();
  const names = new Map((await User.find({ _id: { $in: unique.filter((id) => mongoose.isValidObjectId(id)) } }).select('name').lean()).map((u) => [String(u._id), u.name]));
  const deleted = [];
  const skipped = [];
  for (const id of unique) {
    try {
      const result = await deleteUserAccount(id, { actingAdminId });
      deleted.push({ id, name: names.get(id), ...result });
    } catch (err) {
      if (!(err instanceof InputError)) throw err;
      skipped.push({ id, name: names.get(id) ?? 'Unknown account', reason: err.message });
    }
  }
  return { deleted, skipped };
}
