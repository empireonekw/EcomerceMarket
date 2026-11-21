import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/auth';
import { openListingFile } from '@/lib/data/product-moderation';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff' };

/**
 * GET /api/admin/products/:id/files/:index — a listing's uploaded file, so an admin can check it isn't fake.
 * Opens in the browser (PDFs, pictures, text); add ?download=1 to save it instead. Admins only.
 */
export async function GET(request, { params }) {
  const admin = await getRequestUser(request);
  if (admin?.role !== 'admin') return new NextResponse('Admin access required.', { status: admin ? 403 : 401, headers: PRIVATE });

  const { id, index } = await params;
  const file = await openListingFile(id, Number(index));
  if (!file) return new NextResponse('File not found.', { status: 404, headers: PRIVATE });
  // The listing exists but its file isn't on this server: usually it was uploaded on the live site and you're on localhost.
  if (file.type === 'unavailable') {
    return new NextResponse('This file isn’t stored on this server. If it was uploaded on the live site, open it from the live admin panel.', {
      status: 404,
      headers: { ...PRIVATE, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  if (file.type === 'redirect') return NextResponse.redirect(file.url, { status: 302, headers: PRIVATE }); // an access link

  const filename = file.filename;
  const ascii = filename.replace(/[^\x20-\x7e]|["\\]/g, '_'); // plain-ASCII fallback for old browsers
  const mode = request.nextUrl.searchParams.get('download') ? 'attachment' : 'inline';
  return new NextResponse(file.type === 'stream' ? file.stream : file.body, {
    headers: {
      ...PRIVATE,
      'Content-Type': file.contentType ?? 'text/plain; charset=utf-8',
      ...(file.size && { 'Content-Length': String(file.size) }),
      'Content-Disposition': `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
