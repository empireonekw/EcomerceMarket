import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse, tooMany } from '@/lib/api';
import { updatePayoutDetails, updateShopContact, updateStoreDetails } from '@/lib/data/seller';

/**
 * PUT /api/seller/profile (Shop settings, /seller/settings)
 *   { bankDetails }                                     → payout destination (bank account and/or mobile wallet)
 *   { contact: { country, currency, address, phone } }  → where the shop is based, billing address and phone
 *   { storeName, storeDescription, logo?, banner? }     → shop profile ('' removes the logo or banner)
 */
export async function PUT(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  const slow = tooMany(`seller-profile:${user.id}`, 30, 10 * 60_000);
  if (slow) return slow;

  try {
    const body = await readJson(request);
    if (body.bankDetails !== undefined) return json(await updatePayoutDetails(user.id, body.bankDetails));
    if (body.contact !== undefined) return json(await updateShopContact(user.id, body.contact));
    const { storeName, storeDescription, logo, banner } = body;
    return json(await updateStoreDetails(user.id, { storeName, storeDescription, logo, banner }));
  } catch (err) {
    return errorResponse(err, 'PUT /api/seller/profile');
  }
}
