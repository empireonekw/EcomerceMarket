import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A review a seller got outside Sellpify (their other shop), copied in by an admin after checking it (lib/imported.js). Shown on the
 * seller's card as "from the seller's other shop", never as a Sellpify purchase review.
 */
const importedReviewSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    authorName: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    reviewedAt: { type: Date, required: true }, // when it was written
    note: { type: String, required: true, trim: true, maxlength: 300 }, // how the admin checked it (admins only)
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.models.ImportedReview || mongoose.model('ImportedReview', importedReviewSchema);
