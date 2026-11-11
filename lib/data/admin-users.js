import 'server-only';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { isOwnerAdminEmail } from '@/lib/owner-admin';
import { readBankDetails } from '@/lib/field-encryption';
import { requireAdmin } from '@/lib/auth';
import { escapeRegex, formatPrice, toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { sendSystemMessage } from '@/lib/data/messages';
import { VERIFY_PATH } from '@/lib/data/seller-verification';
import { validateBankDetails, WALLET_OPTIONS } from '@/lib/validation';
import User, { USER_ROLES } from '@/models/User';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import Payout from '@/models/Payout';

// Admin → Users. Every function authorizes itself (same Data Access Layer pattern as lib/data/admin.js).

export const USERS_PAGE_SIZE = 10;

const toInt = (v, d) => (Number.parseInt(v, 10) > 0 ? Number.parseInt(v, 10) : d);

// Listing nested paths keeps the private bank details out of everything but the payout-method check.
const USER_FIELDS =
  'name email role createdAt lastLoginAt termsAcceptedAt blockedAt seller.storeName seller.storeDescription seller.totalEarnings seller.pendingPayout seller.paidPayout seller.joinedAt seller.bankDetails seller.bankDetailsEnc seller.verification.status seller.verification.submittedAt seller.country';
/** "ID check" filter on Admin → Users: sellers whose ID is waiting for review, verified or rejected. */
export const VERIFICATION_FILTERS = ['pending', 'verified', 'rejected'];

/** A seller with an open shop but no bank account or wallet saved (plain or encrypted). */
const NO_PAYOUT = {
  role: 'seller',
  'seller.storeName': { $type: 'string' },
  'seller.bankDetailsEnc': { $exists: false },
  'seller.bankDetails.accountNumber': { $in: [null, ''] },
  'seller.bankDetails.walletNumber': { $in: [null, ''] },
};
/**
 * "Needs attention" filter on Admin → Users (linked from the dashboard): accounts stuck on their way to selling.
 *   setup   seller accounts that haven't opened their shop
 *   wizard  shopping accounts part-way through the shop wizard (/sell-on-sellpify)
 *   payout  open shops with no payout details
 */
export const ACCOUNT_FILTERS = [
  { value: 'setup', label: 'Stuck in shop setup', filter: { role: 'seller', 'seller.storeName': { $exists: false } } },
  { value: 'wizard', label: 'Shoppers opening a shop', filter: { role: 'customer', sellerOnboarding: { $exists: true } } },
  { value: 'payout', label: 'No payout details', filter: NO_PAYOUT },
];

const hasPayoutMethod = (bankDetails) => Object.keys(validateBankDetails(bankDetails ?? {})).length === 0;

/**
 * One headline status per account, most actionable first. `tone` maps onto StatusBadge colours.
 *   seller without a shop      → shop setup pending
 *   seller without payout info → payout details missing
 *   never logged in            → never logged in
 *   otherwise                  → active
 */
function accountStatus(u) {
  if (u.blockedAt) return { key: 'blocked', label: 'Blocked', tone: 'cancelled' };
  if (u.role === 'seller' && !u.seller?.storeName) return { key: 'setup', label: 'Shop setup pending', tone: 'pending' };
  if (u.role === 'customer' && u.openingShop) return { key: 'wizard', label: 'Opening a shop', tone: 'pending' };
  if (u.role === 'seller' && !hasPayoutMethod(readBankDetails(u.seller))) return { key: 'payout', label: 'Payout details missing', tone: 'requested' };
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
      { $match: { sellerId: { $in: sellerIds }, status: { $ne: 'draft' } } }, // drafts are private to the seller
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
    isOwner: isOwnerAdminEmail(u.email), // the marketplace owner: role and access can't be changed
    blockedAt: u.blockedAt ?? null,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt ?? null,
    status: accountStatus(u),
    purchases: { orders: bought?.orders ?? 0, items: bought?.items ?? 0, spent: bought?.spent ?? 0, lastAt: bought?.lastAt ?? null },
    selling:
      u.role === 'seller'
        ? {
            storeName: u.seller?.storeName ?? null,
            verification: u.seller?.verification?.status ?? null, // 'pending' | 'verified' | 'rejected' | null (no ID yet)
            verificationSubmittedAt: u.seller?.verification?.submittedAt ?? null,
            country: u.seller?.country ?? null,
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

// "Today" / "Yesterday" / date ranges are calendar days in the marketplace's timezone (default Pakistan time).
export const ADMIN_TIMEZONE = process.env.ADMIN_TIMEZONE || 'Asia/Karachi';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-11-02" for `date` as a calendar day in ADMIN_TIMEZONE. */
export const localDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: ADMIN_TIMEZONE }).format(date);

/** The instant a calendar day ("2026-11-02") starts in ADMIN_TIMEZONE. */
function dayStart(day) {
  const utc = new Date(`${day}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: ADMIN_TIMEZONE, timeZoneName: 'longOffset' })
    .formatToParts(utc)
    .find((p) => p.type === 'timeZoneName')
    ?.value.match(/([+-])(\d{2}):?(\d{2})?/);
  const minutes = offset ? (offset[1] === '-' ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0)) : 0;
  return new Date(utc.getTime() - minutes * 60_000);
}
const nextDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Sign-up date filter → a createdAt range: joined=today | yesterday, or from=YYYY-MM-DD and/or to=YYYY-MM-DD
 * (inclusive days). Returns null when there is no (valid) date filter.
 */
export function joinedRange({ joined, from, to } = {}) {
  const today = localDay();
  if (joined === 'today') return { $gte: dayStart(today) };
  if (joined === 'yesterday') {
    const yesterday = localDay(new Date(dayStart(today).getTime() - 1));
    return { $gte: dayStart(yesterday), $lt: dayStart(today) };
  }
  const range = {};
  if (DATE_RE.test(from ?? '')) range.$gte = dayStart(from);
  if (DATE_RE.test(to ?? '')) range.$lt = dayStart(nextDay(to));
  return Object.keys(range).length ? range : null;
}

/** Paginated user list with role tabs, search, sign-up date filter and per-row purchase / selling totals. */
export async function getAdminUsers(params = {}) {
  await requireAdmin();
  await connectDB();

  const page = toInt(params.page, 1);
  const limit = USERS_PAGE_SIZE;
  const filter = {};
  if (USER_ROLES.includes(params.role)) filter.role = params.role;
  if (VERIFICATION_FILTERS.includes(params.verification)) filter['seller.verification.status'] = params.verification;
  const account = ACCOUNT_FILTERS.find((f) => f.value === params.status);
  if (account) {
    if (filter.role && filter.role !== account.filter.role) filter._id = null; // e.g. Customers + "No payout details": none
    Object.assign(filter, account.filter);
  }
  if (params.q) {
    const rx = new RegExp(escapeRegex(String(params.q).trim().slice(0, 100)), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { 'seller.storeName': rx }];
  }
  const joined = joinedRange(params);
  if (joined) filter.createdAt = joined;
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [users, total, roleRows, setupPending, idsToReview, newLast30d, newToday, newYesterday, stuckShoppers, payoutMissing] = await Promise.all([
    // The ID review queue: whoever sent their ID first is reviewed first. Everything else: newest accounts first.
    User.find(filter)
      .select(USER_FIELDS)
      .sort(params.verification === 'pending' ? { 'seller.verification.submittedAt': 1, _id: 1 } : { createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'seller', 'seller.storeName': { $exists: false } }),
    User.countDocuments({ role: 'seller', 'seller.verification.status': 'pending' }),
    User.countDocuments({ createdAt: { $gte: since30d } }),
    User.countDocuments({ createdAt: joinedRange({ joined: 'today' }) }),
    User.countDocuments({ createdAt: joinedRange({ joined: 'yesterday' }) }),
    User.countDocuments(ACCOUNT_FILTERS.find((f) => f.value === 'wizard').filter),
    User.countDocuments(NO_PAYOUT),
  ]);

  // Shoppers part-way through the shop wizard show as "Opening a shop" (the draft itself is private, so just ask).
  const customerIds = users.filter((u) => u.role === 'customer').map((u) => u._id);
  if (customerIds.length) {
    const opening = new Set((await User.find({ _id: { $in: customerIds }, sellerOnboarding: { $exists: true } }).select('_id').lean()).map((u) => String(u._id)));
    for (const u of users) if (opening.has(String(u._id))) u.openingShop = true;
  }
  const sellerIds = users.filter((u) => u.role === 'seller').map((u) => u._id);
  const [purchases, selling] = await Promise.all([purchaseTotals(users.map((u) => u.email)), sellingTotals(sellerIds)]);

  const byRole = Object.fromEntries(USER_ROLES.map((r) => [r, 0]));
  for (const row of roleRows) byRole[row._id] = row.count;

  return toPlain({
    items: users.map((u) => shapeUser(u, purchases, selling)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    summary: {
      total: Object.values(byRole).reduce((a, b) => a + b, 0),
      byRole,
      setupPending,
      stuckShoppers,
      payoutMissing,
      idsToReview,
      newLast30d,
      newToday,
      newYesterday,
      today: localDay(),
    },
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
  // Shop opened with the wizard: branding, preferences and the private verification details (admins only).
  const extra = isSeller
    ? ((await User.findById(id).select('seller.logo seller.banner seller.country seller.currency +seller.address +seller.phone +seller.verification').lean())?.seller ?? {})
    : {};

  const [purchases, selling, recentOrders, products, recentSales, payouts] = await Promise.all([
    purchaseTotals([u.email]),
    sellingTotals(isSeller ? [u._id] : []),
    Order.find({ buyerEmail: u.email })
      .select('items.title totalAmount currency status paymentStatus paymentProvider createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    isSeller
      ? Product.find({ sellerId: u._id, status: { $ne: 'draft' } }).select('title slug price currency status isPublished salesCount createdAt').sort({ createdAt: -1 }).limit(50).lean()
      : [],
    isSeller
      ? Transaction.find({ seller: u._id, type: 'sale' })
          .select('product gross commission sellerEarning createdAt')
          .populate('product', 'title')
          .sort({ createdAt: -1 })
          .limit(10)
          .lean()
      : [],
    isSeller ? Payout.find({ seller: u._id }).select('amount fee netAmount status reference paidAt createdAt').sort({ createdAt: -1 }).limit(10).lean() : [],
  ]);

  return toPlain({
    ...shapeUser(u, purchases, selling),
    termsAcceptedAt: u.termsAcceptedAt ?? null,
    shop: isSeller
      ? {
          storeName: u.seller?.storeName ?? null,
          storeDescription: u.seller?.storeDescription ?? '',
          joinedAt: u.seller?.joinedAt ?? null,
          payoutMethods: payoutMethods(readBankDetails(u.seller)),
          logo: extra.logo ?? null,
          banner: extra.banner ?? null,
          preferences: extra.country ? { country: extra.country, currency: extra.currency } : null,
          address: extra.address ?? null,
          phone: extra.phone ?? null,
          verification: extra.verification
            ? {
                status: extra.verification.status,
                submittedAt: extra.verification.submittedAt ?? null,
                reviewedAt: extra.verification.reviewedAt ?? null,
                note: extra.verification.note ?? '',
                // Which sides exist and whether each is a PDF; the files themselves only through the admin route.
                front: extra.verification.idFront ? { pdf: /\.pdf$/i.test(extra.verification.idFront) } : null,
                back: extra.verification.idBack ? { pdf: /\.pdf$/i.test(extra.verification.idBack) } : null,
                selfie: extra.verification.selfie ? { pdf: false } : null,
              }
            : null,
        }
      : null,
    recentOrders,
    products,
    recentSales,
    payouts,
  });
}

/**
 * Marks a seller's ID check (sent after their first sale, /seller/verify) as 'verified' or 'rejected' (with a reason the seller can act
 * on). UNGUARDED — call after verifying an admin session (PATCH /api/admin/users/[id]/verification).
 */
export async function setSellerVerification(id, { status, note }) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('User not found.', {}, 404);
  if (!['verified', 'rejected'].includes(status)) throw new InputError('Choose verified or rejected.');
  const reason = String(note ?? '').trim();
  if (status === 'rejected' && reason.length < 5) throw new InputError('Please fix the highlighted fields.', { note: 'Tell the seller why, so they can fix it.' });
  if (reason.length > 300) throw new InputError('Please fix the highlighted fields.', { note: 'Keep it under 300 characters.' });
  await connectDB();
  const set = { 'seller.verification.status': status, 'seller.verification.reviewedAt': new Date() };
  const update = status === 'rejected' ? { $set: { ...set, 'seller.verification.note': reason } } : { $set: set, $unset: { 'seller.verification.note': 1 } };
  const { matchedCount } = await User.updateOne({ _id: id, role: 'seller', 'seller.verification.idFront': { $exists: true } }, update);
  if (!matchedCount) throw new InputError('This seller has no ID to verify.', {}, 404);
  await sendSystemMessage(
    id,
    status === 'verified'
      ? 'Your identity is verified ✅ Your shop now shows the blue verified tick, and you can request payouts from Seller → Payouts.'
      : `We couldn’t verify your identity: ${reason} Please send it again: ${VERIFY_PATH}`,
  ).catch((err) => console.error('[verification] could not message seller', id, err));
  return { status };
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

  const user = await User.findById(id).select('name email role seller.pendingPayout').lean();
  if (!user) throw new InputError('User not found.', {}, 404);
  if (user.role === 'admin' || isOwnerAdminEmail(user.email)) throw new InputError('Admin accounts can’t be deleted here.', {}, 403);
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

/** Refuses changes to yourself and to the marketplace owner; returns the target account. */
async function targetAccount(id, actingAdminId, verb) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('User not found.', {}, 404);
  if (String(id) === String(actingAdminId)) throw new InputError(`You can’t ${verb} your own account.`, {}, 409);
  await connectDB();
  const user = await User.findById(id).select('name email role blockedAt seller.joinedAt').lean();
  if (!user) throw new InputError('User not found.', {}, 404);
  if (isOwnerAdminEmail(user.email)) throw new InputError('The owner account is protected.', {}, 403);
  return user;
}

/** Whether a role change needs the acting admin's password: anything that grants or revokes admin access. */
export async function roleChangeNeedsPassword(id, role) {
  if (role === 'admin') return true;
  if (!mongoose.isValidObjectId(id)) return false;
  await connectDB();
  return (await User.exists({ _id: id, role: 'admin' })) != null;
}

/**
 * Changes an account's role (customer / seller / admin). UNGUARDED — the route verifies the admin session, and the
 * admin's password for anything involving admin access. Signs the user out everywhere (tokenVersion) so the new role
 * applies cleanly. A new seller starts at shop setup; a seller made a customer has their live listings hidden.
 */
export async function changeUserRole(id, role, { actingAdminId }) {
  if (!USER_ROLES.includes(role)) throw new InputError('Choose customer, seller or admin.', { role: 'Invalid role.' }, 400);
  const user = await targetAccount(id, actingAdminId, 'change the role of');
  if (user.role === role) return { id: String(user._id), role, listingsHidden: 0 };
  if (role === 'admin' && user.blockedAt) throw new InputError('Unblock this account before making it an admin.', {}, 409);

  let listingsHidden = 0;
  if (user.role === 'seller' && role === 'customer') {
    ({ modifiedCount: listingsHidden } = await Product.updateMany(
      { sellerId: user._id, isPublished: true },
      { $set: { isPublished: false, isFeatured: false } },
    ));
  }
  await User.updateOne(
    { _id: user._id },
    { $set: { role, ...(role === 'seller' && !user.seller?.joinedAt && { 'seller.joinedAt': new Date() }) }, $inc: { tokenVersion: 1 } },
  );
  return { id: String(user._id), role, listingsHidden };
}

/**
 * Blocks or unblocks an account. Blocking signs the user out everywhere, stops them signing in, and hides a
 * seller's live listings; unblocking puts exactly those listings back. Admins can't be blocked (revoke admin
 * first). UNGUARDED — the route verifies the admin session.
 */
export async function setUserBlocked(id, blocked, { actingAdminId }) {
  const user = await targetAccount(id, actingAdminId, blocked ? 'block' : 'unblock');
  if (blocked && user.role === 'admin') throw new InputError('Change this admin to another role before blocking them.', {}, 409);

  if (blocked) {
    if (user.blockedAt) return { id: String(user._id), blocked: true, listings: 0 };
    const live = await Product.find({ sellerId: user._id, isPublished: true }).distinct('_id');
    await Product.updateMany({ _id: { $in: live } }, { $set: { isPublished: false, isFeatured: false } });
    await User.updateOne({ _id: user._id }, { $set: { blockedAt: new Date(), blockedListings: live }, $inc: { tokenVersion: 1 } });
    return { id: String(user._id), blocked: true, listings: live.length };
  }

  const { blockedListings = [] } = (await User.findById(user._id).select('+blockedListings').lean()) ?? {};
  const { modifiedCount } = await Product.updateMany(
    { _id: { $in: blockedListings }, sellerId: user._id, status: 'approved' },
    { $set: { isPublished: true } },
  );
  await User.updateOne({ _id: user._id }, { $unset: { blockedAt: 1, blockedListings: 1 } });
  return { id: String(user._id), blocked: false, listings: modifiedCount };
}
