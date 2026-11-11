import { isSameOrigin } from '@/lib/auth';
import { errorResponse, forbidden, json, readJson, tooMany } from '@/lib/api';
import { verifyCaptcha } from '@/lib/captcha';
import { clientIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/validation';
import { resetPasswordWithCode, sendPasswordResetCode } from '@/lib/data/password-reset';

/**
 * "Forgot password" (lib/data/password-reset.js), signed out:
 *   POST { email, captchaToken } → emails a 6-digit code → { sent, resendIn } (the same answer whether or not the
 *        email has an account)
 *   PUT  { email, code, password } → sets the new password and ends every session → { reset: true }
 * Limited per IP and per email on top of the site-wide limits, so it can't be used to flood someone's inbox or guess codes.
 */
export async function POST(request) {
  if (!isSameOrigin(request)) return forbidden('Invalid origin');
  const ip = clientIp(request);
  const slowIp = tooMany(`reset-send:ip:${ip}`, 10, 60 * 60_000, 'Too many reset requests. Please try again in an hour.');
  if (slowIp) return slowIp;
  try {
    const { email, captchaToken } = await readJson(request, 8 * 1024);
    const slowEmail = tooMany(
      `reset-send:email:${normalizeEmail(email)}`,
      5,
      60 * 60_000,
      'Too many codes sent to this email. Please try again in an hour.',
    );
    if (slowEmail) return slowEmail;
    const captcha = await verifyCaptcha(captchaToken, ip);
    if (!captcha.ok) return json({ error: captcha.error, fields: { captcha: captcha.error } }, 400);
    return json(await sendPasswordResetCode(email));
  } catch (err) {
    return errorResponse(err, 'POST /api/auth/password-reset');
  }
}

export async function PUT(request) {
  if (!isSameOrigin(request)) return forbidden('Invalid origin');
  const slowIp = tooMany(`reset-check:ip:${clientIp(request)}`, 30, 15 * 60_000, 'Too many tries. Please wait a few minutes.');
  if (slowIp) return slowIp;
  try {
    const { email, code, password } = await readJson(request, 4 * 1024);
    const slowEmail = tooMany(`reset-check:email:${normalizeEmail(email)}`, 10, 15 * 60_000, 'Too many tries. Please wait a few minutes.');
    if (slowEmail) return slowEmail;
    return json(await resetPasswordWithCode({ email, code, password }));
  } catch (err) {
    return errorResponse(err, 'PUT /api/auth/password-reset');
  }
}
