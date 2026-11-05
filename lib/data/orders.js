import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { calculateTotals, chargeAmount, CHARGE_CURRENCY } from '@/lib/pricing';
import { instantReference, paymentProviderFor, PaymentUnavailableError } from '@/lib/payments';
import { checkoutForm, getAccessToken, verifyResult } from '@/lib/payfast';
import { siteConfig } from '@/lib/site';
import { createAccessToken, accessTokenMatches, createDownloadToken } from '@/lib/tokens';
import { toPlain } from '@/lib/utils';
import Order from '@/models/Order';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';
import Transaction from '@/models/Transaction';
import User from '@/models/User';
import Review from '@/models/Review';
import { COMMISSION_RATE, splitSale } from '@/lib/commission';
import { askForIdentityAfterFirstSale } from '@/lib/data/seller-verification';

export const MAX_ITEMS_PER_ORDER = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class OrderError extends Error {
  constructor(message, { status = 400, code = 'invalid_request', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const receiptPath = (orderId, accessToken) => `/checkout/success?order=${orderId}&token=${accessToken}`;

/** Pakistani mobile number in PayFast's format (03XXXXXXXXX), or null. Accepts +92 / 92 / 0 prefixes, spaces, dashes. */
export function normalizeMobile(value) {
  const digits = String(value ?? '').replace(/[\s()-]/g, '').replace(/^\+/, '');
  const local = digits.startsWith('92') ? `0${digits.slice(2)}` : digits.startsWith('3') ? `0${digits}` : digits;
  return /^03\d{9}$/.test(local) ? local : null;
}

/**
 * Books a paid order inside a MongoDB transaction: one ledger line per item, the sellers' balances and the products'
 * sales counts. Tax and fees stay with the platform. Called exactly once per order (guarded by its caller).
 */
async function creditSale(order, session) {
  const credits = new Map(); // sellerId → cents earned in this order
  const ledger = order.items.map((item) => {
    const { commission, sellerEarning } = splitSale(item.price, { hasSeller: Boolean(item.seller) });
    if (item.seller) credits.set(String(item.seller), (credits.get(String(item.seller)) ?? 0) + sellerEarning);
    return {
      type: 'sale',
      seller: item.seller,
      order: order._id,
      product: item.product,
      gross: item.price,
      commission,
      sellerEarning,
      commissionRate: item.seller ? COMMISSION_RATE : 1,
      currency: order.currency,
      paymentProvider: order.paymentProvider,
    };
  });

  await Transaction.insertMany(ledger, { session });
  if (credits.size) {
    await User.bulkWrite(
      [...credits].map(([sellerId, cents]) => ({
        updateOne: { filter: { _id: sellerId }, update: { $inc: { 'seller.totalEarnings': cents, 'seller.pendingPayout': cents } } },
      })),
      { session },
    );
  }
  await Product.bulkWrite(
    order.items.map((i) => ({ updateOne: { filter: { _id: i.product }, update: { $inc: { salesCount: 1 } } } })),
    { session },
  );
}

/**
 * Names and sizes (never locations) of the files each product delivers: productId → [{ name, size }].
 * Products without uploaded files (links, older single-file listings) are left out; deleted products use the copy
 * saved on the order line.
 */
async function fileListsFor(orders) {
  const ids = [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.product))))];
  const products = ids.length ? await Product.find({ _id: { $in: ids } }).select('deliveryType +files').lean() : [];
  const lists = new Map(products.filter((p) => p.deliveryType !== 'external' && p.files?.length).map((p) => [String(p._id), p.files]));
  for (const item of orders.flatMap((o) => o.items)) {
    if (!products.some((p) => String(p._id) === String(item.product)) && item.delivery?.files?.length) lists.set(String(item.product), item.delivery.files);
  }
  return new Map([...lists].map(([id, files]) => [id, files.map(({ name, size }) => ({ name, size }))]));
}

/**
 * Fresh download links for each line of a paid order: `url` (the first or only file) plus `files` (one link per
 * uploaded file, with its name and size) when the product has uploaded files.
 */
