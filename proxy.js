import { NextResponse } from 'next/server';
import { clientIp } from '@/lib/client-ip';
import { rateLimit } from '@/lib/rate-limit';

// Must match SESSION_COOKIE in lib/auth.js (not imported: lib/auth.js is server-only + DB-backed).
const SESSION_COOKIE = 'apex_session';
const PROTECTED = ['/admin', '/profile', '/seller', '/messages'];

/**
 * Site-wide flood protection, per visitor IP and minute, before anything renders or touches the database.
 * Routes keep their own, stricter limits on top (login 10 per 15 min, signup 5 per hour, contact, search…).
 * Link prefetches are excluded by the matcher; requests with no client IP (the server calling itself, e.g. the image
 * optimizer, and local dev) are never limited.
 */
const LIMITS = {
  auth: { limit: 30, windowMs: 60_000 }, // /api/auth/* — sign-in, sign-up, session
  apiWrite: { limit: 90, windowMs: 60_000 }, // any other POST / PUT / PATCH / DELETE
  apiRead: { limit: 300, windowMs: 60_000 }, // API GETs (search autocomplete, media, inbox…)
  page: { limit: 240, windowMs: 60_000 }, // page loads and client-side navigations
};

function tierOf(request) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/')) return 'page';
  if (pathname.startsWith('/api/auth/')) return 'auth';
  return ['GET', 'HEAD'].includes(request.method) ? 'apiRead' : 'apiWrite';
}

function tooManyRequests(tier, retryAfterMs) {
  const headers = { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)), 'Cache-Control': 'no-store' };
  if (tier !== 'page') {
    return NextResponse.json({ error: 'Too many requests. Please slow down and try again in a minute.' }, { status: 429, headers });
  }
  return new NextResponse(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slow down</title>' +
      '<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#141414">' +
      '<div style="text-align:center;padding:24px"><h1 style="font-weight:400">Too many requests</h1>' +
      '<p style="color:#57534e">You’re going a little fast. Please wait a minute and try again.</p></div></body>',
    { status: 429, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export function proxy(request) {
  const ip = clientIp(request);
  if (ip !== 'local') {
    const tier = tierOf(request);
    const result = rateLimit(`global:${tier}:${ip}`, LIMITS[tier]);
    if (!result.ok) return tooManyRequests(tier, result.retryAfterMs);
  }

  // Optimistic gate for signed-in areas: no session cookie → straight to /login?next=…, before any rendering.
  // This is NOT the security boundary — every protected page, data function and API route verifies the
  // JWT signature, token version and role itself (lib/auth.js).
  const { pathname, search } = request.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    {
      // Pages: everything except build assets, optimized images, metadata files and static files — and not prefetches.
      source: '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|txt|xml|woff2?)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
