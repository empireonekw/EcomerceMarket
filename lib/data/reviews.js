import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { publicName, toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { sendSystemMessage } from '@/lib/data/messages';
import { reportProblems, reportReasonLabel, REVIEW_EDIT_LIMIT, reviewProblems } from '@/lib/reviews';
import Review from '@/models/Review';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';

// Reviews come only from verified buyers: a paid, completed order LINKED to the reviewer's account
// (never an email match — emails aren't verified). Callers pass the signed-in user's id.
// Buyers can edit their review REVIEW_EDIT_LIMIT times; sellers can report a review to Sellpify, and admins resolve
// reports by keeping, editing or removing it (both sides hear about it in their "From Sellpify" messages).

export const PRODUCT_REVIEWS_PAGE = 5;
export const REVIEWS_PAGE = 20;
const PUBLIC = { hidden: { $ne: true } };
const isId = (v) => mongoose.isValidObjectId(v);

function clean(input) {
  const fields = reviewProblems(input);
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  return { rating: Number(input.rating), body: String(input.body).trim() };
}

/** The product's page, so it shows the change straight away. */
async function refreshProductPage(slug) {
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/'); // the homepage Reviews section
  if (slug) revalidatePath(`/products/${slug}`);
}

/** Publishes a review for a product the user bought. One review per buyer per product; never your own product. */
export async function createReview(userId, { productId, rating, body }) {
  const input = clean({ rating, body });
  if (!isId(productId)) throw new InputError('Product not found.', {}, 404);
  await connectDB();

  const [user, order, product] = await Promise.all([
    User.findById(userId).select('name role').lean(),
    Order.findOne({ user: userId, status: 'completed', paymentStatus: 'paid', 'items.product': productId })
      .select('items.product items.title items.slug paidAt createdAt')
      .sort({ createdAt: 1 })
      .lean(),
    Product.findById(productId).select('sellerId slug').lean(),
  ]);
  if (!user || user.role === 'admin') throw new InputError('Admin accounts can’t write reviews.', {}, 403);
  if (!order) throw new InputError('You can review products you’ve bought.', {}, 403);
  if (product?.sellerId && String(product.sellerId) === String(userId)) throw new InputError('You can’t review your own product.', {}, 403);

  const item = order.items.find((i) => String(i.product) === String(productId));
  try {
    const review = await Review.create({
      user: userId,
      product: productId,
      order: order._id,
      seller: product?.sellerId ?? null,
      ...input,
      authorName: publicName(user.name), // only first name + initial is ever stored or shown
      productTitle: item.title,
      productSlug: item.slug,
      purchasedAt: order.paidAt ?? order.createdAt,
    });
    await refreshProductPage(product?.slug ?? item.slug);
    return toPlain(review);
  } catch (err) {
    if (err?.code === 11000) throw new InputError('You’ve already reviewed this product. You can edit your review instead.', {}, 409);
    throw err;
  }
}

/**
 * The buyer changes their own review (to fix a mistake), at most REVIEW_EDIT_LIMIT times. The previous version is
 * kept for admins, and the review shows as "Edited". A review Sellpify removed can't be edited back.
 */
export async function updateOwnReview(userId, reviewId, { rating, body }) {
  if (!isId(reviewId)) throw new InputError('Review not found.', {}, 404);
  const input = clean({ rating, body });
  await connectDB();
  const review = await Review.findOne({ _id: reviewId, user: userId }).select('rating body editCount hidden productSlug').lean();
  if (!review) throw new InputError('Review not found.', {}, 404);
  if (review.hidden) throw new InputError('Sellpify removed this review, so it can’t be edited.', {}, 409);
  if ((review.editCount ?? 0) >= REVIEW_EDIT_LIMIT) throw new InputError(`You’ve used all ${REVIEW_EDIT_LIMIT} edits for this review.`, {}, 409);
  if (input.rating === review.rating && input.body === review.body) throw new InputError('Nothing changed.', {}, 400);

  const now = new Date();
  // Conditional on the count read above, so two quick saves can't both use the last edit.
  const updated = await Review.findOneAndUpdate(
    { _id: reviewId, user: userId, editCount: review.editCount ?? 0 },
    {
      $set: { rating: input.rating, body: input.body, editedAt: now },
      $inc: { editCount: 1 },
      $push: { history: { rating: review.rating, body: review.body, at: now, by: 'buyer' } },
    },
    { new: true },
  ).lean();
  if (!updated) throw new InputError('Your review changed in the meantime. Refresh and try again.', {}, 409);
  await refreshProductPage(review.productSlug);
  return shapeOwn(updated);
}

const shapeOwn = (r) =>
  toPlain({
    id: r._id,
    productId: r.product,
    rating: r.rating,
    body: r.body,
    editCount: r.editCount ?? 0,
    editsLeft: Math.max(0, REVIEW_EDIT_LIMIT - (r.editCount ?? 0)),
    editedAt: r.editedAt ?? null,
    createdAt: r.createdAt,
    hidden: Boolean(r.hidden),
    hiddenReason: r.hiddenReason ?? '',
  });

/** Product ids → rating the user already gave (for "Write a review" vs "Reviewed" in My Purchases). */
export async function getUserReviewMap(userId) {
  if (!isId(userId)) return {};
  await connectDB();
  const rows = await Review.find({ user: userId }).select('product rating').lean();
  return Object.fromEntries(rows.map((r) => [String(r.product), r.rating]));
}

/**
 * What the signed-in visitor can do on a product page: { canReview, ownProduct, review } — `review` = theirs (with
 * edits left) once written; `canReview` = bought it, hasn't reviewed it and it isn't their own product.
 */
export async function getViewerReviewState(userId, productId) {
  if (!isId(userId) || !isId(productId)) return { canReview: false, ownProduct: false, review: null };
  await connectDB();
  const [review, bought, product] = await Promise.all([
    Review.findOne({ user: userId, product: productId }).lean(),
    Order.exists({ user: userId, status: 'completed', paymentStatus: 'paid', 'items.product': productId }),
    Product.findById(productId).select('sellerId').lean(),
  ]);
  const ownProduct = Boolean(product?.sellerId && String(product.sellerId) === String(userId));
  return { canReview: Boolean(bought) && !review && !ownProduct, ownProduct, review: review ? shapeOwn(review) : null };
}

const publicReview = (r) =>
  toPlain({
    id: r._id,
    rating: r.rating,
    body: r.body,
    authorName: publicName(r.authorName),
    createdAt: r.createdAt,
    edited: Boolean(r.editedAt),
  });

/** Average, count and how many reviews gave each star (5 → 1) for a product. */
export async function getProductReviewSummary(productId) {
  if (!isId(productId)) return { count: 0, average: 0, stars: [0, 0, 0, 0, 0] };
  await connectDB();
  const rows = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), ...PUBLIC } },
    { $group: { _id: '$rating', n: { $sum: 1 } } },
  ]);
  const by = new Map(rows.map((r) => [r._id, r.n]));
  const count = rows.reduce((sum, r) => sum + r.n, 0);
  const average = count ? rows.reduce((sum, r) => sum + r._id * r.n, 0) / count : 0;
  return { count, average, stars: [5, 4, 3, 2, 1].map((s) => by.get(s) ?? 0) };
}