function downloadLinksFor(order, fileLists = new Map()) {
  return order.items.map((item) => {
    const link = (fileIndex) => createDownloadToken({ orderId: order._id, productId: item.product, fileIndex });
    const { token, expiresAt } = link(0);
    const files = (fileLists.get(String(item.product)) ?? []).map((f, i) => ({ ...f, url: `/api/downloads/${i ? link(i).token : token}` }));
    return {
      productId: String(item.product),
      title: item.title,
      url: `/api/downloads/${token}`,
      files,
      expiresAt,
    };
  });
}

/**
 * Creates an order from an untrusted checkout payload. Free and demo orders complete at once and return their
 * downloads; PayFast orders are saved as pending and return `payment`, the form that sends the buyer to PayFast.
 * @param {{ email: string, phone?: string, items: Array<{ _id?: string, productId?: string }>, expectedTotal?: number }} input
 * @param {{ userId?: string, userName?: string, customerIp?: string }} [options] signed-in buyer: the order is linked to their account
 */
export async function createOrder(input, { userId, userName, customerIp } = {}) {
  // ---- Validate input ------------------------------------------------------
  const email = String(input?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new OrderError('Please enter a valid email address.', { details: { email: 'Invalid email address' } });
  }
  if (!Array.isArray(input?.items) || input.items.length === 0) {
    throw new OrderError('Your cart is empty.');
  }
  if (input.items.length > MAX_ITEMS_PER_ORDER) {
    throw new OrderError(`An order can contain at most ${MAX_ITEMS_PER_ORDER} items.`);
  }

  const ids = [...new Set(input.items.map((i) => String(i?.productId ?? i?._id ?? '')))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new OrderError('Cart contains an invalid item.');

  await connectDB();

  // ---- Re-price every item from the database (client prices are never trusted) ----
  // Only published AND approved products can be bought.
  const products = await Product.find({ _id: { $in: ids }, ...PUBLIC_PRODUCT_FILTER })
    .select('title slug price currency coverImage sellerId deliveryType fileFormat')
    .lean();

  const found = new Map(products.map((p) => [String(p._id), p]));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    throw new OrderError('Some items are no longer available.', { status: 409, code: 'items_unavailable', details: { missing } });
  }

  const currencies = new Set(products.map((p) => p.currency));
  if (currencies.size > 1) throw new OrderError('All items in an order must use the same currency.');
  const currency = [...currencies][0];

  const items = ids.map((id) => {
    const p = found.get(id);
    return { product: p._id, seller: p.sellerId, title: p.title, slug: p.slug, coverImage: p.coverImage, price: p.price, quantity: 1 };
  });
  const totals = calculateTotals(items.reduce((sum, i) => sum + i.price, 0));

  // If the price changed since the buyer saw it, stop and show them the new prices first.
  if (Number.isInteger(input.expectedTotal) && input.expectedTotal !== totals.total) {
    throw new OrderError('Prices have changed since you added these items. Please review your cart.', {
      status: 409,
      code: 'price_changed',
      details: { items: toPlain(products.map(({ _id, title, slug, price, currency: c, coverImage, deliveryType, fileFormat }) => ({ _id, title, slug, price, currency: c, coverImage, deliveryType, fileFormat }))) },
    });
  }

  // ---- Payment (see lib/payments.js) -----------------------------------------
  const provider = paymentProviderFor(totals.total);
  const phone = normalizeMobile(input.phone);
  if (provider === 'payfast' && !phone) {
    throw new OrderError('Please enter your mobile number, e.g. 0300 1234567.', { details: { phone: 'Enter a Pakistani mobile number' } });
  }

  const access = createAccessToken();
  const base = {
    _id: new mongoose.Types.ObjectId(),
    buyerEmail: email,
    buyerPhone: phone ?? undefined,
    user: userId && mongoose.isValidObjectId(userId) ? userId : undefined,
    items,
    taxAmount: totals.tax,
    feeAmount: totals.fee,
    currency,
    paymentProvider: provider,
    accessTokenHash: access.hash,
  };

  // ---- Free / demo: complete now -------------------------------------------
  // One MongoDB transaction: the order, every ledger line and every balance update commit together, or none do.
  if (provider !== 'payfast') {
    let order;
    await mongoose.connection.transaction(async (session) => {
      [order] = await Order.create([{ ...base, paymentStatus: 'paid', paymentReference: instantReference(provider), paidAt: new Date() }], { session });
      await creditSale(order, session);
    });
    await askForIdentityAfterFirstSale(order); // after the commit; never fails the order
    return {
      orderId: String(order._id),
      status: order.status,
      buyerEmail: order.buyerEmail,
      currency: order.currency,
      totals: { subtotal: order.subtotal, tax: order.taxAmount, fee: order.feeAmount, total: order.totalAmount },
      receiptUrl: receiptPath(order._id, access.token),
      downloads: downloadLinksFor(order, await fileListsFor([order])),
    };
  }

  // ---- PayFast: save as pending, then send the buyer to PayFast -------------
  const { paisa, rate } = chargeAmount(totals.total, currency);
  const order = await Order.create({
    ...base,
    paymentStatus: 'pending',
    paymentReference: `payfast_${base._id}`,
    charge: { amount: paisa, currency: CHARGE_CURRENCY, rate },
  });
  const basketId = String(order._id);
  try {
    const token = await getAccessToken({ basketId, amountPaisa: paisa, currency: CHARGE_CURRENCY });
    // PayFast appends its result to this URL. The receipt token rides along so the buyer lands on their receipt
    // even when a wallet app reopens the site in another browser.
    const returnUrl = `${siteConfig.url}/api/payments/payfast/return?order=${basketId}&token=${access.token}`;
    const payment = checkoutForm({
      token,
      basketId,
      amountPaisa: paisa,
      currency: CHARGE_CURRENCY,
      description: `${siteConfig.name} order #${basketId.slice(-8).toUpperCase()}: ${items.map((i) => i.title).join(', ')}`,
      email,
      mobile: phone,
      name: userName,
      returnUrl,
      notifyUrl: `${siteConfig.url}/api/payments/payfast/notify`,
      customerIp,
    });
    return { orderId: basketId, status: 'pending', payment };
  } catch (err) {
    console.error('[createOrder] PayFast checkout could not start', err);
    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: 'failed', status: 'cancelled', 'charge.message': 'Payment could not be started' } });
    throw new PaymentUnavailableError('We couldn’t reach the payment gateway. Please try again in a minute.');
  }
}

