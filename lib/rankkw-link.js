import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { clientIp, isRateLimited, rateLimit } from '@/lib/rate-limit';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { createAccessToken, createSignedToken, hashToken, verifySignedToken } from '@/lib/tokens';
import RankkwLink from '@/models/RankkwLink';
import User from '@/models/User';

// Rankkw (rankkw.com) adds a seller's own Etsy listings to their Sellpify shop.
//
//  1. Rankkw sends the seller to /connect/rankkw?state=…&return=…; they sign in here and approve.
//  2. We redirect back to Rankkw with a 5-minute code (signed, bound to the seller and Rankkw's state).
//  3. Rankkw's server swaps the code for a long-lived token (POST /api/integrations/rankkw/token), proving itself with
//     RANKKW_LINK_SECRET. Only the token's hash is kept here (models/RankkwLink.js).
//  4. Rankkw calls /api/integrations/rankkw/* with "Authorization: Bearer <token>". Files buyers get are uploaded
//     by the seller's browser straight to us with a short-lived ticket, so they never pass through Rankkw.
//
// RANKKW_LINK_SECRET (same value on both sites, at least 32 characters) switches it on; without it every call fails.
// RANKKW_ORIGINS: where Rankkw runs (comma-separated), for the return address and browser uploads.

export const RANKKW_ORIGINS = (process.env.RANKKW_ORIGINS || 'https://rankkw.com,https://www.rankkw.com')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
export const RANKKW_CALLBACK_PATH = '/api/sellpify/callback';

const CODE_TTL = 5 * 60;
const TICKET_TTL = 15 * 60;
const FILE_TTL = 24 * 60 * 60;

export const isRankkwOrigin = (origin) => RANKKW_ORIGINS.includes(String(origin ?? '').replace(/\/+$/, ''));

/** Rankkw's callback on one of RANKKW_ORIGINS (the first one when `origin` isn't allowed). */
export function rankkwCallback(origin) {
  return `${isRankkwOrigin(origin) ? String(origin).replace(/\/+$/, '') : RANKKW_ORIGINS[0]}${RANKKW_CALLBACK_PATH}`;
}

/** Rankkw's server proves itself with the shared secret (constant-time compare; off when the secret isn't set). */
// These routes skip the site-wide per-IP limits (Rankkw's server calls them for every seller, from one IP), so wrong
// secrets and tokens are counted here instead: after BAD_LIMIT failures in BAD_WINDOW an IP is refused without even
// checking, until the window ends. Rankkw's own calls succeed and never count.
const BAD_LIMIT = 20;
const BAD_WINDOW = 10 * 60_000;
const badKey = (request) => `rankkw:bad:${clientIp(request)}`;
const tooManyBad = (request) => isRateLimited(badKey(request), { limit: BAD_LIMIT });
const countBad = (request) => rateLimit(badKey(request), { limit: BAD_LIMIT, windowMs: BAD_WINDOW });

export function isRankkwServer(request) {
  const expected = process.env.RANKKW_LINK_SECRET;
  if (!expected || expected.length < 32 || tooManyBad(request)) return false;
  const given = request.headers.get('x-rankkw-secret') ?? '';
  const digest = (v) => createHash('sha256').update(v).digest();
  const ok = Boolean(given) && timingSafeEqual(digest(given), digest(expected));
  if (!ok) countBad(request);
  return ok;
}

export const createConnectCode = (sellerId, state) => createSignedToken('rkc', { s: String(sellerId), st: String(state) }, CODE_TTL).token;

/**
 * Swaps a connect code for the seller's token (replacing any earlier one). Returns { token, storeName } or null
 * when the code is bad, expired, for another state, or the shop is no longer a working seller shop.
 */
export async function redeemConnectCode(code, state, rankkwUser) {
  const claims = verifySignedToken('rkc', code);
  if (!claims?.s || claims.st !== String(state ?? '') || !mongoose.isValidObjectId(claims.s)) return null;
  await connectDB();
  const seller = await activeSeller(claims.s);
  if (!seller) return null;
  const { token, hash } = createAccessToken();
  await RankkwLink.findOneAndUpdate(
    { seller: seller._id },
    { $set: { tokenHash: hash, rankkwUser: String(rankkwUser ?? '').slice(0, 64), lastUsedAt: new Date() } },
    { upsert: true },
  );
  return { token, storeName: seller.seller.storeName };
}

async function activeSeller(id) {
  const user = await User.findById(id).select('email role blockedAt seller.storeName').lean();
  return user && user.role === 'seller' && !user.blockedAt && user.seller?.storeName ? user : null;
}

/** The seller behind "Authorization: Bearer <token>", or null. { id, email, storeName, linkId } */
export async function rankkwSeller(request) {
  if (tooManyBad(request)) return null; // refused before touching the database
  const [scheme, token] = (request.headers.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token || token.length > 200) {
    countBad(request);
    return null;
  }
  await connectDB();
  const link = await RankkwLink.findOne({ tokenHash: hashToken(token) }).select('seller lastUsedAt').lean();
  if (!link) {
    countBad(request);
    return null;
  }
  const seller = await activeSeller(link.seller);
  if (!seller) return null;
  // At most one write a minute per link.
  if (!link.lastUsedAt || Date.now() - new Date(link.lastUsedAt).getTime() > 60_000) {
    RankkwLink.updateOne({ _id: link._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return { id: String(seller._id), email: seller.email, storeName: seller.seller.storeName, linkId: String(link._id) };
}

export async function removeRankkwLink(linkId) {
  await connectDB();
  await RankkwLink.deleteOne({ _id: linkId });
}

/** One browser upload of a file buyers get, for this seller, with this name and size. */
export const createUploadTicket = (sellerId, name, size) => createSignedToken('rku', { s: sellerId, f: name, z: size }, TICKET_TTL).token;
export const readUploadTicket = (ticket) => {
  const c = verifySignedToken('rku', ticket);
  return c?.s && c.f && Number.isInteger(c.z) ? { sellerId: c.s, name: c.f, size: c.z } : null;
};

/** What the browser gets back for an uploaded file: the seller can attach it to a listing within a day. */
export const createFileToken = (sellerId, { url, name, size }) => createSignedToken('rkf', { s: sellerId, u: url, f: name, z: size }, FILE_TTL).token;
export function readFileToken(token, sellerId) {
  const c = verifySignedToken('rkf', token);
  return c?.s === sellerId && c.u && c.f ? { url: c.u, name: c.f, size: Number(c.z) || 0 } : null;
}

/** CORS for the browser upload: only Rankkw's own pages. */
export function corsHeaders(request) {
  const origin = request.headers.get('origin');
  if (!isRankkwOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
