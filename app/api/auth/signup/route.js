import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { publicUser, isSameOrigin } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { validateName, validateEmail, validatePassword, normalizeEmail } from '@/lib/validation';
import User from '@/models/User';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * POST /api/auth/signup — { name, email, password, acceptTerms, accountType? } → creates the account.
 * No session is started: the client sends the new user to /login (email prefilled) to sign in.
 *   accountType 'seller'   → seller account (from /sell/signup); shop setup happens after first login.
 *   anything else          → customer.
 * Admins are never created here — only via `npm run create-admin`.
 */
export async function POST(request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: noStore });

  const limit = rateLimit(`signup:${clientIp(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many accounts created from this network. Please try again later.' },
      { status: 429, headers: { ...noStore, 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  }

  const name = String(body?.name ?? '').trim();
  const email = normalizeEmail(body?.email);
  const password = String(body?.password ?? '');
  const fields = Object.fromEntries(
    Object.entries({
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password, { email }),
      acceptTerms: body?.acceptTerms === true ? null : 'Please accept the Terms of Service and Privacy Policy.',
    }).filter(([, v]) => v),
  );
  if (Object.keys(fields).length) {
    return NextResponse.json({ error: 'Please fix the highlighted fields.', fields }, { status: 400, headers: noStore });
  }

  try {
    await connectDB();
    // Password is hashed with bcrypt (cost 12) by the User model's pre('save') hook.
    const isSeller = body?.accountType === 'seller';
    const user = await User.create({
      name,
      email,
      password,
      role: isSeller ? 'seller' : 'customer',
      termsAcceptedAt: new Date(),
      ...(isSeller && { seller: { totalEarnings: 0, pendingPayout: 0, paidPayout: 0, joinedAt: new Date() } }),
    });
    return NextResponse.json({ user: publicUser(user) }, { status: 201, headers: noStore });
  } catch (err) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { error: 'An account with this email already exists.', fields: { email: 'This email is already registered — try logging in.' } },
        { status: 409, headers: noStore },
      );
    }
    console.error('[POST /api/auth/signup]', err);
    return NextResponse.json({ error: 'Could not create your account. Please try again.' }, { status: 500, headers: noStore });
  }
}
