import { NextResponse } from 'next/server';
import { searchProducts } from '@/lib/data/products';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const MAX_LIMIT = 8;

/**
 * GET /api/search?q=pdf&limit=6 — live-search suggestions for the navbar autocomplete.
 * Returns { items: [{ _id, title, slug, price, currency, coverImage, category }], total }.
 */
export async function GET(request) {
  // Every keystroke (after the client's 300ms debounce) can hit this, so cap it per IP.
  if (!rateLimit(`search:${clientIp(request)}`, { limit: 120, windowMs: 60 * 1000 }).ok) {
    return NextResponse.json({ error: 'Too many searches. Slow down a little.' }, { status: 429 });
  }

  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').trim().slice(0, 100);
  const limit = Math.min(Math.max(Number.parseInt(params.get('limit'), 10) || 6, 1), MAX_LIMIT);

  try {
    const data = q ? await searchProducts(q, limit) : { items: [], total: 0 };
    return NextResponse.json(data, {
      headers: {
        // Browsers always revalidate (a cached "no results" must never outlive a newly approved product);
        // CDNs (Vercel, Cloudflare…) may still serve it for 30s to absorb bursts of identical queries.
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    console.error('[GET /api/search]', err);
    return NextResponse.json({ error: 'Search is unavailable right now.' }, { status: 500 });
  }
}
