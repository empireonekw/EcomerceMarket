import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import User, { SELLER_WITH_BANK } from '@/models/User';
import { payoutDestinationFields, readBankDetails, readPayoutDestination } from '@/lib/field-encryption';
import Transaction from '@/models/Transaction';
import Payout from '@/models/Payout';

/** Admin payouts page: platform totals, the clearing queue, and recent payouts. */
export async function getPayoutOverview() {
  await requireAdmin();
  await connectDB();

  const [salesAgg, balancesAgg, sellers, openRequests, recentPayouts] = await Promise.all([
    Transaction.aggregate([
      { $match: { type: 'sale' } },
      {
        $group: {
          _id: null,
          gross: { $sum: '$gross' },
          // Commission = the platform's cut of SELLER sales; platform-owned products are reported separately.
          commission: { $sum: { $cond: [{ $ifNull: ['$seller', false] }, '$commission', 0] } },
          platformOwned: { $sum: { $cond: [{ $ifNull: ['$seller', false] }, 0, '$gross'] } },
          demoGross: { $sum: { $cond: [{ $eq: ['$paymentProvider', 'demo'] }, '$gross', 0] } },
        },
      },
    ]),
    User.aggregate([
      { $match: { role: 'seller' } },
      { $group: { _id: null, pending: { $sum: '$seller.pendingPayout' }, paid: { $sum: '$seller.paidPayout' }, sellers: { $sum: 1 } } },
    ]),
    User.find({ role: 'seller', 'seller.pendingPayout': { $gt: 0 } })
      .select(`name email ${SELLER_WITH_BANK}`)
      .sort({ 'seller.pendingPayout': -1 })
      .limit(200)
      .lean(),
    Payout.find({ status: 'requested' }).select('seller createdAt').lean(),
    Payout.find({ status: 'paid' })
      .select('seller amount reference paidAt destination destinationEnc')
      .populate('seller', 'name email seller.storeName')
      .sort({ paidAt: -1 })
      .limit(15)
      .lean(),
  ]);

  const requestedAt = new Map(openRequests.map((p) => [String(p.seller), p.createdAt]));
  const s = salesAgg[0] ?? {};
  const b = balancesAgg[0] ?? {};
  return toPlain({
    totals: {
      platformSales: s.gross ?? 0,
      commission: s.commission ?? 0,
      platformOwned: s.platformOwned ?? 0,
      demoSales: s.demoGross ?? 0,
      pendingPayouts: b.pending ?? 0,
      paidPayouts: b.paid ?? 0,
      sellerCount: b.sellers ?? 0,
    },
    queue: sellers.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      storeName: u.seller.storeName,
      pendingPayout: u.seller.pendingPayout,
      paidPayout: u.seller.paidPayout,
      bankDetails: readBankDetails(u.seller),
      requestedAt: requestedAt.get(String(u._id)) ?? null,
    })),
    recentPayouts: recentPayouts.map(({ destinationEnc, ...p }) => ({ ...p, destination: readPayoutDestination({ destinationEnc, destination: p.destination }) })),
  });
}

/**
 * Records that an admin manually paid a seller.
 *
 * `amount` is what the admin actually sent (the balance they saw when they clicked). Only that much is
 * cleared: if a new sale landed in between, it stays pending instead of being marked paid without
 * having been paid. Omitting `amount` (API-key scripts) clears the full current balance.
 *
 * Runs in one MongoDB transaction: debit balance → payout record → ledger entry.
 * Callers must authorize as admin first.
 */
export async function clearSellerPayout({ sellerId, amount: requested, reference, adminId }) {
  if (!mongoose.isValidObjectId(sellerId)) throw new InputError('Seller not found.', {}, 404);
  if (requested !== undefined && (!Number.isInteger(requested) || requested <= 0)) {
    throw new InputError('Amount must be a positive whole number of cents.');
  }
  const ref = typeof reference === 'string' ? reference.trim().slice(0, 120) : '';
  await connectDB();

  let payout;
  await mongoose.connection.transaction(async (session) => {
    const seller = await User.findOne({ _id: sellerId, role: 'seller' })
      .select(SELLER_WITH_BANK)
      .session(session)
      .lean();
    if (!seller) throw new InputError('Seller not found.', {}, 404);

    const pending = seller.seller?.pendingPayout ?? 0;
    if (pending <= 0) throw new InputError('This seller has no pending balance.', {}, 409);
    if (requested > pending) throw new InputError('That’s more than the seller’s pending balance — refresh and try again.', {}, 409);
    const amount = requested ?? pending;

    const { modifiedCount } = await User.updateOne(
      { _id: sellerId, 'seller.pendingPayout': { $gte: amount } },
      { $inc: { 'seller.pendingPayout': -amount, 'seller.paidPayout': amount } },
      { session },
    );
    if (!modifiedCount) throw new InputError('Balance changed while processing — please retry.', {}, 409);

    const paid = {
      amount,
      status: 'paid',
      ...payoutDestinationFields(readBankDetails(seller.seller)), // snapshot, encrypted at rest
      reference: ref || undefined,
      processedBy: adminId,
      paidAt: new Date(),
    };
    // Fulfil the seller's open request if there is one; otherwise record a new payout.
    payout = await Payout.findOneAndUpdate({ seller: sellerId, status: 'requested' }, { $set: paid }, { session, returnDocument: 'after' });
    if (!payout) [payout] = await Payout.create([{ seller: sellerId, ...paid }], { session });

    await Transaction.create(
      [{ type: 'payout', seller: sellerId, payout: payout._id, gross: 0, commission: 0, sellerEarning: -amount }],
      { session },
    );
  });

  const { destinationEnc: _, ...result } = toPlain(payout); // the ciphertext never leaves the server
  return result;
}
