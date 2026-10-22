import 'server-only';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { formatPrice } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { deleteUserAccount } from '@/lib/data/admin-users';
import Review from '@/models/Review';
import User from '@/models/User';

// Re-auth throttle for self-deletion: only WRONG passwords count (5 per 15 minutes).
export const DELETE_ACCOUNT_LIMIT = { limit: 5, windowMs: 15 * 60 * 1000 };

/**
 * A customer or seller permanently deletes their OWN account after re-entering their password.
 * Same clean-up as an admin delete (deleteUserAccount): orders stay for the records but are unlinked,
 * a seller's never-sold products are deleted and sold ones unpublished so buyers keep their downloads.
 * Their reviews are removed too, since they show the person's name. Returns { reviewsDeleted, ... }.
 * Admin accounts can't delete themselves; sellers must be paid out first.
 */
export async function deleteOwnAccount(userId, password) {
  if (typeof password !== 'string' || !password) {
    throw new InputError('Enter your password to confirm.', { password: 'Enter your password to confirm.' });
  }
  await connectDB();
  const user = await User.findById(userId).select('+password role seller.pendingPayout').lean();
  if (!user) throw new InputError('Account not found.', {}, 404);
  if (!(await bcrypt.compare(password, user.password))) {
    throw new InputError('That password isn’t right.', { password: 'That password isn’t right.' }, 403);
  }
  if (user.role === 'admin') throw new InputError('Admin accounts can’t be deleted from here.', {}, 403);

  const owed = user.seller?.pendingPayout ?? 0;
  if (owed > 0) {
    throw new InputError(
      `You still have ${formatPrice(owed, 'USD')} waiting to be paid out. Request a payout from Payouts & Bank Details, then delete your account once it’s paid.`,
      {},
      409,
    );
  }

  const result = await deleteUserAccount(userId, { actingAdminId: null });
  const { deletedCount } = await Review.deleteMany({ user: userId });
  return { ...result, reviewsDeleted: deletedCount };
}
