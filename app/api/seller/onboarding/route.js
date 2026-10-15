import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { setupStore } from '@/lib/data/seller';

/** POST /api/seller/onboarding — { storeName, storeDescription } names the signed-in seller's shop (once). */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');

  try {
    const body = await readJson(request);
    return json(await setupStore(user.id, { storeName: body.storeName, storeDescription: body.storeDescription }), 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/onboarding');
  }
}
