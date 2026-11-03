import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MESSAGE_LIMITS, WALLET_OPTIONS } from '../lib/validation.js';

const { Schema } = mongoose;

export const USER_ROLES = ['customer', 'seller', 'admin'];

// Where a seller wants manual payouts sent. Private: never selected unless explicitly requested.
const bankDetailsSchema = new Schema(
  {
    bankName: { type: String, trim: true, maxlength: 80 },
    accountTitle: { type: String, trim: true, maxlength: 80 },
    accountNumber: { type: String, trim: true, uppercase: true, maxlength: 34 }, // IBAN or local account number
    walletProvider: { type: String, enum: WALLET_OPTIONS.map((w) => w.value) },
    walletNumber: { type: String, trim: true, maxlength: 254 }, // mobile number, or the email for Payoneer / PayPal
  },
  { _id: false },
);

// Set when the seller opens their shop (/sell-on-sellpify, lib/data/seller-onboarding.js). Private: never selected
// unless explicitly requested, and only shown to the seller and admins.
const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120 },
    city: { type: String, trim: true, maxlength: 60 },
    state: { type: String, trim: true, maxlength: 60 },
    postalCode: { type: String, trim: true, maxlength: 10 },
    country: { type: String, trim: true, maxlength: 2 }, // ISO code, from the shop preferences
  },
  { _id: false },
);
const phoneSchema = new Schema({ dial: { type: String, maxlength: 5 }, number: { type: String, maxlength: 14 } }, { _id: false });
// Government ID (front and back) the seller uploaded: private files (uploads/private/…) only admins can open.
export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'];
const verificationSchema = new Schema(
  {
    idFront: { type: String },
    idBack: { type: String },
    status: { type: String, enum: VERIFICATION_STATUSES, default: 'pending' },
    submittedAt: { type: Date },
    reviewedAt: { type: Date },
    note: { type: String, trim: true, maxlength: 300 }, // why it was rejected (shown to the seller)
  },
  { _id: false },
);

// Seller balances in integer cents. Updated atomically with $inc alongside a Transaction ledger entry.
const sellerSchema = new Schema(
  {
    storeName: { type: String, trim: true, maxlength: 60 }, // set during shop setup; absent = setup not finished
    storeDescription: { type: String, trim: true, maxlength: 500 },
    logo: { type: String, trim: true }, // shop profile picture (public media)
    banner: { type: String, trim: true }, // shop cover banner (public media)
    country: { type: String, trim: true, maxlength: 2 }, // shop preferences
    currency: { type: String, trim: true, maxlength: 3 },
    address: { type: addressSchema, select: false },
    phone: { type: phoneSchema, select: false },
    verification: { type: verificationSchema, select: false },
    bankDetails: { type: bankDetailsSchema, select: false }, // bank account and/or EasyPaisa / JazzCash wallet (legacy, plain)
    // The same details encrypted (AES-256-GCM, lib/field-encryption.js). Replaces bankDetails once DATA_ENCRYPTION_KEY is set.
    bankDetailsEnc: { type: String, select: false },
    totalEarnings: { type: Number, default: 0, min: 0 }, // lifetime 90% share
    pendingPayout: { type: Number, default: 0, min: 0 }, // earned, not yet paid out
    paidPayout: { type: Number, default: 0, min: 0 }, // paid out so far
    joinedAt: { type: Date }, // seller account created
    storeSetupAt: { type: Date }, // shop named (/seller/onboarding)
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
    phone: { type: String, trim: true, maxlength: 20 }, // E.164 ("+923001234567"), required at email sign-up (Google sign-ups may not have one); never public
    googleId: { type: String, select: false }, // "Continue with Google" account id (app/api/auth/google/callback)
    // The shop-opening wizard's saved steps until it's submitted (lib/data/seller-onboarding.js), so a seller can
    // leave and pick up where they stopped. Payout details in it are encrypted like bankDetailsEnc. Private.
    sellerOnboarding: { type: Schema.Types.Mixed, select: false },
    sellerTermsAcceptedAt: { type: Date }, // agreed to the Seller Agreement when opening the shop
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'customer',
    },
    // Embedded in every session JWT. Incrementing it (password change, "sign out everywhere")
    // instantly invalidates all previously issued sessions.
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
    // Blocked by an admin (Admin → Users): can't sign in, existing sessions end. Data is kept; unblocking restores it.
    blockedAt: { type: Date },
    // Listings that were live when the seller was blocked, so unblocking can put exactly those back in the store.
    blockedListings: { type: [Schema.Types.ObjectId], select: false, default: undefined },
    seller: { type: sellerSchema }, // present for seller accounts (created at seller sign-up)
    // Inbox preferences (lib/data/messages.js): the user's own labels and an optional away message.
    messaging: {
      labels: { type: [String], default: undefined },
      autoReply: {
        enabled: { type: Boolean, default: false },
        message: { type: String, trim: true, maxlength: MESSAGE_LIMITS.autoReply },
      },
    },
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
  'role seller.storeName seller.storeDescription seller.totalEarnings seller.pendingPayout seller.paidPayout seller.joinedAt seller.storeSetupAt seller.bankDetails seller.bankDetailsEnc';

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
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
