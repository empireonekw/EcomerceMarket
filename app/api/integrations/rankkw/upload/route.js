import { NextResponse } from 'next/server';
import { InputError } from '@/lib/data/product-writes';
import { UPLOAD_RULES } from '@/lib/listing';
import { corsHeaders, createFileToken, readUploadTicket } from '@/lib/rankkw-link';
import { storeServerUpload } from '@/lib/uploads';

/**
 * PUT /api/integrations/rankkw/upload?ticket=… — raw file body, from the seller's browser on Rankkw (CORS: Rankkw's
 * origins only). The ticket (../upload-ticket) fixes the seller, file name and size. The file gets the same checks as
 * the listing form's uploads. Returns { file, name, size }: `file` is what Rankkw sends with the listing (../products).
 */
export function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function PUT(request) {
  const cors = corsHeaders(request);
  const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
  const ticket = readUploadTicket(request.nextUrl.searchParams.get('ticket'));
  if (!ticket) return reply({ error: 'The upload link expired. Please try again.' }, 401);
  if (!request.body) return reply({ error: 'The file is empty.' }, 400);

  try {
    const bytes = await readCapped(request.body, Math.min(ticket.size, UPLOAD_RULES.source.maxBytes));
    if (bytes.length !== ticket.size) return reply({ error: 'The upload didn’t finish. Please try again.' }, 400);
    const saved = await storeServerUpload('source', ticket.name, bytes);
    return reply({ file: createFileToken(ticket.sellerId, saved), name: saved.name, size: saved.size }, 201);
  } catch (err) {
    if (err instanceof InputError) return reply({ error: err.message }, err.status);
    console.error('[PUT /api/integrations/rankkw/upload]', err);
    return reply({ error: 'The upload failed. Please try again.' }, 500);
  }
}

/** The whole body, refusing anything past `max` bytes. */
async function readCapped(body, max) {
  const chunks = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.length;
    if (total > max) throw new InputError('That file is larger than expected.', {}, 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
