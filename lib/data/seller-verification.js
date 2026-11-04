import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { toPlain } from '@/lib/utils';
import { IDENTITY_SCHEMA, fieldErrors } from '@/lib/seller-onboarding';
import { InputError } from '@/lib/data/product-writes';
import { sendSystemMessage } from '@/lib/data/messages';
import { inspectUploadedSource, openUploadedSource } from '@/lib/uploads';
import User from '@/models/User';

// Seller identity check: asked for after a seller's FIRST SALE (not when the shop opens). The seller sends both sides
// of their ID card and a live camera selfie (/seller/verify); an admin verifies or rejects it (Admin → Users →
// Verification). Payouts wait until it's verified. Callers authorize first.

export const VERIFY_PATH = '/seller/verify';
const isId = (v) => mongoose.isValidObjectId(v);

/**
 * After an order's sale is booked (lib/data/orders.js): sellers in it who haven't been asked yet and have no ID on
 * file are asked to verify, once, with a "From Sellpify" message. Never throws: an order must never fail over this.
 */
export async function askForIdentityAfterFirstSale(order) {
  const sellers = [...new Set((order?.items ?? []).map((i) => i.seller && String(i.seller)).filter(Boolean))];
  for (const sellerId of sellers) {
    try {
      const { modifiedCount } = await User.updateOne(
        { _id: sellerId, role: 'seller', 'seller.verificationRequestedAt': { $exists: false }, 'seller.verification.status': { $nin: ['pending', 'verified'] } },
        { $set: { 'seller.verificationRequestedAt': new Date() } },
      );
      if (modifiedCount) {
        await sendSystemMessage(
          sellerId,
          `Congratulations on your first sale! 🎉 Before we can pay you, please verify your identity: a photo of both sides of your ID card (CNIC) and a quick selfie with your camera. It takes about two minutes: ${VERIFY_PATH}`,
        );
      }
    } catch (err) {
      console.error('[verification] could not ask seller', sellerId, err);
    }
  }
}

/** { status: null | 'pending' | 'verified' | 'rejected', note, requested } for the seller's own pages. */
export async function getVerificationState(userId) {
  if (!isId(userId)) return { status: null, note: '', requested: false };
  await connectDB();
  const u = await User.findById(userId).select('seller.verificationRequestedAt seller.verification.status seller.verification.note seller.verification.submittedAt').lean();
  const v = u?.seller?.verification;
  return toPlain({ status: v?.status ?? null, note: v?.note ?? '', submittedAt: v?.submittedAt ?? null, requested: Boolean(u?.seller?.verificationRequestedAt) });
}

/** The seller sends their ID card (front, back) and live selfie. Allowed when there's none yet or it was rejected. */
export async function submitVerification(userId, input) {
  const result = IDENTITY_SCHEMA.safeParse(input ?? {});
  if (!result.success) throw new InputError('Please fix the highlighted fields.', fieldErrors(result.error));
  const { idFront, idBack, selfie } = result.data;
  for (const [field, location] of Object.entries({ idFront, idBack, selfie })) {
    try {
      await inspectUploadedSource(location, field); // exists, and really is an image / PDF
    } catch (err) {
      if (err instanceof InputError) throw new InputError('Please fix the highlighted fields.', { [field]: 'That file can’t be read. Please add it again.' });
      throw err;
    }
  }
  await connectDB();
  const { matchedCount } = await User.updateOne(
    { _id: userId, role: 'seller', 'seller.verification.status': { $nin: ['pending', 'verified'] } },
    { $set: { 'seller.verification': { idFront, idBack, selfie, status: 'pending', submittedAt: new Date() } } },
  );
  if (!matchedCount) throw new InputError('Your identity is already being checked or is verified.', {}, 409);
  return { status: 'pending' };
}

const SIDES = { front: 'idFront', back: 'idBack', selfie: 'selfie' };

/** One verification file ('front' | 'back' | 'selfie') as a stream, for an admin (`ownerId` = whose). Null when none. */
export async function openIdDocument(ownerId, side) {
  if (!isId(ownerId) || !SIDES[side]) return null;
  await connectDB();
  const user = await User.findById(ownerId).select('+seller.verification').lean();
  const location = user?.seller?.verification?.[SIDES[side]];
  return location ? openUploadedSource(location) : null;
}
