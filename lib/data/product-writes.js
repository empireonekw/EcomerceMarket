import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { createBlurDataURL } from '@/lib/blur';
import { slugify, toPlain } from '@/lib/utils';
import Product from '@/models/Product';
import Category from '@/models/Category';
import Order from '@/models/Order';

// Product write operations. Callers (API routes) are responsible for authorization.

/** Fields an admin may set. */
export const ADMIN_FIELDS = [
  'title', 'shortDescription', 'description', 'price', 'compareAtPrice', 'currency', 'tags',
  'coverImage', 'deliveryType', 'downloadUrl', 'fileFormat', 'fileSize', 'isPublished', 'isFeatured', 'status',
];
/**
 * Fields a seller may set (lib/listing.js validates them first). Ownership, moderation status and featuring in the
 * store are always decided server-side; `isPublished` only takes effect once an admin approves the listing.
 */
export const SELLER_FIELDS = [
  'title', 'shortDescription', 'description', 'price', 'compareAtPrice', 'tags', 'images', 'videos', 'coverImage', 'deliveryType',
  'downloadUrl', 'sourceFileName', 'fileSize', 'fileFormat', 'madeBy', 'itemType', 'madeWhen', 'license', 'rightsConfirmed',
  'shopFeatured', 'isPublished',
];
// Optional fields that are cleared by sending null or "". Required ones (price, description…) are only optional
// on drafts — schema validation still rejects them missing anywhere else.
const CLEARABLE_FIELDS = new Set([
  'shortDescription', 'compareAtPrice', 'coverImage', 'fileFormat', 'fileSize', 'images', 'videos', 'sourceFileName',
  'price', 'description', 'downloadUrl', 'madeBy', 'itemType', 'madeWhen', 'license',
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

/** Returns { id } or { error } — errors are collected, not thrown, so all field errors report together. */
async function resolveCategory(value) {
  if (!value) return { error: 'Category is required' };
  const query = mongoose.isValidObjectId(value) ? { _id: value } : { slug: String(value).toLowerCase() };
  const category = await Category.findOne(query).select('_id').lean();
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
  return { set, unset };
}

function toInputError(err, slug) {
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    const errors = err.errors ?? { [err.path]: err };
    return new InputError('Validation failed', Object.fromEntries(Object.entries(errors).map(([k, e]) => [k, e.message])));
  }
  if (err?.code === 11000) return new InputError('That slug is already taken, please choose another', { slug }, 409);
  return err;
}

const publicView = (doc) => {
  const obj = doc.toObject();
  delete obj.downloadUrl; // never echo the private delivery location
  return toPlain(obj);
};

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
 * Deletes a product — unless it has been sold. Buyers' download links resolve through the product,
 * so sold products are unpublished (hidden from the store) instead, keeping every purchase deliverable.
 * @returns {{ result: 'deleted' | 'archived', slug: string, orderCount: number }}
 */
export async function deleteProduct(id) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('Product not found', {}, 404);
  await connectDB();

  const product = await Product.findById(id).select('slug').lean();
  if (!product) throw new InputError('Product not found', {}, 404);

  const orderCount = await Order.countDocuments({ 'items.product': product._id });
  if (orderCount > 0) {
    await Product.updateOne({ _id: product._id }, { $set: { isPublished: false, isFeatured: false } });
    return { result: 'archived', slug: product.slug, orderCount };
  }

  await Product.deleteOne({ _id: product._id });
  return { result: 'deleted', slug: product.slug, orderCount: 0 };
}
