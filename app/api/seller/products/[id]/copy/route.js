import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, errorResponse, tooMany } from '@/lib/api';
import { copySellerProduct } from '@/lib/data/seller';

/** POST /api/seller/products/:id/copy — duplicates one of the seller's listings as a new private draft. */
export async function POST(request, { params }) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (!user.storeName) return json({ error: 'Set up your shop first.' }, 409);
  // Copies are new listings: same hourly budget as creating one (app/api/seller/products).
  const slow = tooMany(`listing-create:${user.id}`, 100, 60 * 60_000, 'You’ve added a lot of listings in the last hour. Please wait a little.');
  if (slow) return slow;
  try {
    const { id } = await params;
    const product = await copySellerProduct(user.id, id);
    return json({ _id: String(product._id), title: product.title }, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/products/[id]/copy');
  }
}
