import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { claimOrder } from '@/lib/data/orders';

const noStore = { 'Cache-Control': 'no-store' };

const MESSAGES = {
  linked: [200, 'Order saved to your account.'],
  already_yours: [200, 'This order is already in your account.'],
  owned_by_other: [409, 'This order belongs to another account.'],
  not_found: [404, 'Order not found.'],
};

/** POST /api/orders/claim — { orderId, token } links a guest order (proven by its receipt token) to the signed-in user. */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return NextResponse.json({ error: 'Please log in first.' }, { status: 401, headers: noStore });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  }

  try {
    const result = await claimOrder({ orderId: body?.orderId, accessToken: body?.token, userId: user.id });
    const [status, message] = MESSAGES[result];
    return NextResponse.json(status < 400 ? { result, message } : { error: message, result }, { status, headers: noStore });
  } catch (err) {
    console.error('[POST /api/orders/claim]', err);
    return NextResponse.json({ error: 'Could not save this order. Please try again.' }, { status: 500, headers: noStore });
  }
}
