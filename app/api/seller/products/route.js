import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse, tooMany } from '@/lib/api';
import { createSellerProduct } from '@/lib/data/seller';
import { refreshStorefront } from '@/lib/revalidate';

/**
 * POST /api/seller/products — a new listing from the seller listing form (lib/listing.js has the fields).
 * `draft: true` saves a private draft (only a title is required); otherwise it's submitted: live at once with
 * auto-approve on (Admin → Products), else waiting for an admin's approval ('pending'). Always the seller's own.
 */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (!user.storeName) return json({ error: 'Set up your shop first.' }, 409);
  const slow = tooMany(`listing-create:${user.id}`, 100, 60 * 60_000, 'You’ve added a lot of listings in the last hour. Please wait a little.');
  if (slow) return slow;

  try {
    const body = await readJson(request, 64 * 1024);
    const product = await createSellerProduct(user.id, body, { draft: body.draft === true });
    if (product.status === 'approved') refreshStorefront(product.slug);
    return json(product, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/products');
  }
}
