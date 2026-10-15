import mongoose from 'mongoose';

const { Schema } = mongoose;

export const TRANSACTION_TYPES = ['sale', 'payout'];

/**
 * Append-only money ledger (integer cents). The source of truth for marketplace finances;
 * seller balance counters on User are derived from it and updated in the same DB transaction.
 *
 *  - 'sale'   one entry per order line: gross = commission + sellerEarning.
 *             Platform-owned products have no seller: commission = gross, sellerEarning = 0.
 *  - 'payout' money sent to a seller: sellerEarning is the (negative) amount debited from their balance.
 */
const transactionSchema = new Schema(
  {
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User' },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    payout: { type: Schema.Types.ObjectId, ref: 'Payout' },

    gross: { type: Number, required: true }, // amount the buyer paid for this line (0 for payouts)
    commission: { type: Number, required: true }, // platform share
    sellerEarning: { type: Number, required: true }, // seller share (+ for sales, − for payouts)
    commissionRate: { type: Number }, // rate applied at the time — history stays accurate if it changes
    currency: { type: String, default: 'USD', uppercase: true },
    paymentProvider: { type: String }, // 'demo' sales can be told apart from real money
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

transactionSchema.index({ seller: 1, type: 1, createdAt: -1 }); // seller dashboard: sales + payouts
transactionSchema.index({ type: 1, createdAt: -1 }); // admin overview
transactionSchema.index({ order: 1 }, { sparse: true });

export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
