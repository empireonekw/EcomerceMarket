import 'server-only';

/**
 * Google reCAPTCHA v2 ("I'm not a robot") verification for sign-in and sign-up (components/auth/Recaptcha.jsx).
 *
 * Keys from https://www.google.com/recaptcha/admin (type: v2 Checkbox, domains: sellpify.com + localhost):
 *   NEXT_PUBLIC_RECAPTCHA_SITE_KEY  shown in the page
 *   RECAPTCHA_SECRET_KEY            server only
 * Without a secret the check is off (local development); on the live site that's logged as a warning.
 * A token is single-use and expires after 2 minutes. If Google can't be reached the check fails (fail closed).
 */

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
let warned = false;

export const captchaEnabled = () => Boolean(process.env.RECAPTCHA_SECRET_KEY);

/** { ok: true } or { ok: false, error } — `error` is safe to show in the form. */
export async function verifyCaptcha(token, ip) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' && !warned) {
      warned = true;
      console.warn('[captcha] RECAPTCHA_SECRET_KEY is not set — sign-in and sign-up are NOT protected by reCAPTCHA.');
    }
    return { ok: true };
  }
  if (typeof token !== 'string' || !token || token.length > 4000) {
    return { ok: false, error: 'Please confirm you’re not a robot.' };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'local') body.set('remoteip', ip);

  // A new connection to Google sometimes stalls for 10 s+ and then resets while the next one answers in < 1 s, so
  // each try gets a short timeout and a stalled one is retried on a fresh connection (at most ~10 s in all).
  let lastError;
  for (const timeoutMs of [3000, 3000, 4000]) {
    try {
      const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
      if (res.status >= 500) throw new Error(`Google answered ${res.status}`);
      const data = await res.json();
      if (data.success) return { ok: true };
      const expired = data['error-codes']?.includes('timeout-or-duplicate');
      return { ok: false, error: expired ? 'The robot check expired. Please tick the box again.' : 'Please confirm you’re not a robot.' };
    } catch (err) {
      lastError = err;
    }
  }
  console.error('[captcha] verification request failed', lastError?.cause?.code ?? lastError?.message);
  return { ok: false, error: 'We couldn’t check the “I’m not a robot” box. Please try again.' };
}
