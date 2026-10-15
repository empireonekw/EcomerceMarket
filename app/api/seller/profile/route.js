import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { updatePayoutDetails, updateStoreDetails } from '@/lib/data/seller';

/**
 * PUT /api/seller/profile
 *   { bankDetails }                   → payout destination (bank account and/or mobile wallet)
 *   { storeName, storeDescription }   → shop settings
 */
export async function PUT(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');

  try {
    const body = await readJson(request);
    if (body.bankDetails !== undefined) return json(await updatePayoutDetails(user.id, body.bankDetails));
    return json(await updateStoreDetails(user.id, { storeName: body.storeName, storeDescription: body.storeDescription }));
  } catch (err) {
    return errorResponse(err, 'PUT /api/seller/profile');
  }
}
