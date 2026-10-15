import { NextResponse } from 'next/server';
import { verifyDownloadToken } from '@/lib/tokens';
import { consumeDownload } from '@/lib/data/orders';
import { resolveDelivery } from '@/lib/storage';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' };

function fail(message, status) {
  return new NextResponse(message, { status, headers: { ...PRIVATE, 'Content-Type': 'text/plain; charset=utf-8' } });
}

/** GET /api/downloads/:token — verifies the signed token, enforces order status + download limits, then delivers. */
export async function GET(_request, { params }) {
  const { token } = await params;

  const claims = verifyDownloadToken(token);
  if (!claims) return fail('This download link is invalid or has expired. Reopen your receipt to get a fresh link.', 410);

  try {
    const result = await consumeDownload(claims);
    if (result.error === 'limit_reached') return fail('Download limit reached for this item. Contact support for help.', 429);
    if (result.error) return fail('Download not available.', 404);

    const delivery = await resolveDelivery(result.product);

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
