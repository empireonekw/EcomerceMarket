import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { updateSellerProfile } from '@/lib/data/seller';

/** PUT /api/seller/profile — { storeName, bankDetails } updates the seller's store and payout destination. */
export async function PUT(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');

  try {
    const body = await readJson(request);
    return json(await updateSellerProfile(user.id, { storeName: body.storeName, bankDetails: body.bankDetails }));
  } catch (err) {
    return errorResponse(err, 'PUT /api/seller/profile');
  }
}
