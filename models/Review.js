import mongoose from 'mongoose';
import { REVIEW_LIMITS } from '../lib/validation.js';
import { REPORT_LIMITS, REPORT_REASONS, REVIEW_EDIT_LIMIT } from '../lib/reviews.js';

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
    // The shop that sold the product (null for platform products): its Reviews page and reports.
    seller: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // Buyer edits, to fix mistakes: at most REVIEW_EDIT_LIMIT. Each change keeps the previous version in `history`
    // (with who made it: the buyer, or an admin moderating a report). Shown publicly as "Edited".
    editCount: { type: Number, default: 0, min: 0, max: REVIEW_EDIT_LIMIT },
    editedAt: { type: Date },
    history: {
      type: [new Schema({ rating: Number, body: String, at: Date, by: { type: String, enum: ['buyer', 'admin'] } }, { _id: false })],
      default: undefined,
      select: false,
    },

    // Removed by an admin (after a report): hidden everywhere public; the buyer sees why in their reviews.
    hidden: { type: Boolean, default: false },
    hiddenReason: { type: String, trim: true, maxlength: 300 },

    // A seller's report that the review is fake or breaks the rules, and how Sellpify resolved it.
    report: {
      type: new Schema(
        {
          status: { type: String, enum: ['open', 'kept', 'edited', 'removed'], default: 'open' },
          reason: { type: String, enum: REPORT_REASONS.map((r) => r.value), required: true },
          message: { type: String, trim: true, maxlength: REPORT_LIMITS.max, required: true },
          reportedAt: { type: Date, default: Date.now },
          resolvedAt: { type: Date },
          note: { type: String, trim: true, maxlength: 500 }, // what Sellpify told the seller
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true, versionKey: false },
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // one review per buyer per product
reviewSchema.index({ createdAt: -1 }); // homepage: newest first
reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ seller: 1, createdAt: -1 }); // a shop's Reviews page
reviewSchema.index({ 'report.status': 1, 'report.reportedAt': -1 }); // admin: reported reviews

export default mongoose.models.Review || mongoose.model('Review', reviewSchema);