/**
 * Applies a result PayFast sent (the buyer's return or the server-to-server notification; both may arrive, in any
 * order, more than once). Verifies its signature, then marks the order paid and books the sale exactly once, or
 * records the decline.
 * @returns {{ ok: boolean, orderId?: string, paid?: boolean, reason?: string, message?: string }}
 */
export async function settlePayFastResult(raw) {
  const result = verifyResult(raw);
  if (!result) return { ok: false, reason: 'invalid_signature' };
  if (!mongoose.isValidObjectId(result.basketId)) return { ok: false, reason: 'unknown_order' };
  await connectDB();

  const order = await Order.findById(result.basketId).select('paymentStatus paymentProvider statusSetBy charge').lean();
  if (!order || order.paymentProvider !== 'payfast') return { ok: false, reason: 'unknown_order' };
  const orderId = String(order._id);
  const details = {
    'charge.code': result.code,
    'charge.message': result.message.slice(0, 300),
    ...(result.transactionId && { 'charge.transactionId': result.transactionId }),
    ...(result.method && { 'charge.method': result.method }),
  };

  if (!result.approved) {
    // A decline never undoes a payment that already went through (e.g. a late duplicate notification).
    const { modifiedCount } = await Order.updateOne({ _id: order._id, paymentStatus: 'pending' }, { $set: { paymentStatus: 'failed', ...details } });
    if (modifiedCount) await Order.updateOne({ _id: order._id, statusSetBy: { $ne: 'admin' } }, { $set: { status: 'cancelled' } });
    return { ok: true, orderId, paid: order.paymentStatus === 'paid', message: result.message };
  }

  // The amount is fixed by the access token, so this only guards against a gateway mix-up: never accept less.
  const reported = Math.round(parseFloat(String(result.amount).replace(/,/g, '')) * 100);
  if (Number.isFinite(reported) && reported < order.charge.amount) {
    console.error(`[PayFast] order ${orderId}: paid ${reported} paisa, expected ${order.charge.amount}`);
    await Order.updateOne({ _id: order._id }, { $set: { ...details, 'charge.message': `Amount mismatch: received ${result.amount}` } });
    return { ok: false, orderId, reason: 'amount_mismatch' };
  }

  // Conditional update inside the transaction: only the first result to arrive books the sale.
  let booked = null;
  await mongoose.connection.transaction(async (session) => {
    booked = null; // the callback may be retried
    const paid = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $in: ['pending', 'failed'] } },
      { $set: { paymentStatus: 'paid', paidAt: new Date(), ...details } },
      { session, new: true },
    );
    if (!paid) return; // already paid
    if (paid.statusSetBy !== 'admin') await Order.updateOne({ _id: order._id }, { $set: { status: 'completed' } }, { session });
    await creditSale(paid, session);
    booked = paid;
  });
  if (booked) await askForIdentityAfterFirstSale(booked); // after the commit; never fails the payment
  return { ok: true, orderId, paid: true };
}

