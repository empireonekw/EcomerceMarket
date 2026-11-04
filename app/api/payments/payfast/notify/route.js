import { settlePayFastResult } from '@/lib/data/orders';
import { payfastParams } from '../params';

const text = (body, status) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  });

/**
 * CHECKOUT_URL: PayFast's server-to-server payment notification. The reliable confirmation: it arrives even if the
 * buyer closes the tab before returning. Safe to receive more than once (settlePayFastResult books a sale once).
 */
async function handle(request) {
  const params = await payfastParams(request);
  try {
    const result = await settlePayFastResult(params);
    if (!result.ok) {
      console.warn('[PayFast notify] rejected:', result.reason, params.basket_id ?? params.BASKET_ID ?? '');
      return text('REJECTED', 400);
    }
    return text('OK', 200);
  } catch (err) {
    console.error('[PayFast notify]', err);
    return text('ERROR', 500); // lets PayFast retry
  }
}

export const GET = handle;
export const POST = handle;
