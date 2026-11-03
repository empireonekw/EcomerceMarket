import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { createBlurDataURL } from '@/lib/blur';
import { slugify, toPlain } from '@/lib/utils';
import Product from '@/models/Product';
import Category from '@/models/Category';
import Order from '@/models/Order';
import Review from '@/models/Review';

// Product write operations. Callers (API routes) are responsible for authorization.

/** Fields an admin may set. */
export const ADMIN_FIELDS = [
  'title', 'shortDescription', 'description', 'price', 'compareAtPrice', 'currency', 'tags',
  'coverImage', 'deliveryType', 'downloadUrl', 'files', 'sourceFileName', 'fileFormat', 'fileSize', 'isPublished', 'isFeatured', 'status',
];
/**
 * Fields a seller may set (lib/listing.js validates them first). Ownership, moderation status and featuring in the
 * store are always decided server-side; `isPublished` only takes effect once an admin approves the listing.
 */
export const SELLER_FIELDS = [
  'title', 'shortDescription', 'description', 'price', 'compareAtPrice', 'tags', 'images', 'videos', 'coverImage', 'deliveryType',
  'downloadUrl', 'files', 'sourceFileName', 'fileSize', 'fileFormat', 'madeBy', 'itemType', 'madeWhen', 'license', 'rightsConfirmed',
  'shopFeatured', 'isPublished',
];
// Optional fields that are cleared by sending null or "". Required ones (price, description…) are only optional
// on drafts — schema validation still rejects them missing anywhere else.
const CLEARABLE_FIELDS = new Set([
  'shortDescription', 'compareAtPrice', 'coverImage', 'fileFormat', 'fileSize', 'images', 'videos', 'sourceFileName',
  'price', 'description', 'downloadUrl', 'files', 'madeBy', 'itemType', 'madeWhen', 'license',
]);

export class InputError extends Error {
  constructor(message, fields = {}, status = 400) {
    super(message);
    this.fields = fields;
    this.status = status;
  }
}

/** "My Product" → "my-product", or "my-product-2" / "-3"… when taken (ignoring `excludeId`). */
async function uniqueSlug(base, excludeId) {
  const root = slugify(base) || 'product'; // only [a-z0-9-], so safe to embed in a regex
  const filter = { slug: new RegExp(`^${root}(-[0-9]+)?$`) };
  if (excludeId) filter._id = { $ne: excludeId };
  const taken = await Product.find(filter).select('slug').lean();
  if (!taken.some((p) => p.slug === root)) return root;
  const max = Math.max(1, ...taken.map((p) => Number(p.slug.slice(root.length + 1)) || 1));
  return `${root}-${max + 1}`;
}

/**
 * `value` = a category id (what the forms send), a "main/sub/inner" slug path, or a main category's slug.
 * Returns { id } or { error } — errors are collected, not thrown, so all field errors report together.
 */
async function resolveCategory(value) {
  if (!value) return { error: 'Category is required' };
  const raw = String(value).trim().toLowerCase();
  let category = null;
  if (mongoose.isValidObjectId(raw)) {
    category = await Category.findById(raw).select('_id').lean();
  } else {
    // Walk the path one level at a time: slugs are only unique among siblings.
    let parent = null;
    for (const slug of raw.split('/').filter(Boolean)) {
      category = await Category.findOne({ slug, parent }).select('_id').lean();
      if (!category) break;
      parent = category._id;
    }
  }
  return category ? { id: category._id } : { error: `Unknown category "${value}"` };
}

/** Runs schema validation and merges in pre-collected errors; throws one InputError with every field. */
async function validateAll(doc, extraErrors) {
  const fields = { ...extraErrors };
  try {
    await doc.validate();
  } catch (err) {
    if (!(err instanceof mongoose.Error.ValidationError)) throw err;
    for (const [k, e] of Object.entries(err.errors)) if (k !== 'category' || !fields.category) fields[k] = e.message;
  }
  // The slug is derived from the title, so a missing title already explains a missing slug.
  if (fields.title && fields.slug && !doc.slug) delete fields.slug;
  if (Object.keys(fields).length) throw new InputError('Validation failed', fields);
}

