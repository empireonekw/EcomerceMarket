import { json, unauthorized, readJson, errorResponse } from '@/lib/api';
import { createSellerProduct } from '@/lib/data/seller';
import { InputError } from '@/lib/data/product-writes';
import { LISTING_LIMITS, UPLOAD_RULES } from '@/lib/listing';
import { rateLimit } from '@/lib/rate-limit';
import { rankkwSeller, readFileToken } from '@/lib/rankkw-link';
import { refreshStorefront } from '@/lib/revalidate';
import { siteConfig } from '@/lib/site';
import { deleteStoredUploads, photoExtension, storeServerUpload } from '@/lib/uploads';

/**
 * POST /api/integrations/rankkw/products (Bearer) — a listing in the seller's shop from one of their Etsy listings.
 * Body: the seller listing fields (lib/listing.js validateListing), except
 *   images: Etsy photo URLs (https://i.etsystatic.com/…): copied here as the listing's photos, in order;
 *   files:  `file` tokens from ../upload (the files buyers get).
 * `draft: true` saves a draft (only a title needed). Otherwise it is submitted like the listing form: live at once
 * with auto-approve on, else in review. Returns { id, slug, status, url, editUrl, photos }.
 */
export async function POST(request) {
  const seller = await rankkwSeller(request);
  if (!seller) return unauthorized('Not connected.');
  if (!rateLimit(`rankkw-products:${seller.id}`, { limit: 60, windowMs: 60 * 60 * 1000 }).ok) {
    return json({ error: 'Too many listings in a short time. Please try again in a while.' }, 429);
  }

  let photos = [];
  try {
    const body = await readJson(request, 96 * 1024);
    const sources = (Array.isArray(body.images) ? body.images : []).slice(0, LISTING_LIMITS.photos);
    if (sources.some((u) => !isEtsyImage(u))) throw new InputError('Please fix the highlighted fields.', { images: 'Photos must be Etsy listing photos.' });
    const files = (Array.isArray(body.files) ? body.files : []).map((t) => readFileToken(t, seller.id));
    if (files.some((f) => !f)) throw new InputError('Please fix the highlighted fields.', { files: 'An uploaded file expired. Please upload it again.' });

    photos = await copyPhotos(sources);
    const draft = body.draft === true;
    if (!draft && sources.length && !photos.length) throw new InputError('Please fix the highlighted fields.', { images: 'The photos could not be copied from Etsy. Please try again.' });

    const product = await createSellerProduct(
      seller.id,
      {
        ...pick(body, ['title', 'description', 'shortDescription', 'tags', 'price', 'category', 'madeBy', 'itemType', 'madeWhen', 'license', 'rightsConfirmed', 'fileFormat']),
        images: photos.map((p) => p.url),
        deliveryType: 'file',
        files: files.map((f) => ({ ...f, uploadedAt: new Date() })),
      },
      { draft },
    );
    if (product.status === 'approved') refreshStorefront(product.slug);
    return json(
      {
        id: String(product._id),
        slug: product.slug,
        status: product.status,
        url: `${siteConfig.url}/products/${product.slug}`,
        editUrl: `${siteConfig.url}/seller/listings/${product._id}/edit`,
        photos: photos.length,
      },
      201,
    );
  } catch (err) {
    if (photos.length) await deleteStoredUploads(photos.map((p) => p.url));
    return errorResponse(err, 'POST /api/integrations/rankkw/products');
  }
}

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));

function isEtsyImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'i.etsystatic.com' || url.hostname.endsWith('.etsystatic.com'));
  } catch {
    return false;
  }
}

/** Downloads Etsy photos (four at a time) and stores them as uploads, in order. A photo that fails is skipped. */
async function copyPhotos(urls) {
  const out = new Array(urls.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const i = next++;
      try {
        const res = await fetch(urls[i], { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) continue;
        if (Number(res.headers.get('content-length')) > UPLOAD_RULES.photo.maxBytes) continue;
        const bytes = Buffer.from(await res.arrayBuffer());
        const ext = photoExtension(bytes);
        if (!ext) continue;
        out[i] = await storeServerUpload('photo', `etsy-photo-${i + 1}.${ext}`, bytes);
      } catch (err) {
        console.error('[rankkw] photo copy failed', urls[i], err?.message);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker));
  return out.filter(Boolean);
}
