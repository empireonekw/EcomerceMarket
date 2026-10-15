import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import { getRequestUser, setSessionCookies, clearSessionCookies, publicUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { validateName, validatePassword } from '@/lib/validation';
import User from '@/models/User';

const noStore = { 'Cache-Control': 'private, no-store' };

/** GET /api/auth/me — current user + active session details, or 401 { user: null }. */
export async function GET(request) {
  const user = await getRequestUser(request);
  if (!user) {
    const res = NextResponse.json({ user: null }, { status: 401, headers: noStore });
    clearSessionCookies(res); // drop stale/expired cookies so the client stops asking
    return res;
  }
  const { session, ...profile } = user;
  return NextResponse.json({ user: profile, session }, { headers: noStore });
}

/**
 * PATCH /api/auth/me — update profile.
 *   { name }                                  → rename
 *   { currentPassword, newPassword }          → change password; signs out all OTHER sessions
 */
export async function PATCH(request) {
  const current = await getRequestUser(request); // same-origin enforced for writes
  if (!current) return NextResponse.json({ error: 'Please log in again.' }, { status: 401, headers: noStore });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  }

  await connectDB();
  const user = await User.findById(current.id).select('+password name email role createdAt tokenVersion');
  if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404, headers: noStore });

  const fields = {};
  let passwordChanged = false;

  if (body.name !== undefined) {
    const err = validateName(body.name);
    if (err) fields.name = err;
    else user.name = String(body.name).trim();
  }

  if (body.newPassword !== undefined) {
    const limit = rateLimit(`pwchange:${user._id}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.ok) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429, headers: noStore });

    if (!body.currentPassword || !(await bcrypt.compare(String(body.currentPassword), user.password))) {
      fields.currentPassword = 'Your current password is incorrect.';
    }
    const err = validatePassword(body.newPassword, { email: user.email });
    if (err) fields.newPassword = err;
    else if (body.newPassword === body.currentPassword) fields.newPassword = 'Choose a password different from your current one.';

    if (!fields.currentPassword && !fields.newPassword) {
      user.password = String(body.newPassword); // re-hashed by the pre('save') hook
      user.tokenVersion = (user.tokenVersion ?? 0) + 1; // revoke every existing session…
      passwordChanged = true;
    }
  }

  if (Object.keys(fields).length) {
    return NextResponse.json({ error: 'Please fix the highlighted fields.', fields }, { status: 400, headers: noStore });
  }

  await user.save();
  const res = NextResponse.json({ user: publicUser(user), passwordChanged }, { headers: noStore });
  if (passwordChanged) setSessionCookies(res, user); // …then re-issue one for this browser only
  return res;
}
