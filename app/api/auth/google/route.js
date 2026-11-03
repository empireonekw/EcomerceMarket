import { NextResponse } from 'next/server';
import { GOOGLE_FLOW_COOKIE, googleAuthRequest, googleRedirectUri, googleSignInEnabled, siteOrigin } from '@/lib/google-auth';
import { safeNext } from '@/lib/redirects';

/** GET /api/auth/google?next=/checkout — starts "Continue with Google" (sign-in and sign-up are the same flow). */
export async function GET(request) {
  const url = new URL(request.url);
  if (!googleSignInEnabled()) return NextResponse.redirect(new URL('/login?error=google_unavailable', siteOrigin(request.url)));

  const { url: consentUrl, state, verifier } = googleAuthRequest(googleRedirectUri(request.url));
  const res = NextResponse.redirect(consentUrl);
  res.cookies.set(GOOGLE_FLOW_COOKIE, JSON.stringify({ state, verifier, next: safeNext(url.searchParams.get('next')) ?? null }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // sent when Google redirects back (a top-level GET)
    path: '/api/auth/google',
    maxAge: 10 * 60,
  });
  return res;
}
