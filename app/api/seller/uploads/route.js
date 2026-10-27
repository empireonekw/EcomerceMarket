import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden } from '@/lib/api';
import { extensionOf, UPLOAD_RULES, ZIP_MIME_ALIASES } from '@/lib/listing';
import { rateLimit } from '@/lib/rate-limit';
import { uploadDriver } from '@/lib/uploads';

/**
 * POST /api/seller/uploads — Vercel Blob client-upload handshake (lib/upload-client.js → upload()).
 * Issues a short-lived token that only allows one file of the requested kind (photo / video / source),
 * with that kind's file types and size limit; the browser then uploads straight to Blob.
 */
export async function POST(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (uploadDriver() !== 'blob') return json({ error: 'File uploads aren’t set up on this site yet.' }, 409);
  if (!rateLimit(`upload:${user.id}`, { limit: 120, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many uploads in a short time. Please try again later.' }, 429);
  }

  try {
    const body = await request.json();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { kind } = JSON.parse(clientPayload || '{}');
        const rule = UPLOAD_RULES[kind];
        if (!rule) throw new Error('Unknown upload type.');
        if (!pathname.startsWith(`${kind}/`) || !rule.types[extensionOf(pathname)]) throw new Error(`Only ${rule.label} files can be uploaded here.`);
        const types = new Set(Object.values(rule.types));
        if (kind === 'source') ZIP_MIME_ALIASES.forEach((t) => types.add(t));
        return {
          allowedContentTypes: [...types],
          maximumSizeInBytes: rule.maxBytes,
          addRandomSuffix: true, // unguessable URLs
          tokenPayload: JSON.stringify({ sellerId: user.id, kind }),
        };
      },
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return json({ error: err.message || 'Upload refused.' }, 400);
  }
}
