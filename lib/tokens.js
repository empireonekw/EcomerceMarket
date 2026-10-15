import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DOWNLOAD_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h; receipts mint fresh tokens on every view

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set to a random string of at least 32 characters.');
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// One derived key per purpose (sessions vs. download links), so a token minted
// for one purpose can never verify as another, whatever its shape.
const keys = new Map();
const keyFor = (purpose) => {
  if (!keys.has(purpose)) keys.set(purpose, createHmac('sha256', secret()).update(`apex:${purpose}`).digest());
  return keys.get(purpose);
};
const sign = (data, purpose = 'signed-token') => createHmac('sha256', keyFor(purpose)).update(data).digest();

function safeEqual(a, b) {
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Session JWTs (RFC 7519, HS256). The header is pinned to exactly {"alg":"HS256","typ":"JWT"},
// which rules out `alg: none` and algorithm-confusion attacks.
// ---------------------------------------------------------------------------

const JWT_HEADER = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
const JWT_ISSUER = 'apex-digital-goods';

export function signJwt(claims, ttlSeconds) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload = b64url(JSON.stringify({ ...claims, iss: JWT_ISSUER, iat, exp, jti: b64url(randomBytes(9)) }));
  const data = `${JWT_HEADER}.${payload}`;
  return { token: `${data}.${b64url(sign(data, 'jwt'))}`, expiresAt: new Date(exp * 1000) };
}

/** Returns the claims, or null if malformed, tampered with, expired, or not ours. */
export function verifyJwt(token) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== JWT_HEADER) return null;
  if (!safeEqual(Buffer.from(parts[2], 'base64url'), sign(`${parts[0]}.${parts[1]}`, 'jwt'))) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (claims.iss !== JWT_ISSUER || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Signed tokens: base64url(JSON payload) "." base64url(HMAC-SHA256(payload))
// Every token carries a `t` (type) claim, so a download token can never be
// replayed as a session token or vice versa.
// ---------------------------------------------------------------------------

export function createSignedToken(type, claims, ttlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64url(JSON.stringify({ ...claims, t: type, e: exp, n: b64url(randomBytes(6)) }));
  return { token: `${payload}.${b64url(sign(payload))}`, expiresAt: new Date(exp * 1000) };
}

/** Returns the claims, or null if malformed, tampered with, expired, or of another type. */
export function verifySignedToken(type, token) {
  if (typeof token !== 'string' || token.length > 1024) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (!safeEqual(Buffer.from(signature, 'base64url'), sign(payload))) return null;

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (claims.t !== type || typeof claims.e !== 'number' || claims.e * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Download tokens: stateless, unique per (order, product), expiring.
// The download route still re-checks the order (status, limits) on every use,
// so refunds/revocations apply immediately even to unexpired tokens.
// ---------------------------------------------------------------------------

export function createDownloadToken({ orderId, productId, ttlSeconds = DOWNLOAD_TOKEN_TTL_SECONDS }) {
  return createSignedToken('dl', { o: String(orderId), p: String(productId) }, ttlSeconds);
}

export function verifyDownloadToken(token) {
  const claims = verifySignedToken('dl', token);
  return claims?.o && claims?.p ? { orderId: claims.o, productId: claims.p } : null;
}

// ---------------------------------------------------------------------------
// Order access tokens: random secret shown once (receipt URL); only its hash is stored.
// ---------------------------------------------------------------------------

export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');

export function createAccessToken() {
  const token = b64url(randomBytes(32));
  return { token, hash: hashToken(token) };
}

export function accessTokenMatches(token, storedHash) {
  if (typeof token !== 'string' || !storedHash) return false;
  return safeEqual(Buffer.from(hashToken(token), 'hex'), Buffer.from(storedHash, 'hex'));
}
