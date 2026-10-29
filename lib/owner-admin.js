import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';

/**
 * The marketplace owner's admin login. It can't be deleted or locked out:
 *  - no screen or API can delete an admin (lib/data/admin-users.js), and this one is refused by email too;
 *  - signing in with ADMIN_PASSWORD (from .env.local — never committed) re-creates the account if it's gone, makes it
 *    an admin again if it was changed, and resets its database password to ADMIN_PASSWORD.
 * The email is fixed here; the password only ever lives in the environment (local .env.local and the server's).
 */
export const OWNER_ADMIN_EMAIL = 'letsrank69@gmail.com';

export const isOwnerAdminEmail = (email) => String(email ?? '').trim().toLowerCase() === OWNER_ADMIN_EMAIL;

const digest = (value) => createHash('sha256').update(String(value)).digest();

/** Owner sign-in: the account (created or repaired as needed) when `password` is ADMIN_PASSWORD, otherwise null. */
export async function ensureOwnerAdmin(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12 || !timingSafeEqual(digest(password), digest(expected))) return null;

  await connectDB();
  let user = await User.findOne({ email: OWNER_ADMIN_EMAIL }).select('+password name email role createdAt tokenVersion seller.storeName');
  if (!user) user = new User({ name: 'Sellpify Admin', email: OWNER_ADMIN_EMAIL, termsAcceptedAt: new Date() });
  if (user.role !== 'admin') user.role = 'admin';
  if (!user.password || !(await bcrypt.compare(password, user.password))) user.password = password; // hashed on save
  if (user.isNew || user.isModified()) await user.save();
  return user;
}
