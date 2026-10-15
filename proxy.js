import { NextResponse } from 'next/server';

// Must match SESSION_COOKIE in lib/auth.js (not imported: lib/auth.js is server-only + DB-backed).
const SESSION_COOKIE = 'apex_session';

/**
 * Optimistic gate for signed-in areas: no session cookie → straight to /login?next=…, before any rendering.
 * This is NOT the security boundary — every protected page, data function and API route verifies the
 * JWT signature, token version and role itself (lib/auth.js).
 */
export function proxy(request) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/profile/:path*', '/seller/:path*'],
};