/** One page of a product's public reviews, newest first: { items, page, totalPages }. `rating` = only that star. */
export async function getProductReviews(productId, { page = 1, rating } = {}) {
  if (!isId(productId)) return { items: [], page: 1, totalPages: 1 };
  await connectDB();
  const filter = { product: productId, ...PUBLIC, ...(Number.isInteger(rating) && rating >= 1 && rating <= 5 && { rating }) };
  const current = Math.max(1, Math.floor(Number(page)) || 1);
  const [items, total] = await Promise.all([
    Review.find(filter).select('rating body authorName createdAt editedAt').sort({ createdAt: -1 }).skip((current - 1) * PRODUCT_REVIEWS_PAGE).limit(PRODUCT_REVIEWS_PAGE).lean(),
    Review.countDocuments(filter),
  ]);
  return { items: items.map(publicReview), page: current, totalPages: Math.max(1, Math.ceil(total / PRODUCT_REVIEWS_PAGE)) };
}

/** Shop name and blue tick of each seller id. */
async function shopsById(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select('name seller.storeName seller.verification.status').lean();
  return new Map(users.map((u) => [String(u._id), { name: u.seller?.storeName || u.name, verified: u.seller?.verification?.status === 'verified' }]));
}

/** Buyer profile → My reviews: every review the user wrote, with the product and the shop it went to. */
export async function getUserReviews(userId) {
  if (!isId(userId)) return [];
  await connectDB();
  const reviews = await Review.find({ user: userId }).sort({ createdAt: -1 }).limit(200).lean();
  const products = await Product.find({ _id: { $in: reviews.map((r) => r.product) } }).select('title slug coverImage sellerId').lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const shops = await shopsById(products.map((p) => p.sellerId));
  return reviews.map((r) => {
    const p = productById.get(String(r.product));
    return {
      ...shapeOwn(r),
      product: { title: p?.title ?? r.productTitle, slug: p?.slug ?? r.productSlug, coverImage: p?.coverImage ?? null, live: Boolean(p) },
      shop: p?.sellerId ? (shops.get(String(p.sellerId)) ?? null) : { name: 'Sellpify', verified: false }, // platform products
    };
  });
}

