import { NextResponse } from 'next/server';
import { verifyDownloadToken } from '@/lib/tokens';
import { consumeDownload } from '@/lib/data/orders';
import { resolveDelivery } from '@/lib/storage';
import { rateLimit } from '@/lib/rate-limit';
import { DOWNLOADS_PER_HOUR } from '@/lib/downloads';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' };

function fail(message, status) {
  return new NextResponse(message, { status, headers: { ...PRIVATE, 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** GET /api/downloads/:token — verifies the signed token and order status, throttles bursts, then delivers. */
export async function GET(_request, { params }) {
  const { token } = await params;

  const claims = verifyDownloadToken(token);
  if (!claims) return fail('This download link is invalid or has expired. Reopen your receipt to get a fresh link.', 410);

  // Lifetime re-downloads, but not a firehose: a shared link stops working after a burst.
  if (!rateLimit(`download:${claims.orderId}:${claims.productId}`, { limit: DOWNLOADS_PER_HOUR, windowMs: 60 * 60 * 1000 }).ok) {
    return fail('This item has been downloaded many times in the last hour. Please try again later, or contact support if you need help.', 429);
  }

  try {
    const result = await consumeDownload(claims);
    if (result.error) return fail('Download not available.', 404);

    const delivery = await resolveDelivery(result.product);

    if (delivery.type === 'stream') {
      const ascii = delivery.filename.replace(/[^\x20-\x7e]|["\\]/g, '_'); // plain-ASCII fallback for old browsers
      return new NextResponse(delivery.stream, {
        headers: {
          ...PRIVATE,
          'Content-Type': delivery.contentType,
          ...(delivery.size && { 'Content-Length': String(delivery.size) }),
          'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(delivery.filename)}`,
        },
      });
    }
    if (delivery.type === 'redirect') {
      return NextResponse.redirect(delivery.url, { status: 302, headers: PRIVATE });
    }
    if (delivery.type === 'placeholder') {
      return new NextResponse(delivery.body, {
        headers: {
          ...PRIVATE,
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${delivery.filename.replace(/["\\\r\n]/g, '')}"`,
        },
      });
    }

    console.error('[downloads] storage not configured for product', String(result.product._id));
    return fail('This file is temporarily unavailable. Please try again later.', 503);
  } catch (err) {
    console.error('[GET /api/downloads]', err);
    return fail('Something went wrong. Please try again.', 500);
  }
}
