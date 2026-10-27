import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { createSellerProduct } from '@/lib/data/seller';

/**
 * POST /api/seller/products — a new listing from the seller listing form (lib/listing.js has the fields).
 * `draft: true` saves a private draft (only a title is required); otherwise it's submitted for review ('pending').
 * Always owned by the signed-in seller; an admin approves it before it goes live.
 */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (!user.storeName) return json({ error: 'Set up your shop first.' }, 409);

  try {
    const body = await readJson(request, 64 * 1024);
    const product = await createSellerProduct(user.id, body, { draft: body.draft === true });
    return json(product, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/products');
  }
}
