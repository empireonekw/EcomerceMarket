// Marketplace commission — pure helpers shared by the order ledger (server) and seller UI (client).
// All amounts are integer cents.

const configured = Number(process.env.NEXT_PUBLIC_COMMISSION_RATE);
/** Platform share of every seller sale. Defaults to 10%. */
export const COMMISSION_RATE = Number.isFinite(configured) && configured >= 0 && configured < 1 ? configured : 0.1;

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
