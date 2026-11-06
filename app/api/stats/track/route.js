import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { getRequestUser } from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { referrerSource, statsDay } from '@/lib/listing-stats';
import { siteConfig } from '@/lib/site';
import ListingStat, { ListingSearchTerm } from '@/models/ListingStat';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';

/**
 * POST /api/stats/track — { productId, event: 'visit' | 'cart', referrer? } from the product page / Add to cart.
 * Counts toward the seller's Listing stats. Anonymous; rate-limited per network and listing, and the seller's own
 * visits don't count. Always answers 204 so tracking can never break a page.
 */
export async function POST(request) {
  const done = new NextResponse(null, { status: 204 });
  try {
    const { productId, event, referrer } = await request.json();
    if (!mongoose.isValidObjectId(productId) || !['visit', 'cart'].includes(event)) return done;
    // At most 3 per network per listing per hour, so refreshing can't inflate the numbers. Not locally: every request
    // there comes from the same address, which would make test visits from different accounts count only 3 times.
    const ip = clientIp(request);
    if (ip !== 'local' && !rateLimit(`track:${event}:${ip}:${productId}`, { limit: 3, windowMs: 60 * 60 * 1000 }).ok) return done;

    await connectDB();
    const product = await Product.findOne({ _id: productId, ...PUBLIC_PRODUCT_FILTER }).select('sellerId').lean();
    if (!product) return done;
    const viewer = await getRequestUser(request).catch(() => null);
    if (viewer && product.sellerId && String(viewer.id) === String(product.sellerId)) return done; // the seller looking at their own listing

    const day = statsDay();
    const inc = event === 'cart' ? { carts: 1 } : { visits: 1 };
    let term = null;
    if (event === 'visit') {
      // This site's own pages (public address, plus the address this request came in on locally).
      const from = referrerSource(String(referrer ?? ''), [new URL(siteConfig.url).host, new URL(request.url).host]);
      inc[`sources.${from.source}`] = 1;
      term = from.term;
    }
    await ListingStat.updateOne({ product: product._id, day }, { $inc: inc, $setOnInsert: { seller: product.sellerId } }, { upsert: true });
    if (term) await ListingSearchTerm.updateOne({ product: product._id, day, term }, { $inc: { count: 1 } }, { upsert: true });
  } catch (err) {
    // Tracking is best-effort: never fails the page, but say why in the server log.
    console.error('[stats/track] not recorded:', err?.message ?? err);
  }
  return done;
}
