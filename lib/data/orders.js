import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { calculateTotals } from '@/lib/pricing';
import { chargeOrder } from '@/lib/payments';
import { createAccessToken, accessTokenMatches, createDownloadToken } from '@/lib/tokens';
import { toPlain } from '@/lib/utils';
import Order, { MAX_DOWNLOADS_PER_ITEM } from '@/models/Order';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';
import Transaction from '@/models/Transaction';
import User from '@/models/User';
import { COMMISSION_RATE, splitSale } from '@/lib/commission';

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

function downloadLinksFor(order) {
  return order.items.map((item) => {
    const { token, expiresAt } = createDownloadToken({ orderId: order._id, productId: item.product });
    return {
      productId: String(item.product),
      title: item.title,
      url: `/api/downloads/${token}`,
      expiresAt,
      downloadsRemaining: Math.max(0, MAX_DOWNLOADS_PER_ITEM - (item.downloadCount ?? 0)),
    };
  });
}

/**
 * Creates and completes an order from an untrusted checkout payload.
 * @param {{ email: string, items: Array<{ _id?: string, productId?: string }>, expectedTotal?: number }} input
 * @param {{ userId?: string }} [options] signed-in buyer — the order is linked to their account
 */
export async function createOrder(input, { userId } = {}) {
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
    .select('title slug price currency coverImage sellerId')
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
      details: { items: toPlain(products.map(({ _id, title, slug, price, currency: c, coverImage }) => ({ _id, title, slug, price, currency: c, coverImage }))) },
    });
  }

  // ---- Payment (see lib/payments.js) -----------------------------------------
  const payment = await chargeOrder({ total: totals.total, currency });

  // ---- Persist order + ledger + seller balances atomically ------------------
  // One MongoDB transaction: either the order, every ledger line and every balance update
  // commit together, or none of them do. Tax and fees stay with the platform.
  const access = createAccessToken();
  let order;
  await mongoose.connection.transaction(async (session) => {
    [order] = await Order.create(
      [
        {
          buyerEmail: email,
          user: userId && mongoose.isValidObjectId(userId) ? userId : undefined,
          items,
          taxAmount: totals.tax,
          feeAmount: totals.fee,
          currency,
          status: 'completed',
          paymentStatus: 'paid',
          paymentProvider: payment.provider,
          paymentReference: payment.reference,
          paidAt: new Date(),
          accessTokenHash: access.hash,
        },
      ],
      { session },
    );

    const credits = new Map(); // sellerId → cents earned in this order
    const ledger = items.map((item) => {
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
        currency,
        paymentProvider: payment.provider,
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
      items.map((i) => ({ updateOne: { filter: { _id: i.product }, update: { $inc: { salesCount: 1 } } } })),
      { session },
    );
  });

  return {
    orderId: String(order._id),
    status: order.status,
    buyerEmail: order.buyerEmail,
    currency: order.currency,
    totals: { subtotal: order.subtotal, tax: order.taxAmount, fee: order.feeAmount, total: order.totalAmount },
    receiptUrl: receiptPath(order._id, access.token),
    downloads: downloadLinksFor(order),
  };
}

/** Loads a receipt only when the caller presents the order's access token. */
export async function getOrderReceipt(orderId, accessToken) {
  if (!mongoose.isValidObjectId(orderId) || typeof accessToken !== 'string') return null;
  await connectDB();

  const order = await Order.findById(orderId).select('+accessTokenHash').lean();
  if (!order || !accessTokenMatches(accessToken, order.accessTokenHash)) return null;

  const { accessTokenHash: _omit, ...rest } = order; // order.user (if any) tells the page who owns it
  return { order: toPlain(rest), downloads: order.status === 'completed' && order.paymentStatus === 'paid' ? downloadLinksFor(order) : [] };
}

/**
 * Atomically consumes one download for (order, product) if the order is valid and under the limit.
 * Returns the product (including its private downloadUrl) or an error code.
 */
export async function consumeDownload({ orderId, productId }) {
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(productId)) return { error: 'invalid' };
  await connectDB();

  const { matchedCount } = await Order.updateOne(
    {
      _id: orderId,
      status: 'completed',
      paymentStatus: 'paid',
      items: { $elemMatch: { product: productId, downloadCount: { $lt: MAX_DOWNLOADS_PER_ITEM } } },
    },
    { $inc: { 'items.$.downloadCount': 1 }, $set: { 'items.$.lastDownloadedAt': new Date() } },
  );
  if (matchedCount === 0) {
    const exists = await Order.exists({ _id: orderId, status: 'completed', paymentStatus: 'paid', 'items.product': productId });
    return { error: exists ? 'limit_reached' : 'invalid' };
  }

  // Explicitly selecting a select:false field includes it. Unpublished products stay downloadable for buyers.
  const product = await Product.findById(productId).select('title deliveryType downloadUrl').lean();
  return product ? { product } : { error: 'invalid' };
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

  return orders.flatMap((order) => {
    const links = new Map(downloadLinksFor(order).map((d) => [d.productId, d]));
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
        downloadsRemaining: link.downloadsRemaining,
        downloadUrl: link.url,
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
