import { indexNowKey } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

/** GET /indexnow-key.txt: the IndexNow key (lib/indexnow.js), so search engines can check pings really come from us. */
export function GET() {
  const key = indexNowKey();
  if (!key) return new Response('Not found', { status: 404 });
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
