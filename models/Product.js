import mongoose from 'mongoose';
import { slugify } from '../lib/utils.js';
import { isAllowedImageUrl } from '../lib/image-hosts.js';
import { isUploadedVideo, ITEM_TYPES, LICENSES, LISTING_LIMITS, MADE_BY, MADE_WHEN } from '../lib/listing.js';

const { Schema } = mongoose;

export const DELIVERY_TYPES = ['file', 'external'];
// 'draft' = a seller's unfinished listing: private, never reviewed or shown, and only the title is required.
export const PRODUCT_STATUSES = ['draft', 'pending', 'approved', 'rejected'];

/** Required unless the product is a seller draft. */
const unlessDraft = (message) => [function requiredUnlessDraft() { return this.status !== 'draft'; }, message];

const isHttpUrl = (v) => !v || /^https?:\/\/\S+$/i.test(v);

const productSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 140,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    shortDescription: { type: String, trim: true, maxlength: 280 },
    description: {
      type: String,
      required: unlessDraft('Description is required'),
      maxlength: 20000,
    },

    // Integer cents (1999 = $19.99) to avoid floating-point rounding.
    price: {
      type: Number,
      required: unlessDraft('Price is required'),
      min: 0,
      validate: { validator: Number.isInteger, message: 'Price must be an integer number of cents' },
    },
    compareAtPrice: {
      type: Number,
      min: 0,
      validate: { validator: (v) => v == null || Number.isInteger(v), message: 'compareAtPrice must be in cents' },
    },
    currency: { type: String, default: 'USD', uppercase: true, minlength: 3, maxlength: 3 },

    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: unlessDraft('Category is required'),
    },
    tags: {
      type: [String],
      default: [],
      // Normalise: trimmed, lowercase, de-duplicated.
      set: (tags) => [...new Set((tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))],
    },

    // Public cover image. Host must be in lib/image-hosts.js, or next/image refuses to render it.
    coverImage: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || isAllowedImageUrl(v),
        message: 'coverImage must be an https URL on an allowed image host (see lib/image-hosts.js)',
      },
    },
    // ~16px WebP data URL generated from coverImage on write (lib/blur.js) for instant blur-up.
    coverBlurDataURL: { type: String, maxlength: 4000 },
    // Listing photos in display order; the first one is also stored as coverImage.
    images: {
      type: [String],
      default: undefined,
      validate: [
        { validator: (v) => !v || v.length <= LISTING_LIMITS.photos, message: `Add up to ${LISTING_LIMITS.photos} photos` },
        { validator: (v) => !v || v.every((u) => isAllowedImageUrl(u)), message: 'Every photo must be an https URL on an allowed image host' },
      ],
    },
    // Seller-uploaded videos (Vercel Blob or this server), shown after the photos on the product page.
    videos: {
      type: [String],
      default: undefined,
      validate: [
        { validator: (v) => !v || v.length <= LISTING_LIMITS.videos, message: `Add up to ${LISTING_LIMITS.videos} videos` },
        { validator: (v) => !v || v.every((u) => isUploadedVideo(u)), message: 'Videos must be uploaded files' },
      ],
    },

    /**
     * Delivery — the product's actual payload. NEVER sent to the browser:
     *  - deliveryType 'file':     downloadUrl is a private storage location (e.g. an S3/R2 object key
     *                              or private URL). Exchange it for a short-lived signed URL only after
     *                              verifying a paid Order.
     *  - deliveryType 'external': downloadUrl is an external link (Notion, Figma, GitHub invite, etc.)
     *                              revealed only to verified buyers.
     */
    deliveryType: { type: String, enum: DELIVERY_TYPES, default: 'file' },
    downloadUrl: {
      type: String,
      required: unlessDraft('A download/PDF file link is required'),
      trim: true,
      select: false,
      alias: 'pdfFileUrl', // sellers submit a PDF link; it's stored (and delivered) like every other file
    },
    fileFormat: { type: String, trim: true, maxlength: 40 }, // e.g. "PDF", "Figma", "ZIP (SVG, AI, EPS)"
    fileSize: { type: Number, min: 0 }, // bytes
    sourceFileName: { type: String, trim: true, maxlength: 200 }, // original name of an uploaded PDF/ZIP (download filename)

    // How it's made + licence (seller listing form). Optional for platform products and drafts.
    madeBy: { type: String, enum: MADE_BY.map((o) => o.value) },
    itemType: { type: String, enum: ITEM_TYPES.map((o) => o.value) },
    madeWhen: { type: String, enum: MADE_WHEN.map((o) => o.value) },
    license: { type: String, enum: LICENSES.map((o) => o.value) },
    rightsConfirmed: { type: Boolean }, // seller confirmed they may sell everything in the listing
    shopFeatured: { type: Boolean, default: false }, // seller's own pin: listed first on their Listings page

    // Marketplace: products without a seller belong to the platform (100% platform revenue).
    sellerId: { type: Schema.Types.ObjectId, ref: 'User' },
    // Moderation. Seller listings are 'draft' until submitted, then 'pending'; only 'approved' products are ever shown or sold.
    status: { type: String, enum: PRODUCT_STATUSES, default: 'approved' },

    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    salesCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

/** The one definition of "visible in the store": published AND approved. */
export const PUBLIC_PRODUCT_FILTER = Object.freeze({ isPublished: true, status: 'approved' });

productSchema.path('downloadUrl').validate(function validateExternal(v) {
  return this.deliveryType !== 'external' || isHttpUrl(v);
}, 'External downloadUrl must be an http(s) URL');

productSchema.pre('validate', function ensureSlug() {
  if (!this.slug && this.title) this.slug = slugify(this.title);
});

// ---------- Indexes (every storefront query filters on isPublished first) ----------
productSchema.index({ isPublished: 1, createdAt: -1 }); // default listing: newest
productSchema.index({ isPublished: 1, category: 1, createdAt: -1 }); // category listing
productSchema.index({ isPublished: 1, salesCount: -1 }); // "popular" sort
productSchema.index({ isPublished: 1, price: 1 }); // price sorts / ranges
productSchema.index({ isPublished: 1, isFeatured: 1, createdAt: -1 }); // homepage featured
productSchema.index({ tags: 1 }); // tag filter (multikey)
productSchema.index({ sellerId: 1, createdAt: -1 }, { partialFilterExpression: { sellerId: { $exists: true } } }); // seller dashboard
productSchema.index({ status: 1, createdAt: -1 }); // admin moderation queue
// Search uses word-prefix regexes (lib/data/products.js → buildSearchFilter) so results update while typing.
// At large catalog sizes, move it to an Atlas Search index with the `autocomplete` operator.

export default mongoose.models.Product || mongoose.model('Product', productSchema);
