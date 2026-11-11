import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex, formatPrice, toPlain } from '@/lib/utils';
import { MAX_SHOP_FEATURED, MADE_WHEN, validateListing } from '@/lib/listing';
import { MIN_PAYOUT, payoutFee } from '@/lib/commission';
import { getCategories } from '@/lib/data/categories';
import { getMarketplaceSettings } from '@/lib/data/settings';
import { checkListingUploads, filesForEdit, mediaBytes } from '@/lib/uploads';
import { validateStoreName, validateStoreDescription, validateBankDetails, normalizeBankDetails } from '@/lib/validation';
import { createProduct, deleteProduct, savedUploads, updateProduct, SELLER_FIELDS, InputError } from '@/lib/data/product-writes';
import User, { SELLER_WITH_BANK } from '@/models/User';
import { bankDetailsUpdate, readBankDetails } from '@/lib/field-encryption';
import { checkStep, EMPTY_ONBOARDING } from '@/lib/seller-onboarding';
import { revalidatePath } from 'next/cache';
import { pingIndexNow } from '@/lib/indexnow';
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
  // Optional: shops opened with the wizard may not have one yet. When given, the usual rules apply.
  const descriptionError = String(storeDescription ?? '').trim() ? validateStoreDescription(storeDescription) : null;
  if (descriptionError) fields.storeDescription = descriptionError;
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  return { storeName: String(storeName).trim(), storeDescription: String(storeDescription ?? '').trim() };
}

const storeNameTaken = (err) =>
  err?.code === 11000 ? new InputError('That shop name is taken.', { storeName: 'That shop name is already taken.' }, 409) : err;

/** After a shop's public details change: its page, and product pages ("Sold by …" card) on their next visit. */
function refreshShop(userId) {
  revalidatePath(`/shop/${userId}`);
  revalidatePath('/products/[slug]', 'page');
  pingIndexNow([`/shop/${userId}`]); // the shop page changed (lib/indexnow.js)
}

/** /seller/settings: everything set when the shop was opened, all editable there. */
export async function getShopSettings(userId) {
  await connectDB();
  const user = await User.findById(userId)
    .select('seller.storeName seller.storeDescription seller.logo seller.banner seller.country seller.currency +seller.address +seller.phone')
    .lean();
  const s = user?.seller ?? {};
  const empty = EMPTY_ONBOARDING.billing;
  return toPlain({
    profile: { storeName: s.storeName ?? '', storeDescription: s.storeDescription ?? '', logo: s.logo ?? '', banner: s.banner ?? '' },
    contact: {
      country: s.country || EMPTY_ONBOARDING.preferences.country,
      currency: s.currency || EMPTY_ONBOARDING.preferences.currency,
      address: { ...empty.address, ...(s.address ?? {}) },
      phone: { ...empty.phone, ...(s.phone ?? {}) },
    },
  });
}

/**
 * Shop name, description, logo and banner (Shop settings). Same rules as when the shop was opened. The logo and
 * banner change only when sent ('' removes one), so an older form that sends just the name and description keeps them.
 */
export async function updateStoreDetails(userId, input = {}) {
  const store = validateStore(input);
  const set = { 'seller.storeName': store.storeName, 'seller.storeDescription': store.storeDescription };
  const unset = {};
  for (const key of ['logo', 'banner']) {
    if (input[key] === undefined) continue;
    const value = String(input[key] ?? '').trim();
    const checked = checkStep('identity', { storeName: store.storeName, [key]: value });
    if (!checked.ok && checked.errors[key]) throw new InputError('Please fix the highlighted fields.', { [key]: checked.errors[key] });
    if (value) set[`seller.${key}`] = value;
    else unset[`seller.${key}`] = 1;
    store[key] = value;
  }
  await connectDB();
  try {
    const { matchedCount } = await User.updateOne(
      { _id: userId, role: 'seller', 'seller.storeName': { $exists: true } },
      { $set: set, ...(Object.keys(unset).length && { $unset: unset }) },
      { runValidators: true },
    );
    if (!matchedCount) throw new InputError('Set up your shop first.', {}, 409);
  } catch (err) {
    throw storeNameTaken(err);
  }
  refreshShop(userId);
  return store;
}

