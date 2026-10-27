import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex, toPlain } from '@/lib/utils';
import { validateListing } from '@/lib/listing';
import { inspectUploadedSource } from '@/lib/uploads';
import { validateStoreName, validateStoreDescription, validateBankDetails, normalizeBankDetails } from '@/lib/validation';
import { createProduct, deleteProduct, updateProduct, SELLER_FIELDS, InputError } from '@/lib/data/product-writes';
import User, { SELLER_WITH_BANK } from '@/models/User';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import Payout from '@/models/Payout';

// Seller-side business logic. Callers (pages/API routes) must authorize first and pass the
// signed-in user's id — never an id taken from the request body.

/** Shop name + description; throws one InputError listing every problem. */
function validateStore({ storeName, storeDescription }) {
  const fields = {};
  const nameError = validateStoreName(storeName);
  if (nameError) fields.storeName = nameError;
  const descriptionError = validateStoreDescription(storeDescription);
  if (descriptionError) fields.storeDescription = descriptionError;
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  return { storeName: String(storeName).trim(), storeDescription: String(storeDescription).trim() };
}

const storeNameTaken = (err) =>
  err?.code === 11000 ? new InputError('That shop name is taken.', { storeName: 'That shop name is already taken.' }, 409) : err;

/**
 * Shop setup (step 2 of becoming a seller): names the shop of a seller account that doesn't have one yet.
 * Payout details are NOT part of setup — the dashboard asks for them until they're added.
 */
export async function setupStore(userId, input) {
  const store = validateStore(input);
  await connectDB();
  try {
    const { matchedCount } = await User.updateOne(
      { _id: userId, role: 'seller', 'seller.storeName': { $exists: false } }, // once only
      { $set: { 'seller.storeName': store.storeName, 'seller.storeDescription': store.storeDescription, 'seller.storeSetupAt': new Date() } },
      { runValidators: true },
    );
    if (!matchedCount) throw new InputError('Your shop is already set up.', {}, 409);
    return store;
  } catch (err) {
    throw storeNameTaken(err);
  }
}

/** Renames the shop / rewrites its description (dashboard → Shop settings). */
export async function updateStoreDetails(userId, input) {
  const store = validateStore(input);
  await connectDB();
  try {
    const { matchedCount } = await User.updateOne(
      { _id: userId, role: 'seller', 'seller.storeName': { $exists: true } },
      { $set: { 'seller.storeName': store.storeName, 'seller.storeDescription': store.storeDescription } },
      { runValidators: true },
    );
    if (!matchedCount) throw new InputError('Set up your shop first.', {}, 409);
    return store;
  } catch (err) {
    throw storeNameTaken(err);
  }
}

/** Where payouts are sent. Balances are never writable here. */
export async function updatePayoutDetails(userId, bankDetails) {
  const fields = validateBankDetails(bankDetails);
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  const normalized = normalizeBankDetails(bankDetails);
  await connectDB();
  const { matchedCount } = await User.updateOne({ _id: userId, role: 'seller' }, { $set: { 'seller.bankDetails': normalized } }, { runValidators: true });
  if (!matchedCount) throw new InputError('Seller account not found.', {}, 404);
  return { bankDetails: normalized };
}

/**
 * Checks a listing from the seller form and derives the cover from the first photo. `draft` listings only need a
 * title; anything submitted for review must be complete (lib/listing.js has the rules). An uploaded PDF/ZIP is
 * checked to really be one (lib/uploads.js), and its size and format are recorded for the product page.
 */
async function listingPayload(payload, draft) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new InputError('Request body must be a JSON object');
  const fields = validateListing(payload, { draft });
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  const images = Array.isArray(payload.images) ? payload.images : [];
  const data = {
    ...payload,
    images,
    videos: Array.isArray(payload.videos) ? payload.videos : [],
    coverImage: images[0] ?? null,
    rightsConfirmed: payload.rightsConfirmed === true,
    fileSize: null, // measured below, never taken from the client
  };
  if (data.deliveryType === 'external') {
    data.sourceFileName = null;
  } else if (data.downloadUrl) {
    const { size, format } = await inspectUploadedSource(data.downloadUrl);
    data.fileSize = size ?? null;
    data.fileFormat ||= format;
  }
  return data;
}

