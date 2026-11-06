import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { setSessionCookies } from '@/lib/auth';
import { GOOGLE_FLOW_COOKIE, googleIdentity, googleRedirectUri, googleSignInEnabled, sameState, siteOrigin } from '@/lib/google-auth';
import { isOwnerAdminEmail } from '@/lib/owner-admin';
import { safeNext } from '@/lib/redirects';
import User from '@/models/User';

// Same landing pages as the email login (components/auth/LoginForm.jsx).
const DASHBOARD = { seller: '/seller/dashboard', customer: '/' };

/**
 * GET /api/auth/google/callback — Google sends the user back here. Signs in the account with this Google ID or the
 * same (Google-verified) email, linking Google to it; otherwise creates a customer account. Admin accounts must use
 * their password; blocked accounts are refused.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const site = siteOrigin(request.url); // public address (not the proxy's localhost:4810)
  const fail = (code) => {
    const res = NextResponse.redirect(new URL(`/login?error=${code}`, site));
    res.cookies.set(GOOGLE_FLOW_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
    return res;
  };
  if (!googleSignInEnabled()) return fail('google_unavailable');
  if (url.searchParams.get('error')) return fail('google_cancelled'); // e.g. the user pressed Cancel on Google

  let flow;
  try {
    flow = JSON.parse(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value ?? '');
  } catch {
    return fail('google_expired');
  }
  const code = url.searchParams.get('code');
  if (!code || !sameState(flow?.state, url.searchParams.get('state'))) return fail('google_expired');

  try {
    const google = await googleIdentity({ code, verifier: flow.verifier, redirectUri: googleRedirectUri(request.url) });
    await connectDB();
    let user =
      (await User.findOne({ googleId: google.sub }).select('name email role createdAt emailVerifiedAt tokenVersion blockedAt googleId seller.storeName')) ??
      (await User.findOne({ email: google.email }).select('name email role createdAt emailVerifiedAt tokenVersion blockedAt googleId seller.storeName'));

    if (user?.role === 'admin' || (!user && isOwnerAdminEmail(google.email))) return fail('google_admin');
    if (user?.blockedAt) return fail('suspended');

    if (!user) {
      // A random password the person never sees: they sign in with Google (or set one later via "Forgot password").
      user = await User.create({
        name: (google.name || google.email.split('@')[0]).slice(0, 60),
        email: google.email,
        password: randomBytes(32).toString('base64url'),
        googleId: google.sub,
        termsAcceptedAt: new Date(), // the button says continuing means accepting the Terms
      });
    } else if (!user.googleId) {
      user.googleId = google.sub; // Google confirmed this email belongs to them: link it for next time
    }
    user.emailVerifiedAt ??= new Date(); // Google only signs in with verified addresses (googleIdentity)
    user.lastLoginAt = new Date();
    await user.save();

    const res = NextResponse.redirect(new URL(safeNext(flow.next) ?? DASHBOARD[user.role] ?? '/', site));
    setSessionCookies(res, user);
    res.cookies.set(GOOGLE_FLOW_COOKIE, '', { path: '/api/auth/google', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('[GET /api/auth/google/callback]', err.message);
    return fail(err.code === 'unverified' ? 'google_unverified' : 'google_failed');
  }
}
