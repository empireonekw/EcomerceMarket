import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { connectDB } from '@/lib/mongodb';
import { mailerEnabled, sendEmail } from '@/lib/mailer';
import { verificationCodeEmail } from '@/lib/emails/verification-code';
import { InputError } from '@/lib/data/product-writes';
import User from '@/models/User';

// Email verification with a 6-digit code (Account settings, checkout and "Sell on Sellpify" show the form,
// components/EmailVerification.jsx). Only a hash of the code is stored; it expires, allows a few wrong tries, and a new
// one can be sent once a minute.

export const RESEND_AFTER_SECONDS = 60;
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const hashCode = (userId, code) => createHmac('sha256', process.env.AUTH_SECRET).update(`${userId}:${code}`).digest('hex');

/** Emails a new code to the signed-in user. Returns { sent: true, resendIn } (seconds until the next one may be sent). */
export async function sendVerificationCode(userId) {
  await connectDB();
  const user = await User.findById(userId).select('name email emailVerifiedAt +emailOtp');
  if (!user) throw new InputError('Account not found.', {}, 404);
  if (user.emailVerifiedAt) return { verified: true };

  const wait = user.emailOtp?.sentAt ? Math.ceil((user.emailOtp.sentAt.getTime() + RESEND_AFTER_SECONDS * 1000 - Date.now()) / 1000) : 0;
  if (wait > 0) throw new InputError(`Please wait ${wait} seconds before asking for a new code.`, { resendIn: wait }, 429);

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  const otp = { hash: hashCode(user._id, code), sentAt: now, expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000), attempts: 0 };
  await User.updateOne({ _id: user._id }, { $set: { emailOtp: otp } }); // a new code replaces the old one
  if (mailerEnabled()) {
    try {
      await sendEmail({ to: user.email, ...verificationCodeEmail({ name: user.name, code, minutes: CODE_MINUTES }) });
    } catch (err) {
      await User.updateOne({ _id: user._id }, { $unset: { emailOtp: 1 } }); // not sent: let them try again straight away
      console.error('[email-verification] sending failed:', err.message);
      throw new InputError('We couldn’t send the email. Please try again in a moment.', {}, 502);
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.log(`[email-verification] Email isn't set up (EMAIL_USER / EMAIL_APP_PASSWORD). Code for ${user.email}: ${code}`);
  } else {
    await User.updateOne({ _id: user._id }, { $unset: { emailOtp: 1 } });
    throw new InputError('We can’t send emails right now. Please try again later.', {}, 503);
  }
  return { sent: true, resendIn: RESEND_AFTER_SECONDS };
}

/** Checks the code the user typed; on a match marks the email verified. Returns { verified: true }. */
export async function confirmVerificationCode(userId, code) {
  const typed = String(code ?? '').replace(/\D/g, '');
  if (typed.length !== 6) throw new InputError('Enter the 6-digit code from the email.', { code: 'Enter the 6-digit code from the email.' });
  await connectDB();
  const user = await User.findById(userId).select('emailVerifiedAt +emailOtp');
  if (!user) throw new InputError('Account not found.', {}, 404);
  if (user.emailVerifiedAt) return { verified: true };

  const otp = user.emailOtp;
  if (!otp?.hash || otp.expiresAt < new Date()) {
    throw new InputError('This code has expired. Send a new one.', { code: 'This code has expired. Send a new one.' }, 410);
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new InputError('Too many wrong codes. Send a new one.', { code: 'Too many wrong codes. Send a new one.' }, 429);
  }
  if (!timingSafeEqual(Buffer.from(otp.hash, 'hex'), Buffer.from(hashCode(user._id, typed), 'hex'))) {
    await User.updateOne({ _id: user._id }, { $inc: { 'emailOtp.attempts': 1 } });
    const left = MAX_ATTEMPTS - otp.attempts - 1;
    const message = left > 0 ? `That code isn’t right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Send a new one.';
    throw new InputError(message, { code: message });
  }
  await User.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: new Date() }, $unset: { emailOtp: 1 } });
  return { verified: true };
}
