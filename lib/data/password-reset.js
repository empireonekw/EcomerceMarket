import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { connectDB } from '@/lib/mongodb';
import { mailerEnabled, sendEmail } from '@/lib/mailer';
import { verificationCodeEmail } from '@/lib/emails/verification-code';
import { InputError } from '@/lib/data/product-writes';
import { isOwnerAdminEmail } from '@/lib/owner-admin';
import { normalizeEmail, validatePassword } from '@/lib/validation';
import User from '@/models/User';

// "Forgot password" (/forgot-password): a 6-digit code is emailed, then the code + a new password set it. Only a hash
// of the code is stored; it expires, allows a few wrong tries, and a new one can be sent once a minute. Every answer
// to "send me a code" looks the same whether the email has an account or not, so the form can't be used to find out
// who is registered. Admin accounts can't be reset here (the owner admin signs in with ADMIN_PASSWORD).

export const RESEND_AFTER_SECONDS = 60;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const WRONG = 'That code isn’t right or has expired. Check the latest email, or send a new code.';

const hashCode = (userId, code) => createHmac('sha256', process.env.AUTH_SECRET).update(`reset:${userId}:${code}`).digest('hex');

/** Emails a reset code if `email` has an account. Always returns { sent: true, resendIn } (seconds). */
export async function sendPasswordResetCode(email) {
  const address = normalizeEmail(email);
  const done = { sent: true, resendIn: RESEND_AFTER_SECONDS };
  if (!address || address.length > 200) throw new InputError('Enter your email address.', { email: 'Enter your email address.' });
  await connectDB();
  const user = await User.findOne({ email: address }).select('name email role blockedAt +passwordResetOtp');
  if (!user || user.role === 'admin' || user.blockedAt || isOwnerAdminEmail(address)) return done;

  // Asked again within the minute: nothing new is sent (the page's timer already says when it can be).
  const sentAt = user.passwordResetOtp?.sentAt?.getTime() ?? 0;
  if (Date.now() - sentAt < RESEND_AFTER_SECONDS * 1000) return done;

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  const otp = { hash: hashCode(user._id, code), sentAt: now, expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000), attempts: 0 };
  await User.updateOne({ _id: user._id }, { $set: { passwordResetOtp: otp } }); // a new code replaces the old one
  if (mailerEnabled()) {
    try {
      await sendEmail({ to: user.email, ...verificationCodeEmail({ name: user.name, code, minutes: CODE_MINUTES, purpose: 'reset' }) });
    } catch (err) {
      await User.updateOne({ _id: user._id }, { $unset: { passwordResetOtp: 1 } }); // not sent: let them try again straight away
      console.error('[password-reset] sending failed:', err.message);
      throw new InputError('We couldn’t send the email. Please try again in a moment.', {}, 502);
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(`[password-reset] Email isn't set up (EMAIL_USER / EMAIL_APP_PASSWORD). Code for ${user.email}: ${code}`);
  } else {
    await User.updateOne({ _id: user._id }, { $unset: { passwordResetOtp: 1 } });
    throw new InputError('We can’t send emails right now. Please try again later.', {}, 503);
  }
  return done;
}

/**
 * Checks the code and sets the new password. Every session ends (tokenVersion), so anyone else who was signed in is
 * signed out; the email also counts as verified, since the code proved they read it. Returns { reset: true }.
 */
export async function resetPasswordWithCode({ email, code, password }) {
  const typed = String(code ?? '').replace(/\D/g, '');
  if (typed.length !== 6) throw new InputError('Enter the 6-digit code from the email.', { code: 'Enter the 6-digit code from the email.' });
  const address = normalizeEmail(email);
  const passwordError = validatePassword(password, { email: address });
  if (passwordError) throw new InputError(passwordError, { password: passwordError });

  await connectDB();
  const user = await User.findOne({ email: address }).select('+password +passwordResetOtp email emailVerifiedAt role tokenVersion blockedAt');
  const otp = user?.passwordResetOtp;
  if (!user || user.role === 'admin' || user.blockedAt || !otp?.hash || otp.expiresAt < new Date()) {
    throw new InputError(WRONG, { code: WRONG });
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    const message = 'Too many wrong codes. Send a new one.';
    throw new InputError(message, { code: message }, 429);
  }
  if (!timingSafeEqual(Buffer.from(otp.hash, 'hex'), Buffer.from(hashCode(user._id, typed), 'hex'))) {
    await User.updateOne({ _id: user._id }, { $inc: { 'passwordResetOtp.attempts': 1 } });
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    const message = left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Send a new one.';
    throw new InputError(message, { code: message });
  }

  user.password = String(password); // hashed by the pre('save') hook (models/User.js)
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // signs out every session
  user.emailVerifiedAt ??= new Date();
  user.passwordResetOtp = undefined;
  await user.save();
  return { reset: true };
}
