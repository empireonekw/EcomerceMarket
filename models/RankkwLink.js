import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A seller's Sellpify shop connected to their Rankkw account (lib/rankkw-link.js), so Rankkw can add their Etsy
 * listings here. One per seller; connecting again replaces the token. Only the token's hash is stored.
 */
const rankkwLinkSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    rankkwUser: { type: String, trim: true, maxlength: 64 }, // Rankkw's user id, for support
    lastUsedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

rankkwLinkSchema.index({ seller: 1 }, { unique: true });
rankkwLinkSchema.index({ tokenHash: 1 }, { unique: true });

export default mongoose.models.RankkwLink || mongoose.model('RankkwLink', rankkwLinkSchema);
