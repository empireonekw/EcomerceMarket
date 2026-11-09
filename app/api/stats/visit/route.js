import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { referrerSource, statsDay } from '@/lib/listing-stats';
import { BOT_UA, countryOf, deviceOf, isTrackedPath, sectionOf } from '@/lib/site-stats';
import { siteConfig } from '@/lib/site';
import SiteStat from '@/models/SiteStat';

/**
 * POST /api/stats/visit — { path, referrer?, firstToday?, firstEver? } from components/VisitTracker.jsx on every
 * storefront page view. Adds to today's SiteStat counters (admin dashboard). Anonymous: nothing about the visitor is
 * stored. Bots are skipped and every network is capped, so a refresh loop can't inflate the numbers. Always 204.
 */
export async function POST(request) {
  const done = new NextResponse(null, { status: 204 });
  // Local development runs against the live database (README): developers' own browsing must not count as visitors.
  if (process.env.NODE_ENV !== 'production' && process.env.TRACK_DEV_VISITS !== 'true') return done;
  try {
    const ua = request.headers.get('user-agent') ?? '';
    if (!ua || BOT_UA.test(ua)) return done;
    const body = await request.json();
    const path = String(body?.path ?? '').slice(0, 300);
    if (!path.startsWith('/') || !isTrackedPath(path)) return done;

    // Per network: up to 120 page views an hour, and up to 40 new "visitors" a day (mobile networks share addresses).
    const ip = clientIp(request);
    const local = ip === 'local';
    if (!local && !rateLimit(`visit:${ip}`, { limit: 120, windowMs: 60 * 60_000 }).ok) return done;
    const firstToday = body?.firstToday === true && (local || rateLimit(`visitor:${ip}`, { limit: 40, windowMs: 24 * 60 * 60_000 }).ok);

    const inc = { views: 1, [`sections.${sectionOf(path)}`]: 1 };
    if (firstToday) {
      const hosts = [new URL(siteConfig.url).host, new URL(request.url).host];
      inc.visitors = 1;
      if (body?.firstEver === true) inc.newVisitors = 1;
      inc[`sources.${referrerSource(String(body?.referrer ?? ''), hosts).source}`] = 1;
      inc[`devices.${deviceOf(ua)}`] = 1;
      inc[`countries.${countryOf(request.headers.get('cf-ipcountry'))}`] = 1;
    }
    await connectDB();
    await SiteStat.updateOne({ day: statsDay() }, { $inc: inc }, { upsert: true });
  } catch (err) {
    console.error('[stats/visit] not recorded:', err?.message ?? err);
  }
  return done;
}
