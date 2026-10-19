import { NextResponse } from 'next/server';
import { refreshStorefront } from '@/lib/revalidate';
import { getProductBySlug, getProductById } from '@/lib/data/products';
import { updateProduct, deleteProduct, InputError } from '@/lib/data/product-writes';
import { authorizeAdminRequest } from '@/lib/auth';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MAX_BODY_BYTES = 64 * 1024;
const unauthorized = () =>
  NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });


/**
 * GET /api/products/:id — public product details by ObjectId or slug (never includes downloadUrl).
 * (One dynamic segment serves both: Next.js doesn't allow sibling [id] and [slug] folders.)
 */
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const product = OBJECT_ID.test(id) ? await getProductById(id) : await getProductBySlug(id);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json(product, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('[GET /api/products/:id]', err);
    return NextResponse.json({ error: 'Failed to load product' }, { status: 500 });
  }
}

/** PUT /api/products/:id — admin. Partial update of any writable field (title, price, category, downloadUrl, coverImage…). */
export async function PUT(request, { params }) {
  if (!(await authorizeAdminRequest(request))) return unauthorized();

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const { id } = await params;
    const { product, previousSlug } = await updateProduct(id, payload);
    refreshStorefront(previousSlug, product.slug);
    return NextResponse.json(product);
  } catch (err) {
    if (err instanceof InputError) {
      return NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status });
    }
    console.error('[PUT /api/products/:id]', err);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

/** DELETE /api/products/:id — admin. Hard-deletes unsold products; sold ones are unpublished to keep buyers' downloads working. */
export async function DELETE(request, { params }) {
  if (!(await authorizeAdminRequest(request))) return unauthorized();

  try {
    const { id } = await params;
    const outcome = await deleteProduct(id);
    refreshStorefront(outcome.slug);
    return NextResponse.json(outcome);
  } catch (err) {
    if (err instanceof InputError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[DELETE /api/products/:id]', err);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
