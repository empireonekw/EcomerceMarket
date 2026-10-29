import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PAYOUT_STATUSES = ['requested', 'paid'];

/**
 * A manual payout to a seller. Created as 'requested' by the seller (optional) or directly as 'paid'
 * when an admin clears a balance. The destination is snapshotted so the record stays accurate even
 * if the seller later edits their bank details.
 */
const payoutSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 }, // cents
    currency: { type: String, default: 'USD', uppercase: true },
    status: { type: String, enum: PAYOUT_STATUSES, default: 'requested' },
    destination: {
      bankName: String,
      accountTitle: String,
      accountNumber: String,
      walletProvider: String,
      walletNumber: String,
    },
    destinationEnc: { type: String }, // the destination encrypted (lib/field-encryption.js); replaces `destination`
    reference: { type: String, trim: true, maxlength: 120 }, // bank/wallet transaction ID entered by the admin
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

payoutSchema.index({ seller: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });
// At most one open request per seller.
payoutSchema.index({ seller: 1 }, { unique: true, partialFilterExpression: { status: 'requested' }, name: 'one_open_request_per_seller' });

export default mongoose.models.Payout || mongoose.model('Payout', payoutSchema);