/** Seller → Reviews: reviews of the shop's products (every status), with averages and report state. */
export async function getSellerReviews(sellerId, { filter = 'all' } = {}) {
  if (!isId(sellerId)) return { items: [], summary: { count: 0, average: 0, reported: 0 } };
  await connectDB();
  const productIds = (await Product.find({ sellerId }).select('_id').lean()).map((p) => p._id);
  const base = { product: { $in: productIds } };
  const query = { ...base, ...(filter === 'reported' && { 'report.status': 'open' }), ...(filter === 'low' && { rating: { $lte: 2 } }) };
  const [items, stats, reported] = await Promise.all([
    Review.find(query).select('rating body authorName productTitle productSlug createdAt editedAt hidden report').sort({ createdAt: -1 }).limit(200).lean(),
    Review.aggregate([{ $match: { ...base, ...PUBLIC } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }]),
    Review.countDocuments({ ...base, 'report.status': 'open' }),
  ]);
  return toPlain({
    items: items.map((r) => ({
      ...publicReview(r),
      productTitle: r.productTitle,
      productSlug: r.productSlug,
      hidden: Boolean(r.hidden),
      report: r.report ? { status: r.report.status, reason: r.report.reason, reportedAt: r.report.reportedAt, note: r.report.note ?? '' } : null,
    })),
    summary: { count: stats[0]?.count ?? 0, average: stats[0]?.average ?? 0, reported },
  });
}

/** A seller reports a review of their product as fake or against the rules, with their own message to Sellpify. */
export async function reportReview(sellerId, reviewId, input) {
  if (!isId(reviewId)) throw new InputError('Review not found.', {}, 404);
  const fields = reportProblems(input ?? {});
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  await connectDB();
  const review = await Review.findById(reviewId).select('product report hidden').lean();
  const owns = review && (await Product.exists({ _id: review.product, sellerId }));
  if (!owns) throw new InputError('Review not found.', {}, 404);
  if (review.hidden) throw new InputError('This review has already been removed.', {}, 409);
  if (review.report?.status === 'open') throw new InputError('You’ve already reported this review. We’ll message you once we’ve looked at it.', {}, 409);
  await Review.updateOne(
    { _id: reviewId },
    { $set: { report: { status: 'open', reason: input.reason, message: String(input.message).trim(), reportedAt: new Date() } } },
  );
  return { status: 'open' };
}

// ---------------------------------------------------------------------------
// Admin → Reviews (callers authorize as admin first)
// ---------------------------------------------------------------------------

/** Reported reviews first (oldest report first), or every review: { items, counts }. */
export async function getAdminReviews({ view = 'reported', q = '' } = {}) {
  await connectDB();
  const filter =
    view === 'reported'
      ? { 'report.status': 'open' }
      : view === 'resolved'
        ? { 'report.status': { $in: ['kept', 'edited', 'removed'] } }
        : view === 'removed'
          ? { hidden: true }
          : {};
  const text = String(q).trim().slice(0, 80);
  if (text) {
    const rx = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ productTitle: rx }, { body: rx }, { authorName: rx }];
  }
  const sort = view === 'reported' ? { 'report.reportedAt': 1 } : { createdAt: -1 };
  const [rows, open, resolved, removed, all] = await Promise.all([
    Review.find(filter).select('+history').sort(sort).limit(100).populate('user', 'name email').lean(),
    Review.countDocuments({ 'report.status': 'open' }),
    Review.countDocuments({ 'report.status': { $in: ['kept', 'edited', 'removed'] } }),
    Review.countDocuments({ hidden: true }),
    Review.estimatedDocumentCount(),
  ]);
  const products = await Product.find({ _id: { $in: rows.map((r) => r.product) } }).select('slug sellerId').lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));
  const shops = await shopsById(products.map((p) => p.sellerId));
  return toPlain({
    items: rows.map((r) => {
      const p = productById.get(String(r.product));
      return {
        id: r._id,
        rating: r.rating,
        body: r.body,
        authorName: r.authorName,
        buyer: r.user ? { id: r.user._id, name: r.user.name, email: r.user.email } : null,
        productTitle: r.productTitle,
        productSlug: p?.slug ?? r.productSlug,
        shop: p?.sellerId ? { id: p.sellerId, ...(shops.get(String(p.sellerId)) ?? { name: 'Former seller', verified: false }) } : null,
        createdAt: r.createdAt,
        editCount: r.editCount ?? 0,
        editedAt: r.editedAt ?? null,
        history: r.history ?? [],
        hidden: Boolean(r.hidden),
        hiddenReason: r.hiddenReason ?? '',
        report: r.report ?? null,
      };
    }),
    counts: { reported: open, resolved, removed, all },
  });
}

