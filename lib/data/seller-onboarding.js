import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex, toPlain } from '@/lib/utils';
import { bankDetailsUpdate, decryptJson, encryptionEnabled, encryptJson } from '@/lib/field-encryption';
import { normalizeBankDetails } from '@/lib/validation';
import { checkStep, EMPTY_ONBOARDING, ONBOARDING_STEPS } from '@/lib/seller-onboarding';
import { InputError } from '@/lib/data/product-writes';
import User from '@/models/User';

// The shop-opening wizard (/sell-on-sellpify). Callers authorize first and pass the signed-in user's id.
// Progress is kept on the user (`sellerOnboarding`) until the last step, which opens the shop: the seller fields
// are written and the account becomes a seller. Until then nothing about the account changes.

const DRAFT_STEPS = ONBOARDING_STEPS.map((s) => s.id).filter((id) => id !== 'review');
const PAYOUT_PURPOSE = 'onboarding-payout';
const fail = (fields, message = 'Please fix the highlighted fields.', status = 400) => new InputError(message, fields, status);

/** True when no other shop uses `name` (case-insensitive, like the unique index on seller.storeName). */
export async function isStoreNameAvailable(name, userId) {
  await connectDB();
  const taken = await User.exists({
    'seller.storeName': new RegExp(`^${escapeRegex(String(name).trim())}$`, 'i'),
    ...(userId && mongoose.isValidObjectId(userId) && { _id: { $ne: userId } }),
  });
  return !taken;
}

async function loadAccount(userId) {
  await connectDB();
  const user = await User.findById(userId).select('role +sellerOnboarding seller.storeName seller.joinedAt').lean();
  if (!user) throw fail({}, 'Account not found.', 404);
  if (user.role === 'admin') throw fail({}, 'Admin accounts can’t open a shop.', 403);
  if (user.seller?.storeName) throw fail({}, 'Your shop is already open.', 409);
  return user;
}

const readPayout = (draft) => (draft?.payoutEnc ? (decryptJson(draft.payoutEnc, PAYOUT_PURPOSE) ?? {}) : (draft?.payout ?? {}));

/** The wizard's saved progress: { step (index of the first unfinished step), data (every step, with defaults) }. */
export async function getOnboarding(userId) {
  const user = await loadAccount(userId);
  const draft = user.sellerOnboarding ?? {};
  const data = Object.fromEntries(DRAFT_STEPS.map((id) => [id, { ...EMPTY_ONBOARDING[id], ...(id === 'payout' ? readPayout(draft) : draft[id]) }]));
  data.billing.address = { ...EMPTY_ONBOARDING.billing.address, ...data.billing.address };
  data.billing.phone = { ...EMPTY_ONBOARDING.billing.phone, ...data.billing.phone };
  return toPlain({ step: Math.min(draft.step ?? 0, ONBOARDING_STEPS.length - 1), data });
}

/** Server-only checks on top of the shared rules: the shop name is free. */
async function checkOnServer(step, data, userId) {
  if (step === 'identity' && !(await isStoreNameAvailable(data.storeName, userId))) {
    throw fail({ storeName: 'That shop name is taken. Try another.' });
  }
}

/** Saves one step after checking it; returns the updated progress. */
export async function saveOnboardingStep(userId, step, input) {
  if (!DRAFT_STEPS.includes(step)) throw fail({}, 'Unknown step.');
  await loadAccount(userId);
  const result = checkStep(step, input);
  if (!result.ok) throw fail(result.errors);
  await checkOnServer(step, result.data, userId);

  const index = DRAFT_STEPS.indexOf(step);
  const set = { 'sellerOnboarding.updatedAt': new Date() };
  if (step === 'payout') {
    // Payout details are encrypted at rest when DATA_ENCRYPTION_KEY is set, like a seller's saved details.
    const payout = { method: result.data.method, ...normalizeBankDetails(result.data) };
    if (encryptionEnabled()) set['sellerOnboarding.payoutEnc'] = encryptJson(payout, PAYOUT_PURPOSE);
    else set['sellerOnboarding.payout'] = payout;
  } else set[`sellerOnboarding.${step}`] = result.data;
  await User.updateOne({ _id: userId }, { $set: set, $max: { 'sellerOnboarding.step': index + 1 } });
  return getOnboarding(userId);
}

/**
 * The last step: agrees to the Seller Agreement, re-checks every saved step and opens the shop. The account becomes
 * a seller (a shopper keeps their purchases) and the draft goes. Identity is checked later, after the first sale.
 */
export async function submitOnboarding(userId, input) {
  const terms = checkStep('review', input);
  if (!terms.ok) throw fail(terms.errors);
  const user = await loadAccount(userId);
  const draft = user.sellerOnboarding ?? {};

  const data = {};
  for (const [i, step] of DRAFT_STEPS.entries()) {
    const result = checkStep(step, step === 'payout' ? readPayout(draft) : draft[step]);
    if (!result.ok) throw fail({ step: i }, `“${ONBOARDING_STEPS[i].label}” isn’t finished yet.`);
    data[step] = result.data;
  }
  await checkOnServer('identity', data.identity, userId);

  const { preferences: p, identity: id, billing: b } = data;
  const now = new Date();
  const payoutUpdate = bankDetailsUpdate(
    normalizeBankDetails(
      data.payout.method === 'bank'
        ? { ...data.payout, walletProvider: '', walletNumber: '' }
        : { walletProvider: data.payout.walletProvider, walletNumber: data.payout.walletNumber },
    ),
  );
  const set = {
    role: 'seller',
    sellerTermsAcceptedAt: now,
    'seller.storeName': id.storeName,
    ...(id.storeDescription && { 'seller.storeDescription': id.storeDescription }),
    ...(id.logo && { 'seller.logo': id.logo }),
    ...(id.banner && { 'seller.banner': id.banner }),
    'seller.country': p.country,
    'seller.currency': p.currency,
    'seller.address': { ...b.address, country: p.country },
    'seller.phone': b.phone,
    'seller.storeSetupAt': now,
    ...payoutUpdate.$set,
    // A shopper opening a shop starts with empty balances (sellers who signed up as sellers already have them).
    ...(user.role === 'customer' && { 'seller.totalEarnings': 0, 'seller.pendingPayout': 0, 'seller.paidPayout': 0 }),
    ...(!user.seller?.joinedAt && { 'seller.joinedAt': now }),
  };
  try {
    const { matchedCount } = await User.updateOne(
      { _id: userId, role: { $in: ['customer', 'seller'] }, 'seller.storeName': { $exists: false } }, // once only
      { $set: set, $unset: { sellerOnboarding: 1, ...payoutUpdate.$unset } },
      { runValidators: true },
    );
    if (!matchedCount) throw fail({}, 'Your shop is already open.', 409);
  } catch (err) {
    if (err?.code === 11000)
      throw fail({ step: 1, storeName: 'That shop name was just taken. Choose another.' }, 'That shop name was just taken.', 409);
    throw err;
  }
  return { storeName: id.storeName };
}
