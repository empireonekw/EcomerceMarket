import { getRequestUser } from '@/lib/auth';
import { json, unauthorized, forbidden, errorResponse } from '@/lib/api';
import { uploadProblem } from '@/lib/listing';
import { rateLimit } from '@/lib/rate-limit';
import { saveLocalUpload, uploadDriver } from '@/lib/uploads';

/**
 * PUT /api/seller/uploads/local?kind=photo|video|source&name=<file name> — raw file body.
 * Used when Vercel Blob isn't configured: the file is saved on this server (lib/uploads.js), after checking its
 * type, size and file signature. Returns { url, size, name }.
 */
export async function PUT(request) {
  const user = await getRequestUser(request); // same-origin enforced
  if (!user) return unauthorized();
  if (user.role !== 'seller') return forbidden('Seller account required.');
  if (uploadDriver() !== 'local') return json({ error: 'Uploads go to cloud storage on this site.' }, 409);
  if (!rateLimit(`upload:${user.id}`, { limit: 120, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many uploads in a short time. Please try again later.' }, 429);
  }

  const kind = request.nextUrl.searchParams.get('kind');
  const name = (request.nextUrl.searchParams.get('name') ?? '').slice(0, 200);
  const size = Number(request.headers.get('content-length'));
  const problem = uploadProblem(kind, { name, size: Number.isFinite(size) ? size : 1 });
  if (problem) return json({ error: problem }, 400);
  if (!request.body) return json({ error: 'The file is empty.' }, 400);

  try {
    return json(await saveLocalUpload(kind, name, request.body), 201);
  } catch (err) {
    return errorResponse(err, 'PUT /api/seller/uploads/local');
  }
}