/**
 * Resolves a review (and its report, if any):
 *   keep    → the review stays as it is
 *   edit    → { rating, body } replaces it (kept in history as an admin edit; doesn't use the buyer's edits)
 *   remove  → hidden everywhere public, with `reason` (the buyer sees it)
 *   restore → a removed review shows again
 * `note` goes to the seller who reported it. Both the seller and the buyer get a "From Sellpify" message.
 */
export async function moderateReview(reviewId, { action, rating, body, reason, note }) {
  if (!isId(reviewId)) throw new InputError('Review not found.', {}, 404);
  if (!['keep', 'edit', 'remove', 'restore'].includes(action)) throw new InputError('Choose what to do with this review.');
  await connectDB();
  const review = await Review.findById(reviewId).select('user product rating body productTitle productSlug report hidden').lean();
  if (!review) throw new InputError('Review not found.', {}, 404);
  const sellerId = (await Product.findById(review.product).select('sellerId').lean())?.sellerId ?? null;

  const now = new Date();
  const message = String(note ?? '').trim().slice(0, 500);
  const set = {};
  const update = {};
  if (action === 'edit') {
    const input = clean({ rating, body });
    Object.assign(set, { rating: input.rating, body: input.body, editedAt: now });
    update.$push = { history: { rating: review.rating, body: review.body, at: now, by: 'admin' } };
  }
  if (action === 'remove') {
    const why = String(reason ?? '').trim();
    if (why.length < 5) throw new InputError('Please fix the highlighted fields.', { reason: 'Say why it’s removed (the buyer sees this).' });
    Object.assign(set, { hidden: true, hiddenReason: why.slice(0, 300) });
  }
  if (action === 'restore') {
    set.hidden = false;
    update.$unset = { hiddenReason: 1 };
  }
  const openReport = review.report?.status === 'open';
  if (openReport) {
    Object.assign(set, {
      'report.status': { keep: 'kept', edit: 'edited', remove: 'removed', restore: 'kept' }[action],
      'report.resolvedAt': now,
      ...(message && { 'report.note': message }),
    });
  }
  if (!Object.keys(set).length) throw new InputError('Nothing to change: this review has no open report.', {}, 409);
  await Review.updateOne({ _id: reviewId }, { ...update, $set: set });
  await refreshProductPage(review.productSlug);

  // Tell both sides what happened.
  const title = `“${review.productTitle}”`;
  if (openReport && sellerId) {
    const outcome = {
      keep: `We looked at the review of ${title} you reported (${reportReasonLabel(review.report.reason).toLowerCase()}) and it stays up: it doesn’t break our review rules.`,
      edit: `We looked at the review of ${title} you reported and corrected it.`,
      remove: `We looked at the review of ${title} you reported and removed it.`,
      restore: `We looked at the review of ${title} you reported and it stays up.`,
    }[action];
    await sendSystemMessage(sellerId, `${outcome}${message ? ` ${message}` : ''}`);
  }
  if (action === 'edit') await sendSystemMessage(review.user, `We corrected your review of ${title} so it follows our review rules. You can see it under Profile → My reviews.`);
  if (action === 'remove') await sendSystemMessage(review.user, `We removed your review of ${title}: ${set.hiddenReason}`);
  return { action };
}

/** Newest reviews for the homepage plus the overall average (components/home/Reviews.jsx). */
export async function getFeaturedReviews(limit = 6) {
  await connectDB();
  const [items, stats] = await Promise.all([
    Review.find(PUBLIC).select('rating body authorName productTitle productSlug purchasedAt createdAt').sort({ createdAt: -1 }).limit(limit).lean(),
    Review.aggregate([{ $match: PUBLIC }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }]),
  ]);
  // Older reviews stored the full name: shorten it before it leaves the server.
  const safe = items.map((r) => ({ ...r, authorName: publicName(r.authorName) }));
  return toPlain({ items: safe, count: stats[0]?.count ?? 0, average: stats[0]?.average ?? 0 });
}
