import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, errorResponse } from '@/lib/api';
import { copySellerProduct } from '@/lib/data/seller';

/** POST /api/seller/products/:id/copy — duplicates one of the seller's listings as a new private draft. */
export async function POST(request, { params }) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (!user.storeName) return json({ error: 'Set up your shop first.' }, 409);
  try {
    const { id } = await params;
    const product = await copySellerProduct(user.id, id);
    return json({ _id: String(product._id), title: product.title }, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/products/[id]/copy');
  }
}
