import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { openIdDocument } from '@/lib/data/seller-verification';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };

/** GET /api/admin/users/:id/id-document/front|back|selfie — a seller's ID card or live selfie, for the admin verifying it. Admins only. */
export async function GET(request, { params }) {
  const admin = await getRequestUser(request);
  if (admin?.role !== 'admin') return new NextResponse('Admin access required.', { status: admin ? 403 : 401, headers: PRIVATE });
  const { id, side } = await params;
  const file = await openIdDocument(id, side);
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