/** A new listing: saved as a private draft, or submitted for review ('pending'). Always owned by the seller. */
export async function createSellerProduct(userId, payload, { draft = false } = {}) {
  return createProduct(await listingPayload(payload, draft), {
    fields: SELLER_FIELDS,
    allowCustomSlug: false,
    overrides: { sellerId: userId, status: draft ? 'draft' : 'pending', isFeatured: false },
  });
}

/** A product the seller owns — or a 404, so sellers can never touch someone else's listing. */
async function ownedProduct(userId, productId) {
  if (!mongoose.isValidObjectId(productId)) throw new InputError('Product not found.', {}, 404);
  await connectDB();
  const product = await Product.findOne({ _id: productId, sellerId: userId }).select('slug status isPublished').lean();
  if (!product) throw new InputError('Product not found.', {}, 404);
  return product;
}

/**
 * Seller edits one of their listings. Submitting sends it back to "In review" so an admin re-approves the changed
 * content (it's hidden from the store meanwhile) — also how rejected listings are resubmitted. Saving as a draft
 * takes it out of the store and out of review until it's submitted again.
 */
export async function updateSellerProduct(userId, productId, payload, { draft = false } = {}) {
  const data = await listingPayload(payload, draft);
  await ownedProduct(userId, productId);
  return updateProduct(productId, data, { fields: SELLER_FIELDS, ownerId: userId, allowCustomSlug: false, overrides: { status: draft ? 'draft' : 'pending' } });
}

/** One of the seller's products with its private download link, for the edit form. */
export async function getSellerProductForEdit(userId, productId) {
  if (!mongoose.isValidObjectId(productId)) return null;
  await connectDB();
  const product = await Product.findOne({ _id: productId, sellerId: userId }).select('+downloadUrl').populate('category', 'name slug').lean();
  return product ? toPlain(product) : null;
}

/** Hide or show one of the seller's approved products in the store. */
export async function setSellerProductVisibility(userId, productId, isPublished) {
  const product = await ownedProduct(userId, productId);
  if (product.status !== 'approved') throw new InputError('Only approved products can be shown or hidden.', {}, 409);
  const visible = Boolean(isPublished);
  await Product.updateOne({ _id: product._id }, { $set: { isPublished: visible, ...(!visible && { isFeatured: false }) } });
  return { slug: product.slug, isPublished: visible };
}

/** Same rule as the admin delete: never-sold products are deleted, sold ones unpublished so buyers keep downloads. */
export async function deleteSellerProduct(userId, productId) {
  await ownedProduct(userId, productId);
  return deleteProduct(productId);
}

export const LISTINGS_PAGE_SIZE = 24;

/** Listings page status filters (keys match listingStatus() in lib/listing.js). */
const STATUS_FILTERS = {
  all: {},
  active: { status: 'approved', isPublished: true },
  review: { status: 'pending' },
  draft: { status: 'draft' },
  inactive: { status: 'approved', isPublished: false },
  rejected: { status: 'rejected' },
};
export const LISTING_STATUS_KEYS = Object.keys(STATUS_FILTERS);

const LISTING_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  title: { title: 1 },
  price_high: { price: -1, createdAt: -1 },
  price_low: { price: 1, createdAt: -1 },
  sales: { salesCount: -1, createdAt: -1 },
};
export const LISTING_SORT_KEYS = Object.keys(LISTING_SORTS);

/**
 * Seller → Listings: one page of the seller's listings for a status filter, search and sort, with what each one has
 * earned, plus the count behind every status filter. Featured listings (the seller's own pin) always come first.
 */
