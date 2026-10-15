import 'server-only';
import { randomBytes } from 'node:crypto';

export class PaymentUnavailableError extends Error {}

export const isDemoCheckout = () => process.env.DEMO_CHECKOUT === 'true';

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