/** Loads a receipt only when the caller presents the order's access token. */
export async function getOrderReceipt(orderId, accessToken) {
  if (!mongoose.isValidObjectId(orderId) || typeof accessToken !== 'string') return null;
  await connectDB();

  const order = await Order.findById(orderId).select('+accessTokenHash').lean();
  if (!order || !accessTokenMatches(accessToken, order.accessTokenHash)) return null;

  const { accessTokenHash: _omit, ...rest } = order; // order.user (if any) tells the page who owns it
  rest.items = rest.items.map(({ delivery: _private, ...item }) => item); // delivery copies stay on the server
  const paid = order.status === 'completed' && order.paymentStatus === 'paid';
  return { order: toPlain(rest), downloads: paid ? downloadLinksFor(order, await fileListsFor([order])) : [] };
}

/**
 * Records one download for (order, product) if the order is paid and contains the product — there is no
 * lifetime cap (re-downloads are unlimited; the route throttles bursts). Returns the product (including its
 * private downloadUrl) or an error code.
 */
export async function consumeDownload({ orderId, productId }) {
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(productId)) return { error: 'invalid' };
  await connectDB();

  const { matchedCount } = await Order.updateOne(
    {
      _id: orderId,
      status: 'completed',
      paymentStatus: 'paid',
      'items.product': productId,
    },
    { $inc: { 'items.$.downloadCount': 1 }, $set: { 'items.$.lastDownloadedAt': new Date() } },
  );
  if (matchedCount === 0) return { error: 'invalid' };

  // Explicitly selecting a select:false field includes it. Unpublished products stay downloadable for buyers.
  const product = await Product.findById(productId).select('title slug deliveryType downloadUrl sourceFileName +files').lean();
  if (product) return { product };

  // Deleted product: deliver from the copy saved on the order line.
  const order = await Order.findOne({ _id: orderId, 'items.product': productId }, { 'items.$': 1 }).lean();
  const line = order?.items?.[0];
  if (!line?.delivery?.downloadUrl) return { error: 'invalid' };
  return { product: { _id: line.product, title: line.title, slug: line.slug, ...line.delivery } };
}

// ---------------------------------------------------------------------------
// Customer accounts
// ---------------------------------------------------------------------------

/**
 * Every item the user has bought, newest first, each with a freshly minted download link.
 * Only orders LINKED to the account (user field) are returned — never orders that merely share
 * the email address, because emails aren't verified and anyone could sign up with yours.
 */
