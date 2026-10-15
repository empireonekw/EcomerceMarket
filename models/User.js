import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { WALLET_OPTIONS } from '../lib/validation.js';

const { Schema } = mongoose;

export const USER_ROLES = ['customer', 'seller', 'admin'];

// Where a seller wants manual payouts sent. Private: never selected unless explicitly requested.
const bankDetailsSchema = new Schema(
  {
    bankName: { type: String, trim: true, maxlength: 80 },
    accountTitle: { type: String, trim: true, maxlength: 80 },
    accountNumber: { type: String, trim: true, uppercase: true, maxlength: 34 }, // IBAN or local account number
    walletProvider: { type: String, enum: WALLET_OPTIONS.map((w) => w.value) },
    walletNumber: { type: String, trim: true, maxlength: 15 },
  },
  { _id: false },
);

// Seller balances in integer cents. Updated atomically with $inc alongside a Transaction ledger entry.
const sellerSchema = new Schema(
  {
    storeName: { type: String, trim: true, maxlength: 60 }, // set during shop setup; absent = setup not finished
    storeDescription: { type: String, trim: true, maxlength: 500 },
    bankDetails: { type: bankDetailsSchema, select: false }, // bank account and/or EasyPaisa / JazzCash wallet
    totalEarnings: { type: Number, default: 0, min: 0 }, // lifetime 90% share
    pendingPayout: { type: Number, default: 0, min: 0 }, // earned, not yet paid out
    paidPayout: { type: Number, default: 0, min: 0 }, // paid out so far
    joinedAt: { type: Date },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // creates a unique index
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned unless explicitly requested with .select('+password')
    },
    termsAcceptedAt: { type: Date }, // set when the user accepts the Terms at signup
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'customer',
    },
    // Embedded in every session JWT. Incrementing it (password change, "sign out everywhere")
    // instantly invalidates all previously issued sessions.
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    seller: { type: sellerSchema }, // present for seller accounts (created at seller sign-up)
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        delete ret.password;
        delete ret.tokenVersion;
        return ret;
      },
    },
  },
);

/**
 * Projection for seller data INCLUDING the private bank details. Listing nested paths explicitly
 * (rather than 'seller +seller.bankDetails') avoids MongoDB parent/child projection collisions.
 */
export const SELLER_WITH_BANK =
  'role seller.storeName seller.storeDescription seller.totalEarnings seller.pendingPayout seller.paidPayout seller.joinedAt seller.bankDetails';

// Admin dashboards list users by role, newest first.
userSchema.index({ role: 1, createdAt: -1 });
// Payout clearing queue: sellers with an outstanding balance, largest first.
userSchema.index({ role: 1, 'seller.pendingPayout': -1 });
// Store names are unique (case-insensitive) among sellers.
userSchema.index(
  { 'seller.storeName': 1 },
  { unique: true, partialFilterExpression: { 'seller.storeName': { $type: 'string' } }, collation: { locale: 'en', strength: 2 } },
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

export default mongoose.models.User || mongoose.model('User', userSchema);
