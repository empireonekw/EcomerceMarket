import mongoose from 'mongoose';

const { Schema } = mongoose;

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
export const ORDER_STATUSES = ['pending', 'completed', 'cancelled']; // fulfillment state
export const MAX_DOWNLOADS_PER_ITEM = 10;

// Snapshot of the product at purchase time, so later price/title edits never alter past orders.
const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    seller: { type: Schema.Types.ObjectId, ref: 'User' }, // absent for platform-owned products
    title: { type: String, required: true },
    slug: { type: String, required: true },
    coverImage: { type: String },
    price: { type: Number, required: true, min: 0 }, // cents
    quantity: { type: Number, default: 1, min: 1 },
    downloadCount: { type: Number, default: 0, min: 0 },
    lastDownloadedAt: { type: Date },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    buyerEmail: {
      type: String,
      required: [true, 'Buyer email is required'],
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    user: { type: Schema.Types.ObjectId, ref: 'User' }, // optional: guest checkout supported
    items: {
      type: [orderItemSchema],
      validate: { validator: (v) => Array.isArray(v) && v.length > 0, message: 'Order must contain at least one item' },
    },

    // Amounts in cents. subtotal + totalAmount are derived in pre('validate'); tax/fee are set by the service.
    subtotal: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    feeAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },

    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    paymentProvider: { type: String, trim: true }, // "stripe", "free", "demo"…
    paymentReference: { type: String, trim: true }, // provider session/intent ID — webhook idempotency
    paidAt: { type: Date },

    // SHA-256 of the receipt access token (the raw token only ever lives in the buyer's receipt URL).
    accessTokenHash: { type: String, select: false },
  },
  { timestamps: true, versionKey: false },
);

// Totals are always derived server-side from line items; never trust a client-sent total.
orderSchema.pre('validate', function computeTotals() {
  if (Array.isArray(this.items)) {
    this.subtotal = this.items.reduce((sum, i) => sum + i.price * (i.quantity ?? 1), 0);
    this.totalAmount = this.subtotal + (this.taxAmount ?? 0) + (this.feeAmount ?? 0);
  }
});

// ---------- Indexes ----------
orderSchema.index({ buyerEmail: 1, createdAt: -1 }); // "My purchases" / download access lookup
orderSchema.index({ user: 1, createdAt: -1 }, { sparse: true });
orderSchema.index({ paymentStatus: 1, createdAt: -1 }); // admin dashboards
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'items.product': 1, paymentStatus: 1 }); // "has this buyer paid for product X?"
orderSchema.index({ paymentReference: 1 }, { unique: true, sparse: true }); // webhook idempotency

export default mongoose.models.Order || mongoose.model('Order', orderSchema);
