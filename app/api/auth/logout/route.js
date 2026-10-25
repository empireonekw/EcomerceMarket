import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { clearSessionCookies, getRequestUser } from '@/lib/auth';
import User from '@/models/User';

/**
 * POST /api/auth/logout            — clears this browser's session.
 * POST /api/auth/logout?all=1      — also revokes every other session (bumps tokenVersion).
 *
 * Works from fetch() (JSON response) and from a plain <form method="post"> (303 → homepage).
 */
export async function POST(request) {
  if (request.nextUrl.searchParams.get('all') === '1') {
    const user = await getRequestUser(request); // same-origin enforced
    if (user) {
      await connectDB();
      await User.updateOne({ _id: user.id }, { $inc: { tokenVersion: 1 } });
    }
  }

  const wantsJson = request.headers.get('accept')?.includes('application/json');
  // Relative Location on purpose: behind nginx, request.url is the internal address (http://localhost:4810),
  // so an absolute redirect built from it would send the browser there instead of to the public domain.
  const res = wantsJson
    ? NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    : new NextResponse(null, { status: 303, headers: { Location: '/', 'Cache-Control': 'no-store' } });
  clearSessionCookies(res);
  return res;
}
