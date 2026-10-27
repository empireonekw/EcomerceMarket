import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { bulkSellerListings } from '@/lib/data/seller';
import { refreshStorefront } from '@/lib/revalidate';

/** POST /api/seller/products/bulk — { action: 'activate' | 'deactivate' | 'delete', ids } on the seller's own listings. */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');

  try {
    const { action, ids } = await readJson(request);
    const { slugs, ...result } = await bulkSellerListings(user.id, action, ids);
    refreshStorefront(...slugs);
    return json(result);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/products/bulk');
  }
}
