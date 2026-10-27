import 'server-only';
import { randomBytes } from 'node:crypto';

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

/**
 * Single integration point for a payment provider.
 *
 * Today:
 *  - Free orders (total 0) complete immediately.
 *  - Paid orders complete instantly ONLY when DEMO_CHECKOUT=true (local testing).
 *  - Otherwise paid orders are refused — never silently give products away.
 *
 * To go live, replace the demo branch with e.g. a Stripe Checkout Session: create the order
 * as pending, redirect to the provider, and complete it from the provider's webhook.
 */
export async function chargeOrder({ total }) {
  if (total === 0) return { provider: 'free', reference: `free_${randomBytes(12).toString('hex')}` };
  if (isDemoCheckout()) return { provider: 'demo', reference: `demo_${randomBytes(12).toString('hex')}` };
  throw new PaymentUnavailableError('Payments are not configured yet. Only free products can be checked out.');
}
