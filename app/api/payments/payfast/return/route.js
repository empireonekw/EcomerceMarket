import { NextResponse } from 'next/server';
import { settlePayFastResult } from '@/lib/data/orders';
import { siteConfig } from '@/lib/site';
import { payfastParams } from '../params';

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const TOKEN = /^[A-Za-z0-9_-]{20,200}$/;

/**
 * SUCCESS_URL and FAILURE_URL: where PayFast sends the buyer back, with the signed result appended to
 * ?order=<id>&token=<receipt token> (set in lib/data/orders.js). The result is applied here too, not only in the
 * server notification, so the receipt is up to date the moment the buyer lands on it. Then on to the receipt, which
 * shows the outcome: files when paid, "try again" when declined, "confirming" while PayFast hasn't said yet.
 */
async function handle(request) {
  const params = await payfastParams(request);
  try {
    const result = await settlePayFastResult(params);
    if (!result.ok) console.warn('[PayFast return] not applied:', result.reason, params.basket_id ?? params.BASKET_ID ?? '');
  } catch (err) {
    console.error('[PayFast return]', err); // the notification can still settle it; the receipt shows "confirming"
  }

  const { order, token } = Object.fromEntries(request.nextUrl.searchParams);
  const target = OBJECT_ID.test(order ?? '') && TOKEN.test(token ?? '') ? `/checkout/success?order=${order}&token=${token}` : '/checkout';
  // 303: the browser follows with a GET even when PayFast returned with a POST. The public site URL, not request.url:
  // behind nginx the request URL is the app's internal address (localhost:4810).
  return NextResponse.redirect(new URL(target, siteConfig.url), {
    status: 303,
    headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

export const GET = handle;
export const POST = handle;
