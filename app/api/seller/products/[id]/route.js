import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { deleteSellerProduct, setSellerProductVisibility, updateSellerProduct } from '@/lib/data/seller';
import { refreshStorefront } from '@/lib/revalidate';

async function sellerOrError(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return { error: unauthorized() };
  if (user.role !== 'seller') return { error: forbidden('Seller account required.') };
  if (!user.storeName) return { error: json({ error: 'Set up your shop first.' }, 409) };
  return { user };
}

/** PUT /api/seller/products/:id — edit the product (same fields as upload); it goes back to "In review". */
export async function PUT(request, { params }) {
  const { user, error } = await sellerOrError(request);
  if (error) return error;
  try {
    const { id } = await params;
    const { product, previousSlug } = await updateSellerProduct(user.id, id, await readJson(request, 64 * 1024));
    refreshStorefront(previousSlug, product.slug); // it leaves the store until re-approved
    return json(product);
  } catch (err) {
    return errorResponse(err, 'PUT /api/seller/products/[id]');
  }
}

/** PATCH /api/seller/products/:id — { isPublished } hides or shows one of the seller's approved products. */
export async function PATCH(request, { params }) {
  const { user, error } = await sellerOrError(request);
  if (error) return error;
  try {
    const { id } = await params;
    const body = await readJson(request);
    const result = await setSellerProductVisibility(user.id, id, body.isPublished);
    refreshStorefront(result.slug);
    return json(result);
  } catch (err) {
    return errorResponse(err, 'PATCH /api/seller/products/[id]');
  }
}

/** DELETE /api/seller/products/:id — deletes (or, if already sold, unpublishes) one of the seller's products. */
export async function DELETE(request, { params }) {
  const { user, error } = await sellerOrError(request);
  if (error) return error;
  try {
    const { id } = await params;
    const outcome = await deleteSellerProduct(user.id, id);
    refreshStorefront(outcome.slug);
    return json(outcome);
  } catch (err) {
    return errorResponse(err, 'DELETE /api/seller/products/[id]');
  }
}
