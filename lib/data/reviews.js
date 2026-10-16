import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { REVIEW_LIMITS } from '@/lib/validation';
import Review from '@/models/Review';
import Order from '@/models/Order';
import User from '@/models/User';

// Reviews come only from verified buyers: a paid, completed order LINKED to the reviewer's account
// (never an email match — emails aren't verified). Callers pass the signed-in user's id.

function validate({ rating, body }) {
  const fields = {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) fields.rating = 'Choose a rating from 1 to 5 stars.';
  const text = String(body ?? '').trim();
  if (text.length < REVIEW_LIMITS.min) fields.body = `Write at least ${REVIEW_LIMITS.min} characters.`;
  else if (text.length > REVIEW_LIMITS.max) fields.body = `Keep it under ${REVIEW_LIMITS.max} characters.`;
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  return { rating: r, body: text };
}

/** Publishes a review for a product the user bought. One review per buyer per product. */
export async function createReview(userId, { productId, rating, body }) {
  const input = validate({ rating, body });
  if (!mongoose.isValidObjectId(productId)) throw new InputError('Product not found.', {}, 404);
  await connectDB();

  const [user, order] = await Promise.all([
    User.findById(userId).select('name role').lean(),
    Order.findOne({ user: userId, status: 'completed', paymentStatus: 'paid', 'items.product': productId })
      .select('items.product items.title items.slug paidAt createdAt')
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  if (!user || user.role !== 'customer') throw new InputError('Only customer accounts can write reviews.', {}, 403);
  if (!order) throw new InputError('You can review products you’ve bought.', {}, 403);

  const item = order.items.find((i) => String(i.product) === String(productId));
  try {
    const review = await Review.create({
      user: userId,
      product: productId,
      order: order._id,
      ...input,
      authorName: user.name,
      productTitle: item.title,
      productSlug: item.slug,
      purchasedAt: order.paidAt ?? order.createdAt,
    });
    return toPlain(review);
  } catch (err) {
    if (err?.code === 11000) throw new InputError('You’ve already reviewed this product.', {}, 409);
    throw err;
  }
}

/** Product ids → rating the user already gave (for "Write a review" vs "Reviewed" in My Purchases). */
export async function getUserReviewMap(userId) {
  if (!mongoose.isValidObjectId(userId)) return {};
  await connectDB();
  const rows = await Review.find({ user: userId }).select('product rating').lean();
  return Object.fromEntries(rows.map((r) => [String(r.product), r.rating]));
}

/** Newest reviews for the homepage plus the overall average (components/home/Reviews.jsx). */
export async function getFeaturedReviews(limit = 6) {
  await connectDB();
  const [items, stats] = await Promise.all([
    Review.find().select('rating body authorName productTitle productSlug purchasedAt createdAt').sort({ createdAt: -1 }).limit(limit).lean(),
    Review.aggregate([{ $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } }]),
  ]);
  return toPlain({ items, count: stats[0]?.count ?? 0, average: stats[0]?.average ?? 0 });
}
