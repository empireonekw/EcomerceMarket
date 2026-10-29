import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { setSessionCookies, publicUser, isSameOrigin } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/validation';
import { ensureOwnerAdmin, isOwnerAdminEmail } from '@/lib/owner-admin';
import User from '@/models/User';

const noStore = { 'Cache-Control': 'no-store' };
const tooMany = (retryAfterMs) =>
  NextResponse.json(
    { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
    { status: 429, headers: { ...noStore, 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
  );

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
// Same cost factor as real hashes (models/User.js); generated once per server process.
let dummyHash;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('not-a-real-password', 12));

/** POST /api/auth/login — { email, password } → sets an httpOnly JWT session cookie (customers and admins). */
export async function POST(request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: noStore });

  const perIp = rateLimit(`login:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!perIp.ok) return tooMany(perIp.retryAfterMs);

  let email, password;
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  }
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || password.length > 200) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400, headers: noStore });
  }
  email = normalizeEmail(email);

  // Second limit per target account: x-forwarded-for can be spoofed when not behind a trusted proxy,
  // so rotating IPs must not allow unlimited guesses against one email.
  const perAccount = rateLimit(`login:acct:${email}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!perAccount.ok) return tooMany(perAccount.retryAfterMs);

  try {
    await connectDB();
    // The owner admin signs in with ADMIN_PASSWORD, which also restores the account if it was removed (lib/owner-admin.js).
    const owner = isOwnerAdminEmail(email) ? await ensureOwnerAdmin(password) : null;
    const user = owner ?? (await User.findOne({ email }).select('+password name email role createdAt tokenVersion seller.storeName'));
    const valid = Boolean(owner) || (await bcrypt.compare(password, user?.password ?? (await getDummyHash())));

    // One generic message for every failure mode, so the form never reveals which emails exist.
    if (!user || !valid) {
      return NextResponse.json({ error: 'Incorrect email or password.' }, { status: 401, headers: noStore });
    }

    User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).catch(() => {});
    const res = NextResponse.json({ user: publicUser(user) }, { headers: noStore });
    setSessionCookies(res, user);
    return res;
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json({ error: 'Sign-in is temporarily unavailable.' }, { status: 500, headers: noStore });
  }
}
