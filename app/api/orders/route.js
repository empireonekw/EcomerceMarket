import { NextResponse } from 'next/server';
import { createOrder, OrderError } from '@/lib/data/orders';
import { findOrders } from '@/lib/data/admin';
import { PaymentUnavailableError } from '@/lib/payments';
import { authorizeAdminRequest, getRequestUser } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const MAX_BODY_BYTES = 16 * 1024;
const noStore = { 'Cache-Control': 'no-store' };

/**
 * GET /api/orders?page=1&limit=20&q=<email or order id>&status=completed — admin only.
 * Recent orders, newest first.
 */
export async function GET(request) {
  if (!(await authorizeAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { ...noStore, 'WWW-Authenticate': 'Bearer' } });
  }
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    return NextResponse.json(await findOrders(params), { headers: noStore });
  } catch (err) {
    console.error('[GET /api/orders]', err);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500, headers: noStore });
  }
}

/**
 * POST /api/orders
 * Body: { email: string, phone?: string, items: [{ _id }], expectedTotal?: number (cents) }
 *
 * Re-prices items from MongoDB and settles payment via lib/payments.js: free/demo orders complete now and return
 * signed download links plus a private receipt URL; paid orders return the PayFast checkout form instead.
 *
 * Responses: 201 completed · 202 pending (PayFast) · 400 invalid input · 402 payments unavailable · 409 unavailable/price changed
 */
export async function POST(request) {
  const limit = rateLimit(`orders:${clientIp(request)}`, { limit: 10, windowMs: 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait a minute and try again.' },
      { status: 429, headers: { ...noStore, 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415, headers: noStore });
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: noStore });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: noStore });
  }

  try {
    // Signed-in buyers get the order linked to their account (guests can still check out).
    const buyer = await getRequestUser(request);
    const order = await createOrder(payload, { userId: buyer?.id, userName: buyer?.name, customerIp: clientIp(request) });
    // 201: completed (free / demo) with downloads · 202: pending, `payment` is the form that opens PayFast.
    return NextResponse.json(order, { status: order.payment ? 202 : 201, headers: noStore });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message, code: err.code, details: err.details }, { status: err.status, headers: noStore });
    }
    if (err instanceof PaymentUnavailableError) {
      return NextResponse.json({ error: err.message, code: 'payments_unavailable' }, { status: 402, headers: noStore });
    }
    console.error('[POST /api/orders]', err);
    return NextResponse.json({ error: 'Could not complete your order. Please try again.' }, { status: 500, headers: noStore });
  }
}
