import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, readJson, errorResponse } from '@/lib/api';
import { createSellerProduct } from '@/lib/data/seller';

/**
 * POST /api/seller/products — seller uploads a product.
 * Body: { title, category, price (cents), description, coverImage, pdfFileUrl, ...optional }
 * Always saved as status 'pending' and owned by the signed-in seller; an admin approves it.
 */
export async function POST(request) {
  const user = await getRequestUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');

  try {
    const product = await createSellerProduct(user.id, await readJson(request, 64 * 1024));
    return json(product, 201);
  } catch (err) {
    return errorResponse(err, 'POST /api/seller/products');
  }
}