export async function getUserPurchases(userId) {
  if (!mongoose.isValidObjectId(userId)) return [];
  await connectDB();

  const orders = await Order.find({ user: userId, status: 'completed', paymentStatus: 'paid' })
    .select('items currency paidAt createdAt')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const fileLists = await fileListsFor(orders);
  return orders.flatMap((order) => {
    const links = new Map(downloadLinksFor(order, fileLists).map((d) => [d.productId, d]));
    return order.items.map((item) => {
      const link = links.get(String(item.product));
      return toPlain({
        orderId: order._id,
        orderNumber: String(order._id).slice(-8).toUpperCase(),
        productId: item.product,
        title: item.title,
        slug: item.slug,
        coverImage: item.coverImage,
        pricePaid: item.price,
        currency: order.currency,
        purchasedAt: order.paidAt ?? order.createdAt,
        downloadCount: item.downloadCount ?? 0,
        lastDownloadedAt: item.lastDownloadedAt ?? null,
        downloadUrl: link.url,
        files: link.files,
      });
    });
  });
}

/**
 * Links a guest order to an account. Possession of the receipt's access token is the proof of
 * ownership (an email match is not). Already-linked orders can't be moved to another account.
 * @returns {'linked' | 'already_yours' | 'owned_by_other' | 'not_found'}
 */
export async function claimOrder({ orderId, accessToken, userId }) {
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(userId) || typeof accessToken !== 'string') return 'not_found';
  await connectDB();

  const order = await Order.findById(orderId).select('+accessTokenHash user').lean();
  if (!order || !accessTokenMatches(accessToken, order.accessTokenHash)) return 'not_found';
  if (order.user) return String(order.user) === String(userId) ? 'already_yours' : 'owned_by_other';

  // Conditional update: if two accounts race to claim the same order, only one wins.
  const { modifiedCount } = await Order.updateOne({ _id: orderId, user: { $exists: false } }, { $set: { user: userId } });
  return modifiedCount ? 'linked' : 'owned_by_other';
}

/**
 * Admin: permanently delete an order (e.g. a test purchase), undoing what booking its sale did (creditSale): its ledger
 * lines, each seller's earnings and pending payout, each product's sales count, and reviews written from it. Refused
 * when a seller has already been paid out that money (their balance would go below zero). Safe to retry: each ledger
 * line is removed before its amounts are taken back, so nothing is taken back twice. UNGUARDED: check for an admin first.
 */
export async function deleteOrder(orderId) {
  if (!mongoose.isValidObjectId(orderId)) throw new OrderError('Order not found.', { status: 404 });
  await connectDB();
  const order = await Order.findById(orderId).select('_id').lean();
  if (!order) throw new OrderError('Order not found.', { status: 404 });

  const lines = await Transaction.find({ order: order._id, type: 'sale' }).select('seller product sellerEarning').lean();
  // What each seller earned from this order, and whether they still have it in their pending balance.
  const owed = new Map();
  for (const l of lines) if (l.seller) owed.set(String(l.seller), (owed.get(String(l.seller)) ?? 0) + l.sellerEarning);
  if (owed.size) {
    const sellers = await User.find({ _id: { $in: [...owed.keys()] } }).select('seller.storeName seller.pendingPayout').lean();
    const paidOut = sellers.find((s) => (s.seller?.pendingPayout ?? 0) < owed.get(String(s._id)));
    if (paidOut) {
      throw new OrderError(`${paidOut.seller?.storeName ?? 'The seller'} has already been paid out this money, so the order can’t be deleted.`, { status: 409 });
    }
  }

  for (const line of lines) {
    const removed = await Transaction.findOneAndDelete({ _id: line._id }).lean();
    if (!removed) continue; // already undone by an earlier attempt
    if (removed.seller) {
      await User.updateOne({ _id: removed.seller }, { $inc: { 'seller.totalEarnings': -removed.sellerEarning, 'seller.pendingPayout': -removed.sellerEarning } });
    }
    if (removed.product) await Product.updateOne({ _id: removed.product, salesCount: { $gt: 0 } }, { $inc: { salesCount: -1 } });
  }
  const { deletedCount: reviews } = await Review.deleteMany({ order: order._id });
  await Order.deleteOne({ _id: order._id });
  return { deleted: true, salesUndone: lines.length, reviews };
}
