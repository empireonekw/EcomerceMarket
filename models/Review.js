import mongoose from 'mongoose';
import { REVIEW_LIMITS } from '../lib/validation.js';

const { Schema } = mongoose;

/**
 * A product review by a verified buyer (a paid, completed order linked to their account — see
 * lib/data/reviews.js). Name and product title are snapshotted so the homepage needs no joins and old
 * reviews keep reading correctly if a product is renamed.
 */
const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true }, // the purchase that verifies it
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, required: true, trim: true, minlength: REVIEW_LIMITS.min, maxlength: REVIEW_LIMITS.max },
    authorName: { type: String, required: true, trim: true, maxlength: 80 },
    productTitle: { type: String, required: true, trim: true },
    productSlug: { type: String, required: true, trim: true },
    purchasedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // one review per buyer per product
reviewSchema.index({ createdAt: -1 }); // homepage: newest first
reviewSchema.index({ product: 1, createdAt: -1 });

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);