/** Picks whitelisted fields; null/"" on optional fields means "clear it". `pdfFileUrl` is accepted as an alias of downloadUrl. */
function pickWritable(payload, fields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new InputError('Request body must be a JSON object');
  }
  if (payload.pdfFileUrl !== undefined && payload.downloadUrl === undefined) payload = { ...payload, downloadUrl: payload.pdfFileUrl };
  const set = {};
  const unset = [];
  for (const key of fields) {
    if (!(key in payload)) continue;
    const value = payload[key];
    if ((value === null || value === '') && CLEARABLE_FIELDS.has(key)) unset.push(key);
    else if (value !== undefined) set[key] = value;
  }
  if (typeof set.tags === 'string') set.tags = set.tags.split(',');
  // Uploaded files: kept in order with their name, size and upload date; downloadUrl / sourceFileName / fileSize
  // mirror them (first file, its name, the total) for single-file code paths. A link listing has none.
  if (Array.isArray(set.files)) {
    set.files = set.files.map((f) => ({ url: f?.url, name: f?.name, size: f?.size, uploadedAt: f?.uploadedAt }));
    if (set.files.length) {
      set.downloadUrl = set.files[0].url;
      set.sourceFileName = set.files[0].name;
      set.fileSize = set.files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
    } else {
      delete set.files;
      unset.push('files');
    }
  }
  if (set.deliveryType === 'external' && !unset.includes('files')) {
    delete set.files;
    unset.push('files', 'sourceFileName', 'fileSize');
  }
  return { set, unset };
}

function toInputError(err, slug) {
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    const errors = err.errors ?? { [err.path]: err };
    // "files.0.url" → "files": the forms show one message for the whole file list.
    return new InputError('Validation failed', Object.fromEntries(Object.entries(errors).map(([k, e]) => [k.startsWith('files.') ? 'files' : k, e.message])));
  }
  if (err?.code === 11000) return new InputError('That slug is already taken, please choose another', { slug }, 409);
  return err;
}

const publicView = (doc) => {
  const obj = doc.toObject();
  delete obj.downloadUrl; // never echo the private delivery location
  delete obj.files;
  return toPlain(obj);
};

/** Upload URLs a product already has (photos, videos, files), so edits only re-check the upload limit for new ones. */
export async function savedUploads(productId) {
  if (!mongoose.isValidObjectId(productId)) return [];
  await connectDB();
  const p = await Product.findById(productId).select('images videos coverImage +downloadUrl +files').lean();
  return p ? [p.coverImage, ...(p.images ?? []), ...(p.videos ?? []), p.downloadUrl, ...(p.files ?? []).map((f) => f.url)].filter(Boolean) : [];
}

/**
 * Creates a product from an untrusted payload.
 * - Only whitelisted `fields` are read (no salesCount injection). `overrides` are trusted server-side values,
 *   e.g. sellerId + status 'pending' for seller uploads. `category` = slug or ObjectId; prices in cents.
 * - Slug from `slug` (when allowed) or the title, de-duplicated.
 * - Blur placeholder generated once here, not at render time.
 */
export async function createProduct(payload, { fields = ADMIN_FIELDS, overrides = {}, allowCustomSlug = true } = {}) {
  const { set: picked } = pickWritable(payload, fields);
  const data = { ...picked, ...overrides };
  await connectDB();

  const errors = {};
  // A draft may not have a category yet; anything else must.
  if (payload.category || data.status !== 'draft') {
    const category = await resolveCategory(payload.category);
    if (category.error) errors.category = category.error;
    else data.category = category.id;
  }

  const slugSource = allowCustomSlug && typeof payload.slug === 'string' && payload.slug ? payload.slug : data.title;
  if (typeof slugSource === 'string' && slugSource.trim()) data.slug = await uniqueSlug(slugSource);

  const product = new Product(data);
  await validateAll(product, errors);

  if (data.coverImage) product.coverBlurDataURL = (await createBlurDataURL(data.coverImage)) ?? undefined;
  try {
    return publicView(await product.save());
  } catch (err) {
    throw toInputError(err, data.slug);
  }
}

/**
 * Partially updates a product. The slug only changes when `slug` is sent explicitly,
 * so editing a title never breaks existing links. Returns { product, previousSlug }.
 */
/**
 * Updates a product. Admin by default; sellers pass `{ fields: SELLER_FIELDS, ownerId, allowCustomSlug: false,
 * overrides: { status: 'pending' } }` so they can only touch their own listing and every edit is re-reviewed.
 */