/**
 * Where the shop is based, its currency, billing address and phone (Shop settings). Checked with the same rules as the
 * shop-opening wizard; the address and phone stay private (the seller and admins only).
 */
export async function updateShopContact(userId, input = {}) {
  const prefs = checkStep('preferences', { country: input.country, currency: input.currency });
  const billing = checkStep('billing', { address: input.address, phone: input.phone });
  const fields = { ...(prefs.ok ? {} : prefs.errors), ...(billing.ok ? {} : billing.errors) };
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  const { country, currency } = prefs.data;
  const { address, phone } = billing.data;
  await connectDB();
  const { matchedCount } = await User.updateOne(
    { _id: userId, role: 'seller', 'seller.storeName': { $exists: true } },
    {
      $set: {
        'seller.country': country,
        'seller.currency': currency,
        'seller.address': { ...address, country },
        'seller.phone': phone,
      },
    },
    { runValidators: true },
  );
  if (!matchedCount) throw new InputError('Set up your shop first.', {}, 409);
  refreshShop(userId); // the country shows on the shop page
  return { country, currency, address, phone };
}

/** Where payouts are sent. Balances are never writable here. */
export async function updatePayoutDetails(userId, bankDetails) {
  const fields = validateBankDetails(bankDetails);
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  const normalized = normalizeBankDetails(bankDetails);
  await connectDB();
  // Encrypted at rest when DATA_ENCRYPTION_KEY is set (lib/field-encryption.js).
  const { matchedCount } = await User.updateOne({ _id: userId, role: 'seller' }, bankDetailsUpdate(normalized), { runValidators: true });
  if (!matchedCount) throw new InputError('Seller account not found.', {}, 404);
  return { bankDetails: normalized };
}

/**
 * Checks a listing from the seller form and derives the cover from the first photo. `draft` listings only need a
 * title; anything submitted for review must be complete (lib/listing.js has the rules). Uploaded files are checked
 * to really be what they say, measured, and kept within the listing's upload limit (lib/uploads.js); their total
 * size and formats are recorded for the product page. `previous` = the listing's saved upload URLs (edits).
 */
async function listingPayload(payload, draft, previous = []) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new InputError('Request body must be a JSON object');
  const fields = validateListing(payload, { draft, categories: await getCategories() });
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
    data.files = [];
    data.sourceFileName = null;
  } else {
    const files = Array.isArray(payload.files) ? payload.files : [];
    const checked = await checkListingUploads({ files, images: data.images, videos: data.videos, previous });
    data.files = checked.files; // downloadUrl, sourceFileName and fileSize follow from these (lib/data/product-writes.js)
    if (!checked.files.length) data.downloadUrl = null;
    data.fileFormat ||= checked.format;
  }
  return data;
}


/** Where a submitted listing goes: live at once ('approved') when the admin has auto-approve on, else 'pending'. */
async function submittedStatus(draft) {
  if (draft) return 'draft';
  return (await getMarketplaceSettings()).autoApproveListings ? 'approved' : 'pending';
}

/**
 * A new listing: saved as a private draft, or submitted: live at once with auto-approve on (Admin → Products),
 * otherwise waiting for review ('pending'). Always owned by the seller.
 */