export async function getSellerListings(userId, { status = 'all', q = '', sort = 'newest', featured = false, page = 1 } = {}) {
  await connectDB();
  const sellerId = new mongoose.Types.ObjectId(String(userId));
  const filter = { sellerId, ...(STATUS_FILTERS[status] ?? {}) };
  const term = String(q ?? '').trim().slice(0, 100);
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ title: rx }, { tags: rx }];
  }
  if (featured) filter.shopFeatured = true;

  const p = Math.max(1, Number.parseInt(page, 10) || 1);
  const [items, total, counts] = await Promise.all([
    Product.find(filter)
      .select('title slug price currency coverImage status isPublished shopFeatured salesCount createdAt updatedAt')
      .sort({ shopFeatured: -1, ...(LISTING_SORTS[sort] ?? LISTING_SORTS.newest) })
      .skip((p - 1) * LISTINGS_PAGE_SIZE)
      .limit(LISTINGS_PAGE_SIZE)
      .lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      { $match: { sellerId } },
      { $group: { _id: { status: '$status', isPublished: '$isPublished' }, count: { $sum: 1 }, featured: { $sum: { $cond: ['$shopFeatured', 1, 0] } } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(LISTING_STATUS_KEYS.map((k) => [k, 0]));
  let featuredCount = 0;
  for (const { _id, count, featured: f } of counts) {
    byStatus.all += count;
    featuredCount += f;
    if (_id.status === 'approved') byStatus[_id.isPublished ? 'active' : 'inactive'] += count;
    else if (_id.status === 'pending') byStatus.review += count;
    else if (_id.status in byStatus) byStatus[_id.status] += count;
  }

  const earnings = await Transaction.aggregate([
    { $match: { seller: sellerId, type: 'sale', product: { $in: items.map((x) => x._id) } } },
    { $group: { _id: '$product', earnings: { $sum: '$sellerEarning' } } },
  ]);
  const byProduct = new Map(earnings.map((e) => [String(e._id), e.earnings]));
  return toPlain({
    items: items.map((x) => ({ ...x, earnings: byProduct.get(String(x._id)) ?? 0 })),
    counts: { ...byStatus, featured: featuredCount },
    total,
    pagination: { page: p, totalPages: Math.max(1, Math.ceil(total / LISTINGS_PAGE_SIZE)) },
  });
}

export const BULK_LISTINGS_MAX = 100;

/**
 * Bulk actions from the Listings toolbar, on the seller's own listings:
 *   activate / deactivate → show or hide approved listings (others are skipped: they aren't in the store yet)
 *   delete                → same rule as a single delete (sold listings are unpublished instead)
 * Returns { done, skipped, archived, slugs } so the caller can refresh the storefront.
 */
export async function bulkSellerListings(userId, action, ids) {
  const unique = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (unique.length === 0) throw new InputError('Select at least one listing.');
  if (unique.length > BULK_LISTINGS_MAX) throw new InputError(`Select at most ${BULK_LISTINGS_MAX} listings at a time.`);
  await connectDB();
  const owned = await Product.find({ _id: { $in: unique }, sellerId: userId }).select('slug status').lean();
  const slugs = owned.map((p) => p.slug);

  if (action === 'activate' || action === 'deactivate') {
    const visible = action === 'activate';
    const approved = owned.filter((p) => p.status === 'approved').map((p) => p._id);
    await Product.updateMany({ _id: { $in: approved } }, { $set: { isPublished: visible, ...(!visible && { isFeatured: false }) } });
    return { done: approved.length, skipped: unique.length - approved.length, archived: 0, slugs };
  }
  if (action === 'delete') {
    let done = 0;
    let archived = 0;
    for (const p of owned) {
      const { result } = await deleteProduct(p._id);
      if (result === 'archived') archived += 1;
      else done += 1;
    }
    return { done, skipped: unique.length - owned.length, archived, slugs };
  }
  throw new InputError('Unknown action.');
}

/** Everything the seller dashboard renders, in parallel. */
export async function getSellerDashboard(userId) {
  await connectDB();
  const sellerId = new mongoose.Types.ObjectId(String(userId));

  const [user, products, salesAgg, recentSales, payouts] = await Promise.all([
    User.findById(sellerId).select(`name email ${SELLER_WITH_BANK}`).lean(),
    Product.find({ sellerId })
      .select('title slug price currency coverImage status isPublished salesCount createdAt')
      .sort({ createdAt: -1 })
      .limit(5) // newest few; the full, paginated list is /seller/listings
      .lean(),
    Transaction.aggregate([
      { $match: { seller: sellerId, type: 'sale' } },
      { $group: { _id: null, count: { $sum: 1 }, gross: { $sum: '$gross' } } },
    ]),
    Transaction.find({ seller: sellerId, type: 'sale' })
      .select('product gross commission sellerEarning commissionRate createdAt')
      .populate('product', 'title slug')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Payout.find({ seller: sellerId }).select('amount status reference paidAt createdAt').sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const seller = user?.seller ?? {};
  const bankDetails = seller.bankDetails ?? {};
  return toPlain({
    storeName: seller.storeName,
    storeDescription: seller.storeDescription ?? '',
    bankDetails,
    hasPayoutMethod: Object.keys(validateBankDetails(bankDetails)).length === 0,
    balances: {
      totalEarnings: seller.totalEarnings ?? 0,
      pendingPayout: seller.pendingPayout ?? 0,
      paidPayout: seller.paidPayout ?? 0,
    },
    sales: { count: salesAgg[0]?.count ?? 0, gross: salesAgg[0]?.gross ?? 0 },
    products,
    recentSales,
    payouts,
    openRequest: payouts.find((p) => p.status === 'requested') ?? null,
  });
}

/** /seller/payouts: balances, saved bank/wallet details and payout history (newest first). */
export async function getSellerPayouts(userId, { limit = 50 } = {}) {
  await connectDB();
  const [user, payouts] = await Promise.all([
    User.findById(userId).select(SELLER_WITH_BANK).lean(),
    Payout.find({ seller: userId }).select('amount status reference paidAt createdAt').sort({ createdAt: -1 }).limit(limit).lean(),
  ]);
  const seller = user?.seller ?? {};
  const bankDetails = seller.bankDetails ?? {};
  return toPlain({
    bankDetails,
    hasPayoutMethod: Object.keys(validateBankDetails(bankDetails)).length === 0,
    balances: {
      totalEarnings: seller.totalEarnings ?? 0,
      pendingPayout: seller.pendingPayout ?? 0,
      paidPayout: seller.paidPayout ?? 0,
    },
    payouts,
    openRequest: payouts.find((p) => p.status === 'requested') ?? null,
  });
}

/**
 * Asks the admin to pay out the current pending balance. At most one open request per seller
 * (enforced by a unique partial index). The admin clears the actual balance at payment time.
 */
export async function requestPayout(userId) {
  await connectDB();
  const user = await User.findOne({ _id: userId, role: 'seller' }).select(SELLER_WITH_BANK).lean();
  if (!user) throw new InputError('Seller account not found.', {}, 404);

  const pending = user.seller?.pendingPayout ?? 0;
  if (pending <= 0) throw new InputError('You have no pending balance to withdraw.', {}, 409);
  if (Object.keys(validateBankDetails(user.seller.bankDetails)).length) {
    throw new InputError('Add your bank or wallet details before requesting a payout.', {}, 409);
  }

  try {
    return toPlain(await Payout.create({ seller: userId, amount: pending, status: 'requested' }));
  } catch (err) {
    if (err?.code === 11000) throw new InputError('You already have a payout request in progress.', {}, 409);
    throw err;
  }
}