export async function updateProduct(id, payload, { fields = ADMIN_FIELDS, ownerId, allowCustomSlug = true, overrides = {} } = {}) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('Product not found', {}, 404);
  const { set, unset } = pickWritable(payload, fields);

  await connectDB();
  const product = await Product.findOne(ownerId ? { _id: id, sellerId: ownerId } : { _id: id }).select('+downloadUrl');
  if (!product) throw new InputError('Product not found', {}, 404);
  const previousSlug = product.slug;

  const errors = {};
  if ('category' in payload) {
    if (!payload.category && overrides.status === 'draft') {
      unset.push('category'); // drafts may drop the category again
    } else {
      const category = await resolveCategory(payload.category);
      if (category.error) errors.category = category.error;
      else set.category = category.id;
    }
  }
  // An admin changing the cover of a listing with photos replaces its first photo, so the two never disagree.
  if ('coverImage' in set && !('images' in set) && product.images?.length) set.images = [set.coverImage, ...product.images.slice(1)];
  if (allowCustomSlug && typeof payload.slug === 'string' && slugify(payload.slug) !== product.slug) {
    set.slug = await uniqueSlug(payload.slug, product._id);
  }

  const coverChanged = 'coverImage' in set && set.coverImage !== product.coverImage;
  product.set({ ...set, ...overrides });
  for (const key of unset) product.set(key, undefined);
  await validateAll(product, errors); // report every invalid field at once, before any slow work

  if (unset.includes('coverImage')) product.set('coverBlurDataURL', undefined);
  if (coverChanged) product.set('coverBlurDataURL', (await createBlurDataURL(set.coverImage)) ?? undefined);

  try {
    await product.save(); // runs validators + setters (tags normalisation etc.)
  } catch (err) {
    throw toInputError(err, set.slug);
  }
  return { product: publicView(product), previousSlug };
}

/**
 * Permanently deletes a product, its reviews and its uploaded photos/videos. If it was sold, its delivery details are
 * first copied onto each buyer's order line (lib/data/orders.js consumeDownload falls back to them) and the source
 * file is kept, so every purchase stays downloadable.
 * @returns {{ result: 'deleted', slug: string, orderCount: number, reviewsDeleted: number }}
 */
export async function deleteProduct(id) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('Product not found', {}, 404);
  await connectDB();

  const product = await Product.findById(id).select('slug coverImage images videos deliveryType downloadUrl sourceFileName files').lean();
  if (!product) throw new InputError('Product not found', {}, 404);

  // Buyers keep their lifetime downloads: copy the delivery details onto their order lines first.
  const orderCount = await Order.countDocuments({ 'items.product': product._id });
  if (orderCount > 0 && product.downloadUrl) {
    const { deliveryType, downloadUrl, sourceFileName, files } = product;
    await Order.updateMany(
      { 'items.product': product._id },
      { $set: { 'items.$[line].delivery': { deliveryType, downloadUrl, ...(sourceFileName && { sourceFileName }), ...(files?.length && { files }) } } },
      { arrayFilters: [{ 'line.product': product._id }] },
    );
  }

  // Reviews belong to the product. Orders, payouts/transactions and messages keep their own copies of what they need.
  const { deletedCount: reviewsDeleted } = await Review.deleteMany({ product: product._id });
  await Product.deleteOne({ _id: product._id });

  // Uploaded photos/videos go too, and the source file unless buyers still download it. Files another product still
  // uses (e.g. a duplicated listing) are kept.
  const sources = orderCount ? [] : [product.downloadUrl, ...(product.files ?? []).map((f) => f.url)];
  const files = [product.coverImage, ...(product.images ?? []), ...(product.videos ?? []), ...sources].filter(Boolean);
  const stillUsed = files.length
    ? new Set(
        (
          await Product.find({
            $or: [{ coverImage: { $in: files } }, { images: { $in: files } }, { videos: { $in: files } }, { downloadUrl: { $in: files } }, { 'files.url': { $in: files } }],
          })
            .select('coverImage images videos downloadUrl files')
            .lean()
        ).flatMap((p) => [p.coverImage, ...(p.images ?? []), ...(p.videos ?? []), p.downloadUrl, ...(p.files ?? []).map((f) => f.url)]),
      )
    : new Set();
  // Loaded here: lib/uploads.js imports InputError from this module.
  const { deleteStoredUploads } = await import('@/lib/uploads');
  await deleteStoredUploads(files.filter((f) => !stillUsed.has(f)));

  return { result: 'deleted', slug: product.slug, orderCount, reviewsDeleted };
}
