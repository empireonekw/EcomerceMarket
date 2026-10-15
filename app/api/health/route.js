import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

/** GET /api/health — uptime check that also pings MongoDB. */
export async function GET() {
  const started = Date.now();
  try {
    await connectDB();
    await mongoose.connection.db.command({ ping: 1 });
    return NextResponse.json({ status: 'ok', db: 'connected', latencyMs: Date.now() - started });
  } catch (err) {
    console.error('[GET /api/health]', err);
    return NextResponse.json({ status: 'error', db: 'unreachable' }, { status: 503 });
  }
}
