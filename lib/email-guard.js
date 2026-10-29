import 'server-only';
import { resolve4, resolve6, resolveMx } from 'node:dns/promises';
import { disposableEmailBlocklistSet } from 'disposable-email-domains-js';

/**
 * Sign-up email checks that stop throwaway accounts:
 *  1. disposable / temporary inbox providers (mailinator, 10minutemail, temp-mail, yopmail… ~9,000 domains from the
 *     community-maintained list, including their subdomains), plus BLOCKED_EMAIL_DOMAINS;
 *  2. domains that can't receive email at all (no MX record, a "null MX", or no such domain).
 * ALLOWED_EMAIL_DOMAINS overrides both (e.g. a company domain wrongly listed). DNS problems on our side never block
 * a real sign-up: if the lookup times out or fails, the address is accepted.
 */

const listFromEnv = (name) =>
  new Set(
    String(process.env[name] ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  );

const disposable = disposableEmailBlocklistSet();
const blocked = listFromEnv('BLOCKED_EMAIL_DOMAINS');
const allowed = listFromEnv('ALLOWED_EMAIL_DOMAINS');

/** "a.b.mailinator.com" → ["a.b.mailinator.com", "b.mailinator.com", "mailinator.com"] (never a bare TLD). */
const withParents = (domain) => domain.split('.').slice(0, -1).map((_, i, parts) => domain.split('.').slice(i).join('.'));

export function isDisposableDomain(domain) {
  const d = String(domain ?? '').toLowerCase().replace(/\.$/, '');
  if (withParents(d).some((x) => allowed.has(x))) return false;
  return withParents(d).some((x) => disposable.has(x) || blocked.has(x));
}

const DNS_TIMEOUT_MS = 3000;
const cache = globalThis.__emailDomainCache ?? new Map(); // domain → { ok, at }
globalThis.__emailDomainCache = cache;

const withTimeout = (promise) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), DNS_TIMEOUT_MS))]);
const NO_SUCH = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

/** true / false when DNS gives a clear answer; true (accept) when it can't be checked. */
async function canReceiveMail(domain) {
  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.ok;
  let ok = true;
  try {
    const mx = await withTimeout(resolveMx(domain));
    // RFC 7505 "null MX" (exchange ".") means the domain explicitly accepts no mail.
    ok = mx.some((r) => r.exchange && r.exchange !== '.');
  } catch (err) {
    if (!NO_SUCH.has(err?.code)) return true; // our DNS failed: don't punish the user
    // No MX record: mail falls back to the domain's own address (RFC 5321), so it still counts if it has one.
    const [a, aaaa] = await Promise.allSettled([withTimeout(resolve4(domain)), withTimeout(resolve6(domain))]);
    const found = [a, aaaa].some((r) => r.status === 'fulfilled' && r.value.length);
    const unknown = [a, aaaa].some((r) => r.status === 'rejected' && !NO_SUCH.has(r.reason?.code));
    ok = found || unknown;
  }
  if (cache.size > 5000) cache.clear();
  cache.set(domain, { ok, at: Date.now() });
  return ok;
}

/** An error message for the sign-up email field, or null when it's fine. Run after the format check (lib/validation). */
export async function checkSignupEmail(email) {
  const domain = String(email ?? '').split('@').pop()?.toLowerCase();
  if (!domain) return null;
  if (isDisposableDomain(domain)) return 'Temporary or disposable email addresses can’t be used. Please use your real email.';
  if (allowed.has(domain)) return null;
  if (!(await canReceiveMail(domain))) return 'This email domain can’t receive email. Please check the address.';
  return null;
}
