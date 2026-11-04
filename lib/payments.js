import 'server-only';
import { randomBytes } from 'node:crypto';
import { payfastConfigured } from '@/lib/payfast';

export class PaymentUnavailableError extends Error {}

/** True on a public site (a real domain, or Vercel production) — never on localhost. */
function isLiveSite() {
  if (process.env.VERCEL_ENV === 'production') return true;
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost').hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost') || host.endsWith('.test'));
  } catch {
    return true; // unreadable site URL: assume live, the safe side
  }
}

/**
 * Demo checkout (paid orders complete without payment) — for local testing only. Even if DEMO_CHECKOUT=true is
 * copied to a live server by mistake, it stays off there, so products can never be given away for free.
 */
export const isDemoCheckout = () => process.env.DEMO_CHECKOUT === 'true' && !isLiveSite();

/** True when real payments are set up (PayFast credentials present). */
export { payfastConfigured as onlinePaymentsEnabled } from '@/lib/payfast';

/**
 * Single integration point for payment providers: how an order with this total gets paid.
 *  - 'free'     total 0, completes immediately
 *  - 'demo'     DEMO_CHECKOUT=true on a local machine, completes without payment
 *  - 'payfast'  the order is saved as pending and the buyer pays on PayFast's hosted page (lib/payfast.js); it is
 *               completed when PayFast's signed result arrives (lib/data/orders.js → settlePayFastResult)
 * With none of these, paid orders are refused: products are never given away silently.
 */
export function paymentProviderFor(total) {
  if (total === 0) return 'free';
  if (isDemoCheckout()) return 'demo';
  if (payfastConfigured()) return 'payfast';
  throw new PaymentUnavailableError('Payments are not configured yet. Only free products can be checked out.');
}

/** A unique payment reference for orders that complete without a provider round trip. */
export const instantReference = (provider) => `${provider}_${randomBytes(12).toString('hex')}`;
