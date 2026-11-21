// Marketplace commission — pure helpers shared by the order ledger (server) and seller UI (client).
// All amounts are integer cents.

const configured = Number(process.env.NEXT_PUBLIC_COMMISSION_RATE);
/** Platform share of every seller sale. Defaults to 0: sellers keep 100% (no platform fee). */
export const COMMISSION_RATE = Number.isFinite(configured) && configured >= 0 && configured < 1 ? configured : 0;
/** True while the marketplace charges sellers nothing — UI hides fee rows and says "no platform fees". */
export const NO_PLATFORM_FEE = COMMISSION_RATE === 0;

/** Smallest payout a seller can request, in cents ($50). Checked by requestPayout() and shown on the seller dashboard. */
export const MIN_PAYOUT = 5000;

/**
 * Merchant (payment-processing) fee taken once from each withdrawal: 5% of the amount withdrawn + $0.50, the same as
 * Lemon Squeezy's standard rate. There is no platform fee on sales; this is only charged when a seller is paid out.
 */
export const PAYOUT_FEE = { rate: 0.05, fixedCents: 50 };
/** "5% + $0.50" */
export const PAYOUT_FEE_LABEL = `${+(PAYOUT_FEE.rate * 100).toFixed(2)}% + $${(PAYOUT_FEE.fixedCents / 100).toFixed(2)}`;

/** Splits a withdrawal of `amountCents`: { fee, net }. The fee is rounded to the cent and never exceeds the amount. */
export function payoutFee(amountCents) {
  const amount = Math.max(0, Math.round(amountCents) || 0);
  const fee = Math.min(amount, Math.round(amount * PAYOUT_FEE.rate) + PAYOUT_FEE.fixedCents);
  return { fee, net: amount - fee };
}

export const commissionPercent = (rate = COMMISSION_RATE) => `${+(rate * 100).toFixed(2)}%`;

/**
 * Splits a sale. Commission is rounded to the cent and the seller receives the remainder,
 * so commission + sellerEarning always equals the gross amount exactly (no rounding drift).
 * Products without a seller belong to the platform: it keeps 100%.
 */
export function splitSale(grossCents, { hasSeller = true, rate = COMMISSION_RATE } = {}) {
  if (!hasSeller) return { commission: grossCents, sellerEarning: 0 };
  const commission = Math.round(grossCents * rate);
  return { commission, sellerEarning: grossCents - commission };
}
