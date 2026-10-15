import { NextResponse } from 'next/server';
import { getCategories } from '@/lib/data/categories';

/** GET /api/categories — active categories in display order. */
export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(
      { items: categories },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  } catch (err) {
    console.error('[GET /api/categories]', err);
    return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  }
}
