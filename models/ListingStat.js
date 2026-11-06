import mongoose from 'mongoose';

const { Schema } = mongoose;

// Where a visit came from (lib/listing-stats.js referrerSource).
export const VISIT_SOURCES = ['direct', 'sellpify', 'search_engine', 'facebook', 'instagram', 'pinterest', 'twitter', 'tumblr', 'other'];

/**
 * One listing's numbers for one day (in the marketplace timezone): visits, add-to-carts and where visits came from.
 * Written with $inc by POST /api/stats/track; read by the seller's Listing stats page. Sales come from Transaction.
 */
const listingStatSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User' },
    day: { type: String, required: true }, // "2026-11-06"
    visits: { type: Number, default: 0 },
    carts: { type: Number, default: 0 },
    sources: Object.fromEntries(VISIT_SOURCES.map((s) => [s, { type: Number, default: 0 }])),
  },
  { versionKey: false },
);
listingStatSchema.index({ product: 1, day: 1 }, { unique: true });

/** Search words on Sellpify that led to a visit: one row per listing, day and term. */
const searchTermSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    day: { type: String, required: true },
    term: { type: String, required: true, maxlength: 80 },
    count: { type: Number, default: 0 },
  },
  { versionKey: false },
);
searchTermSchema.index({ product: 1, day: 1, term: 1 }, { unique: true });

export const ListingSearchTerm = mongoose.models.ListingSearchTerm || mongoose.model('ListingSearchTerm', searchTermSchema);
export default mongoose.models.ListingStat || mongoose.model('ListingStat', listingStatSchema);
