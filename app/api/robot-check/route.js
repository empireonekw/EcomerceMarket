import { NextResponse } from 'next/server';
import { isSameOrigin } from '@/lib/auth';
import { verifyCaptcha } from '@/lib/captcha';
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit';
import { createHumanPass, HUMAN_COOKIE, PASS_TTL_SECONDS, safeNext } from '@/lib/robot-check';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * POST /api/robot-check — { captchaToken, next } from /verify. A ticked "I'm not a robot" box gives this browser a
 * signed human pass for its IP (lib/robot-check.js) and a fresh rate-limit budget; returns { next } to go back to.
 */
export async function POST(request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: noStore });
  const ip = clientIp(request);
  // proxy.js lets this route through for flagged IPs, so it carries its own limit.
  const limit = rateLimit(`robot-check:${ip}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429, headers: { ...noStore, 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: noStore });
  }
  const captcha = await verifyCaptcha(body?.captchaToken, ip);
  if (!captcha.ok) return NextResponse.json({ error: captcha.error }, { status: 400, headers: noStore });

  // A fresh minute for this visitor on every tier (keys are global:<tier>:<ip>, see proxy.js).
  for (const tier of ['auth', 'apiWrite', 'apiRead', 'page']) resetRateLimit(`global:${tier}:${ip}`);
  const res = NextResponse.json({ next: safeNext(body?.next) }, { headers: noStore });
  res.cookies.set(HUMAN_COOKIE, createHumanPass(ip), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: PASS_TTL_SECONDS,
  });
  return res;
}
