import { getRequestUser, setSessionCookies, publicUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { registerSeller } from '@/lib/data/seller';

/** POST /api/seller/register — { storeName, bankDetails } turns the signed-in customer into a seller. */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'customer') return forbidden(user.role === 'seller' ? 'You’re already a seller.' : 'Admin accounts can’t register as sellers.');

  try {
    const body = await readJson(request);
    const updated = await registerSeller(user.id, { storeName: body.storeName, bankDetails: body.bankDetails });
    const res = json({ user: publicUser(updated) }, 201);
    setSessionCookies(res, updated); // re-issue with the seller session lifetime
    return res;
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/register');
  }
}
