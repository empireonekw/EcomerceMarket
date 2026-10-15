import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHash, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { signJwt, verifyJwt } from '@/lib/tokens';
import User from '@/models/User';

// ---------------------------------------------------------------------------
// Sessions — the Data Access Layer for authentication & authorization.
//
// The session is an HS256 JWT in an httpOnly cookie. Every check re-loads the user from
// MongoDB and compares the token's `ver` with user.tokenVersion, so role changes,
// password changes and "sign out everywhere" take effect immediately.
//
// proxy.js only does an optimistic cookie-presence redirect; every protected page,
// data function and API route must call one of the checks below.
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = 'apex_session';
/** Non-secret "probably logged in" hint readable by client JS, so logged-out visitors skip /api/auth/me. */
export const AUTH_HINT_COOKIE = 'apex_auth';

const SESSION_TTL = {
  admin: 60 * 60 * 8, // 8h — privileged sessions stay short
  seller: 60 * 60 * 24 * 7, // 7 days — sellers handle payouts and bank details
  customer: 60 * 60 * 24 * 30, // 30 days — "keep me signed in"
};

const baseCookie = { secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };

/** Sets the session + hint cookies on a NextResponse. */
export function setSessionCookies(response, user) {
  const ttl = SESSION_TTL[user.role] ?? SESSION_TTL.customer;
  const { token, expiresAt } = signJwt({ sub: String(user._id), role: user.role, ver: user.tokenVersion ?? 0 }, ttl);
  response.cookies.set(SESSION_COOKIE, token, { ...baseCookie, httpOnly: true, expires: expiresAt });
  response.cookies.set(AUTH_HINT_COOKIE, '1', { ...baseCookie, httpOnly: false, expires: expiresAt });
  return expiresAt;
}

export function clearSessionCookies(response) {
  response.cookies.set(SESSION_COOKIE, '', { ...baseCookie, maxAge: 0 });
  response.cookies.set(AUTH_HINT_COOKIE, '', { ...baseCookie, maxAge: 0 });
}

/** Public shape of a user — the only fields ever sent to the browser. */
export const publicUser = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
});

/** Token → current user (or null). Rejects tokens issued before the latest tokenVersion bump. */
async function userFromToken(token) {
  const claims = verifyJwt(token);
  if (!claims?.sub || !mongoose.isValidObjectId(claims.sub)) return null;
  await connectDB();
  const user = await User.findById(claims.sub).select('name email role createdAt tokenVersion').lean();
  if (!user || (user.tokenVersion ?? 0) !== claims.ver) return null;
  return { ...publicUser(user), session: { issuedAt: new Date(claims.iat * 1000), expiresAt: new Date(claims.exp * 1000) } };
}

// ---------------------------------------------------------------------------
// Server Components / pages
// ---------------------------------------------------------------------------

/** Current user for Server Components (deduped per request), or null. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? userFromToken(token) : null;
});

/** For protected pages: returns the user or redirects to /login?next=… */
export async function requireUser(next = '/profile') {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function getAdminUser() {
  const user = await getCurrentUser();
  return user?.role === 'admin' ? user : null;
}

/** For seller pages: signed-out → /login; signed-in non-sellers → /sell to register a store. */
export async function requireSeller(next = '/seller/dashboard') {
  const user = await requireUser(next);
  if (user.role !== 'seller') redirect('/sell');
  return user;
}

/** For admin pages: non-admins are sent to /login (signed-in customers get bounced to their profile there). */
export async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) redirect('/login?next=/admin');
  return admin;
}

// ---------------------------------------------------------------------------
// API route handlers
// ---------------------------------------------------------------------------

/** CSRF defence for cookie-authenticated writes: the request must come from our own origin. */
export function isSameOrigin(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

/** Signed-in user for an API request (writes must be same-origin), or null. */
export async function getRequestUser(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !isSameOrigin(request)) return null;
  return userFromToken(token);
}

const digest = (value) => createHash('sha256').update(value).digest();

function hasValidApiKey(request) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || expected.length < 32) return false; // fail closed
  const [scheme, token] = (request.headers.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return false;
  return timingSafeEqual(digest(token), digest(expected)); // constant-time compare
}

/** Admin API authorization: Bearer ADMIN_API_KEY (scripts) OR an admin session. */
export async function authorizeAdminRequest(request) {
  if (hasValidApiKey(request)) return { via: 'api-key' };
  const user = await getRequestUser(request);
  return user?.role === 'admin' ? { via: 'session', admin: user } : null;
}
