import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { toPlain } from '@/lib/utils';
import { validateStoreName, validateStoreDescription, validateBankDetails, normalizeBankDetails } from '@/lib/validation';
import { createProduct, deleteProduct, SELLER_FIELDS, InputError } from '@/lib/data/product-writes';
import User, { SELLER_WITH_BANK } from '@/models/User';
import Product from '@/models/Product';
import Transaction from '@/models/Transaction';
import Payout from '@/models/Payout';

// Seller-side business logic. Callers (pages/API routes) must authorize first and pass the
// signed-in user's id — never an id taken from the request body.

const isHttpsUrl = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

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

/** Seller uploads always start 'pending' and belong to the uploader; admins approve them. */
export async function createSellerProduct(userId, payload) {
  const link = payload?.pdfFileUrl ?? payload?.downloadUrl;
  if (link && !isHttpsUrl(link)) {
    throw new InputError('Please fix the highlighted fields.', { downloadUrl: 'The PDF link must be a secure https:// URL.' });
  }
  return createProduct(payload, {
    fields: SELLER_FIELDS,
    allowCustomSlug: false,
    overrides: { sellerId: userId, status: 'pending', isPublished: true, isFeatured: false, deliveryType: 'file' },
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

/** The seller's catalogue with what each product has earned them. */
export async function getSellerProducts(userId) {
  await connectDB();
  const sellerId = new mongoose.Types.ObjectId(String(userId));
  const [products, earnings] = await Promise.all([
    Product.find({ sellerId }).select('title slug price currency coverImage status isPublished salesCount createdAt').sort({ createdAt: -1 }).limit(200).lean(),
    Transaction.aggregate([
      { $match: { seller: sellerId, type: 'sale' } },
      { $group: { _id: '$product', earnings: { $sum: '$sellerEarning' } } },
    ]),
  ]);
  const byProduct = new Map(earnings.map((e) => [String(e._id), e.earnings]));
  return toPlain(products.map((p) => ({ ...p, earnings: byProduct.get(String(p._id)) ?? 0 })));
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
      .limit(100)
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