export async function createSellerProduct(userId, payload, { draft = false } = {}) {
  if (payload?.shopFeatured) {
    await connectDB();
    await assertFeatureSlot(userId);
  }
  return createProduct(await listingPayload(payload, draft), {
    fields: SELLER_FIELDS,
    allowCustomSlug: false,
    overrides: { sellerId: userId, status: await submittedStatus(draft), isFeatured: false },
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
 * Seller edits one of their listings. With auto-approve on, a submitted edit is live at once; with it off it goes back
 * to "In review" so an admin re-approves the changed content (hidden from the store meanwhile). Either way that's also
 * how rejected listings are resubmitted. Saving as a draft takes it out of the store until it's submitted again.
 */
export async function updateSellerProduct(userId, productId, payload, { draft = false } = {}) {
  const owned = await ownedProduct(userId, productId);
  if (payload?.shopFeatured) await assertFeatureSlot(userId, owned._id);
  const data = await listingPayload(payload, draft, await savedUploads(productId));
  return updateProduct(productId, data, { fields: SELLER_FIELDS, ownerId: userId, allowCustomSlug: false, overrides: { status: await submittedStatus(draft) } });
}

export const RECENT_CATEGORY_COUNT = 3;

/**
 * The categories (ids) of the seller's last few listings, newest first and each once: the listing form offers them as
 * one-click "Recently used" picks. A new listing in another category pushes the oldest one out.
 */
export async function getRecentListingCategories(userId, limit = RECENT_CATEGORY_COUNT) {
  if (!mongoose.isValidObjectId(userId)) return [];
  await connectDB();
  const rows = await Product.aggregate([
    { $match: { sellerId: new mongoose.Types.ObjectId(String(userId)), category: { $ne: null } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$category', at: { $first: '$createdAt' } } },
    { $sort: { at: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => String(r._id));
}

/** One of the seller's products with its private download link, for the edit form. */
export async function getSellerProductForEdit(userId, productId) {
  if (!mongoose.isValidObjectId(productId)) return null;
  await connectDB();
  const product = await Product.findOne({ _id: productId, sellerId: userId }).select('+downloadUrl +files').populate('category', 'name slug').lean();
  if (!product) return null;
  return toPlain({ ...product, files: filesForEdit(product), mediaBytes: await mediaBytes([...(product.images ?? []), ...(product.videos ?? [])]) });
}

/** Hide or show one of the seller's approved products in the store. */
export async function setSellerProductVisibility(userId, productId, isPublished) {
  const product = await ownedProduct(userId, productId);
  if (product.status !== 'approved') throw new InputError('Only approved products can be shown or hidden.', {}, 409);
  const visible = Boolean(isPublished);
  await Product.updateOne({ _id: product._id }, { $set: { isPublished: visible, ...(!visible && { isFeatured: false }) } });
  return { slug: product.slug, isPublished: visible };
}

/** Refuses a 4th featured listing: at most MAX_SHOP_FEATURED per seller (not counting `productId` itself). */
async function assertFeatureSlot(userId, productId) {
  const others = await Product.countDocuments({ sellerId: userId, shopFeatured: true, ...(productId && { _id: { $ne: productId } }) });
  if (others >= MAX_SHOP_FEATURED) {
    throw new InputError(`You can feature up to ${MAX_SHOP_FEATURED} listings. Unfeature one first.`, { shopFeatured: `You can feature up to ${MAX_SHOP_FEATURED} listings.` }, 409);
  }
}

/** Star / unstar a listing: featured listings (max MAX_SHOP_FEATURED) lead the seller's shop page and their listings page. */
export async function setSellerProductFeatured(userId, productId, featured) {
  const product = await ownedProduct(userId, productId);
  if (featured) await assertFeatureSlot(userId, product._id);
  await Product.updateOne({ _id: product._id }, { $set: { shopFeatured: Boolean(featured) } });
  return { slug: product.slug, shopFeatured: Boolean(featured) };
}

/**
 * "Copy" in the listing menu: a new private draft with the same content, photos and files ("Copy of …"), so the
 * seller can tweak it and submit it as a separate listing. Sales, reviews and featuring are not copied.
 */
export async function copySellerProduct(userId, productId) {
  await ownedProduct(userId, productId);
  const source = await Product.findById(productId).select('+downloadUrl +files').lean();
  const payload = Object.fromEntries(SELLER_FIELDS.filter((f) => source[f] != null).map((f) => [f, source[f]]));
  return createProduct(
    { ...payload, title: `Copy of ${source.title}`.slice(0, 140), category: source.category ? String(source.category) : undefined, shopFeatured: false, isPublished: false },
    { fields: SELLER_FIELDS, allowCustomSlug: false, overrides: { sellerId: userId, status: 'draft', isFeatured: false } },
  );
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

  // Drafts and rejected listings on this page: what each still needs before it can go live (shown on its card).
  const unsubmitted = items.filter((x) => x.status === 'draft' || x.status === 'rejected').map((x) => x._id);
  const needsOf = new Map();
  if (unsubmitted.length) {
    const [categories, full] = await Promise.all([
      getCategories(),
      Product.find({ _id: { $in: unsubmitted } }).select('+downloadUrl +files').lean(),
    ]);
    for (const p of full) needsOf.set(String(p._id), missingForPublish(p, categories).needs);
  }
  return toPlain({
    items: items.map((x) => ({ ...x, earnings: byProduct.get(String(x._id)) ?? 0, needs: needsOf.get(String(x._id)) ?? null })),
    counts: { ...byStatus, featured: featuredCount },
    total,
    pagination: { page: p, totalPages: Math.max(1, Math.ceil(total / LISTINGS_PAGE_SIZE)) },
  });
}

export const BULK_LISTINGS_MAX = 100;

/**
 * Bulk actions from the Listings toolbar, on the seller's own listings:
 *   activate / deactivate → show or hide approved listings (others are skipped: they aren't in the store yet)
 *   delete                → permanent, like a single delete (buyers of sold listings keep their downloads)
 * Returns { done, skipped, sold, slugs } so the caller can refresh the storefront.
 */
// Form fields → the words sellers see, for "still needs …" messages.
const FIELD_NAMES = {
  title: 'a title',
  description: 'a description',
  price: 'a price',
  images: 'photos',
  category: 'a category',
  files: 'the file',
  downloadUrl: 'the file',
  tags: 'tags',
  madeBy: 'who made it',
  itemType: 'what it is',
  madeWhen: 'when it was made',
  license: 'a licence',
  rightsConfirmed: 'your rights confirmation',
};

/**
 * Submits complete drafts, checked with the same rules as the listing form's Publish button. Complete ones go live at
 * once (auto-approve on) or into review; incomplete ones stay drafts and come back with what they still need.
 */
/**
 * What a saved listing still needs before it can be published (the listing form's Publish rules), as words for the
 * seller: [] when it's complete. "When was it made?" has one choice left, so a missing or retired answer is filled in
 * (`form.madeWhen`) rather than reported.
 */
function missingForPublish(product, categories) {
  const form = { ...product, category: product.category ? String(product.category) : '' };
  if (!MADE_WHEN.some((o) => o.value === form.madeWhen)) form.madeWhen = MADE_WHEN[0].value;
  const errors = validateListing(form, { draft: false, categories });
  return { needs: [...new Set(Object.keys(errors).map((f) => FIELD_NAMES[f] ?? f))], madeWhen: form.madeWhen };
}

async function submitDrafts(userId, ids) {
  const [categories, status] = await Promise.all([getCategories(), submittedStatus(false)]);
  const drafts = await Product.find({ _id: { $in: ids }, sellerId: userId }).select('+downloadUrl +files').lean();
  const ready = [];
  const incomplete = [];
  for (const p of drafts) {
    const { needs, madeWhen } = missingForPublish(p, categories);
    if (needs.length) incomplete.push({ id: String(p._id), title: p.title, coverImage: p.coverImage ?? null, needs });
    else ready.push({ id: p._id, madeWhen });
  }
  if (ready.length) {
    await Product.bulkWrite(
      ready.map((r) => ({ updateOne: { filter: { _id: r.id }, update: { $set: { status, isPublished: true, madeWhen: r.madeWhen } } } })),
    );
  }
  return { submitted: ready.length, live: status === 'approved' ? ready.length : 0, incomplete };
}

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
    if (!visible) return { done: approved.length, skipped: unique.length - approved.length, sold: 0, slugs };
    // Drafts (and rejected listings) are submitted like the form's Publish button, when they're complete.
    const unsubmitted = owned.filter((p) => p.status === 'draft' || p.status === 'rejected').map((p) => p._id);
    const submit = unsubmitted.length ? await submitDrafts(userId, unsubmitted) : { submitted: 0, live: 0, incomplete: [] };
    return {
      done: approved.length,
      ...submit,
      skipped: unique.length - approved.length - unsubmitted.length, // already in review
      sold: 0,
      slugs,
    };
  }
  if (action === 'delete') {
    let sold = 0;
    for (const p of owned) {
      const { orderCount } = await deleteProduct(p._id);
      if (orderCount) sold += 1;
    }
    return { done: owned.length, skipped: unique.length - owned.length, sold, slugs };
  }
  throw new InputError('Unknown action.');
}

/** Everything the seller dashboard renders, in parallel. */
export async function getSellerDashboard(userId) {
  await connectDB();
  const sellerId = new mongoose.Types.ObjectId(String(userId));

  const [user, products, salesAgg, recentSales, payouts] = await Promise.all([
    User.findById(sellerId).select(`name email ${SELLER_WITH_BANK} seller.logo seller.verification.status seller.verification.note seller.verificationRequestedAt`).lean(),
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
    Payout.find({ seller: sellerId }).select('amount fee netAmount status reference paidAt createdAt').sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const seller = user?.seller ?? {};
  const bankDetails = readBankDetails(seller);
  return toPlain({
    storeName: seller.storeName,
    storeDescription: seller.storeDescription ?? '',
    logo: seller.logo ?? null,
    // The ID check from opening the shop: only its outcome and the admin's reason, never the ID itself.
    verification: seller.verification?.status ? { status: seller.verification.status, note: seller.verification.note ?? '' } : null,
    verificationRequested: Boolean(seller.verificationRequestedAt),
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
    User.findById(userId).select(`${SELLER_WITH_BANK} seller.verification.status seller.verificationRequestedAt`).lean(),
    Payout.find({ seller: userId }).select('amount fee netAmount status reference paidAt createdAt').sort({ createdAt: -1 }).limit(limit).lean(),
  ]);
  const seller = user?.seller ?? {};
  const bankDetails = readBankDetails(seller);
  return toPlain({
    bankDetails,
    hasPayoutMethod: Object.keys(validateBankDetails(bankDetails)).length === 0,
    verification: user?.seller?.verification?.status ?? null, // payouts wait for a verified identity
    verificationRequested: Boolean(user?.seller?.verificationRequestedAt), // set at the first sale
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
  const user = await User.findOne({ _id: userId, role: 'seller' }).select(`${SELLER_WITH_BANK} seller.verification.status`).lean();
  if (!user) throw new InputError('Seller account not found.', {}, 404);
  // Identity first (asked for after the first sale, /seller/verify): money only goes to a verified seller.
  if (user.seller?.verification?.status !== 'verified') {
    throw new InputError(
      user.seller?.verification?.status === 'pending' ? 'We’re still checking your identity. You can request a payout once it’s verified.' : 'Verify your identity before requesting a payout.',
      {},
      409,
    );
  }

  const pending = user.seller?.pendingPayout ?? 0;
  if (pending <= 0) throw new InputError('You have no pending balance to withdraw.', {}, 409);
  if (pending < MIN_PAYOUT) {
    throw new InputError(
      `Payouts start at ${formatPrice(MIN_PAYOUT, 'USD')}. You have ${formatPrice(pending, 'USD')}, ${formatPrice(MIN_PAYOUT - pending, 'USD')} to go.`,
      {},
      409,
    );
  }
  if (Object.keys(validateBankDetails(readBankDetails(user.seller))).length) {
    throw new InputError('Add your bank or wallet details before requesting a payout.', {}, 409);
  }

  try {
    // The fee shown with the request; it's worked out again from the amount actually cleared when the admin pays it.
    const { fee, net } = payoutFee(pending);
    return toPlain(await Payout.create({ seller: userId, amount: pending, fee, netAmount: net, status: 'requested' }));
  } catch (err) {
    if (err?.code === 11000) throw new InputError('You already have a payout request in progress.', {}, 409);
    throw err;
  }
}
