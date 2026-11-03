import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { openIdDocument } from '@/lib/data/seller-onboarding';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };

/** GET /api/seller/onboarding/id-document/front|back — the signed-in user's own uploaded ID, for the wizard preview. */
export async function GET(request, { params }) {
  const user = await getRequestUser(request);
  if (!user) return new NextResponse('Sign in to see this.', { status: 401, headers: PRIVATE });
  const { side } = await params;
  const file = await openIdDocument(user.id, side);
  if (!file) return new NextResponse('Not found.', { status: 404, headers: PRIVATE });
  return new NextResponse(file.stream, {
    headers: {
      ...PRIVATE,
      'Content-Type': file.contentType,
      ...(file.size && { 'Content-Length': String(file.size) }),
      'Content-Disposition': 'inline',
    },
  });
}
