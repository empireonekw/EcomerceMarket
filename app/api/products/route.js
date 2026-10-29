import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getProducts } from '@/lib/data/products';
import { createProduct, InputError } from '@/lib/data/product-writes';
import { authorizeAdminRequest } from '@/lib/auth';
import { ensureCategoryPath } from '@/lib/data/admin-categories';
import { parseProductQuery } from '@/lib/utils';

const MAX_BODY_BYTES = 64 * 1024;

/**
 * GET /api/products?q=resume&category=templates&tag=figma&sort=price|-price|newest|popular&page=1&limit=12
 * Lean, paginated listing — card fields only (title, slug, price, category, coverImage, tags).
 */
export async function GET(request) {
  try {
    const data = await getProducts(parseProductQuery(request.nextUrl.searchParams));
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    console.error('[GET /api/products]', err);
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}

/**
 * POST /api/products — admin only: admin session cookie (portal) or `Authorization: Bearer <ADMIN_API_KEY>`.
 * Body (JSON): { title, description, price (cents), category (slug or id), downloadUrl, ...optional }
 * The URL slug is generated from the title automatically and de-duplicated.
 */
export async function POST(request) {
  if (!(await authorizeAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } });
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }

  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    // Admin form sends typed names (Main / Sub / Inner); missing categories are created on the fly.
    if (payload?.categoryPath) payload.category = (await ensureCategoryPath(payload.categoryPath)).id;
    const product = await createProduct(payload);

    // Refresh cached storefront views that list products / category counts.
    revalidatePath('/');
    revalidateTag('categories', 'max');

    return NextResponse.json(product, {
      status: 201,
      headers: { Location: `/api/products/${product.slug}` },
    });
  } catch (err) {
    if (err instanceof InputError) {
      return NextResponse.json({ error: err.message, fields: err.fields }, { status: err.status });
    }
    console.error('[POST /api/products]', err);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
