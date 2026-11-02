// "Verify you're not a robot" for visitors who flood the site. No 'server-only' import: proxy.js uses this too.
//
// When an IP goes over a site-wide rate limit (proxy.js), it is flagged for FLAG_MS. While flagged, its pages redirect
// to /verify and its API calls get 429 { code: 'robot_check' } (components/RobotCheckRedirect.jsx sends the browser to
// /verify too). Ticking the reCAPTCHA box there (POST /api/robot-check) gives that browser a signed, httpOnly
// "human pass" cookie for this IP. Going over the limit again re-flags the IP, and passes issued before that stop
// counting, so a script that keeps hammering faces the check again every time.
// Flags live in memory on globalThis (shared by proxy.js and route handlers, like lib/rate-limit.js).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const HUMAN_COOKIE = 'apex_human';
export const VERIFY_PAGE = '/verify';
export const VERIFY_API = '/api/robot-check';
export const ROBOT_CHECK_HEADER = 'x-robot-check';

const FLAG_MS = 30 * 60_000; // how long a flagged IP must verify before it can continue
export const PASS_TTL_SECONDS = 30 * 60; // a pass outlives the flag it answered, so it never runs out mid-visit

const flags = globalThis.__robotFlags ?? new Map(); // ip → { at: last time over the limit, until }
globalThis.__robotFlags = flags;

let passKey;
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be set to a random string of at least 32 characters.');
  // Its own derived key, so a pass can never be confused with a session or download token (lib/tokens.js).
  passKey ??= createHmac('sha256', secret).update('apex:human-pass').digest();
  return passKey;
}
const signature = (ip, issuedAt) => createHmac('sha256', key()).update(`${ip}|${issuedAt}`).digest('base64url');

/** The IP just went over a limit: it must pass the robot check (again) before continuing. */
export function flagIp(ip) {
  const now = Date.now();
  flags.set(ip, { at: now, until: now + FLAG_MS });
  if (flags.size > 10_000) for (const [k, f] of flags) if (f.until <= now) flags.delete(k);
}

/** A pass cookie value for this IP: "<issued ms>.<signature>". */
export function createHumanPass(ip) {
  const issuedAt = Date.now();
  return `${issuedAt}.${signature(ip, issuedAt)}`;
}

function passIssuedAt(value, ip) {
  const [issued, sig] = String(value ?? '').split('.');
  const issuedAt = Number(issued);
  if (!Number.isSafeInteger(issuedAt) || !sig || Date.now() - issuedAt > PASS_TTL_SECONDS * 1000) return null;
  const expected = Buffer.from(signature(ip, issuedAt));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? issuedAt : null;
}

/** True when this IP is flagged and the browser has no pass issued since the IP last went over the limit. */
export function needsRobotCheck(ip, passValue) {
  const flag = flags.get(ip);
  if (!flag) return false;
  if (flag.until <= Date.now()) {
    flags.delete(ip);
    return false;
  }
  const issuedAt = passIssuedAt(passValue, ip);
  return issuedAt == null || issuedAt < flag.at;
}

/** Where to go after verifying: a path on this site only (never "//evil.com" or a full URL). */
export function safeNext(value) {
  const next = String(value ?? '');
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') && !next.startsWith(VERIFY_PAGE) ? next : '/';
}
