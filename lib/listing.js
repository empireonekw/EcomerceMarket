// Seller listings — options and validation shared by the listing form (client), the seller API (server) and
// models/Product.js, so all three always agree. Relative imports: the model is also loaded by plain Node scripts.
import { isAllowedImageUrl, isLocalMediaPath } from './image-hosts.js';
import { stripRichText } from './rich-text.js';

export const LISTING_LIMITS = { title: 140, summary: 280, description: 20000, descriptionMin: 20, photos: 20, videos: 2, tags: 13, tagLength: 30 };

const MB = 1024 * 1024;
/**
 * What sellers may upload (checked in the browser before uploading, and again by the upload routes).
 * `source` = the file buyers get after paying: PDF or ZIP only (links cover Canva, Notion, Figma…).
 */
export const UPLOAD_RULES = {
  photo: {
    label: 'JPG, PNG, WebP or GIF',
    maxBytes: 10 * MB,
    types: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' },
  },
  video: { label: 'MP4, WebM or MOV', maxBytes: 100 * MB, types: { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' } },
  source: { label: 'PDF or ZIP', maxBytes: 500 * MB, types: { pdf: 'application/pdf', zip: 'application/zip' } },
};
// Browsers label ZIPs differently (Windows: x-zip-compressed); the upload routes accept these for `source`.
export const ZIP_MIME_ALIASES = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'];

export const extensionOf = (name) =>
  String(name ?? '')
    .split(/[?#]/)[0]
    .split('.')
    .pop()
    ?.toLowerCase() ?? '';
export const formatBytes = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toFixed(bytes >= 100 * MB ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Why a file can't be uploaded as `kind`, or null when it's fine. */
export function uploadProblem(kind, { name, size }) {
  const rule = UPLOAD_RULES[kind];
  if (!rule) return 'Unknown upload type.';
  if (!rule.types[extensionOf(name)]) return `${name} isn’t a ${rule.label} file.`;
  if (size > rule.maxBytes) return `${name} is ${formatBytes(size)}, the limit is ${formatBytes(rule.maxBytes)}.`;
  if (size === 0) return `${name} is empty.`;
  return null;
}

const BLOB_HOST_RE = /\.public\.blob\.vercel-storage\.com$/;
const uploadedUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && BLOB_HOST_RE.test(url.hostname) ? url : null;
  } catch {
    return null;
  }
};
/** A seller-uploaded video: on Vercel Blob or this server, with a video extension. */
export const isUploadedVideo = (value) => Boolean((uploadedUrl(value) || isLocalMediaPath(value)) && UPLOAD_RULES.video.types[extensionOf(value)]);
/** A seller-uploaded source file (PDF or ZIP): a Vercel Blob URL, or a private key on this server (uploads/private/…). */
export const isUploadedSource = (value) =>
  Boolean((uploadedUrl(value) || /^uploads\/private\/[\w.-]+$/.test(String(value ?? ''))) && UPLOAD_RULES.source.types[extensionOf(value)]);

export const MADE_BY = [
  { value: 'me', label: 'I did' },
  { value: 'shop_member', label: 'A member of my shop' },
  { value: 'another', label: 'Another company or person' },
];
export const ITEM_TYPES = [
  { value: 'finished', label: 'A finished product' },
  { value: 'supply', label: 'A supply or tool to make things' },
];
export const MADE_WHEN = [
  { value: 'made_to_order', label: 'Made to order' },
  { value: '2020_now', label: '2020 – present' },
  { value: '2010_2019', label: '2010 – 2019' },
  { value: 'before_2010', label: 'Before 2010' },
];
export const LICENSES = [
  { value: 'personal', label: 'Personal use', text: 'Buyers may use it for themselves only.' },
  { value: 'commercial', label: 'Personal & commercial use', text: 'Buyers may also use it in client and commercial work.' },
];
export const DELIVERY_OPTIONS = [
  { value: 'file', label: 'Upload a file', text: 'A PDF or ZIP that buyers download after paying.' },
  { value: 'external', label: 'Add a link', text: 'Canva, Notion, Figma, Google Drive or any https link.' },
];

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label;
const valuesOf = (options) => options.map((o) => o.value);

const isHttpsUrl = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Listing status as sellers see it (Listings page filters, badges). `tone` maps onto StatusBadge colours.
 *   draft → Draft · pending → In review · rejected → Rejected · approved → Active (published) or Inactive (hidden)
 */
export function listingStatus({ status, isPublished }) {
  if (status === 'draft') return { key: 'draft', label: 'Draft', tone: 'cancelled' };
  if (status === 'pending') return { key: 'review', label: 'In review', tone: 'pending' };
  if (status === 'rejected') return { key: 'rejected', label: 'Rejected', tone: 'rejected' };
  return isPublished ? { key: 'active', label: 'Active', tone: 'approved' } : { key: 'inactive', label: 'Inactive', tone: 'cancelled' };
}

/**
 * Validates a seller listing payload: { title, category, description, shortDescription, tags[], images[], videos[],
 * price (cents), compareAtPrice, deliveryType, downloadUrl, fileFormat, madeBy, itemType, madeWhen, license, rightsConfirmed }.
 * deliveryType 'file' = an uploaded PDF/ZIP in downloadUrl; 'external' = any https link (Canva, Notion…).
 * Drafts only need a title (and whatever they do fill in must be valid). Returns { field: message }.
 */
export function validateListing(v, { draft = false } = {}) {
  const e = {};
  const need = !draft;
  const title = String(v.title ?? '').trim();
  if (!title) e.title = draft ? 'Add a title to save a draft.' : 'Add a title.';
  else if (title.length > LISTING_LIMITS.title) e.title = `Keep the title under ${LISTING_LIMITS.title} characters.`;

  const images = Array.isArray(v.images) ? v.images : [];
  if (need && images.length === 0) e.images = 'Add at least one photo, the first one is your cover.';
  else if (images.length > LISTING_LIMITS.photos) e.images = `Add up to ${LISTING_LIMITS.photos} photos.`;
  else if (images.some((u) => !(isHttpsUrl(u) || isLocalMediaPath(u)) || !isAllowedImageUrl(u)))
    e.images = 'Every photo must be an upload or an https link on an allowed image host.';
  const videos = Array.isArray(v.videos) ? v.videos : [];
  if (videos.length > LISTING_LIMITS.videos) e.videos = `Add up to ${LISTING_LIMITS.videos} videos.`;
  else if (videos.some((u) => !isUploadedVideo(u))) e.videos = 'Upload videos here (MP4, WebM or MOV).';

  if (need && !v.category) e.category = 'Choose a category.';

  const description = String(v.description ?? '').trim();
  const visible = stripRichText(description).trim(); // formatting markers don't count towards the minimum
  if (need && !visible) e.description = 'Describe what buyers get.';
  else if (visible && visible.length < LISTING_LIMITS.descriptionMin)
    e.description = `Write at least ${LISTING_LIMITS.descriptionMin} characters.`;
  else if (description.length > LISTING_LIMITS.description) e.description = 'The description is too long.';
  if (String(v.shortDescription ?? '').length > LISTING_LIMITS.summary)
    e.shortDescription = `Keep the summary under ${LISTING_LIMITS.summary} characters.`;

  const tags = Array.isArray(v.tags) ? v.tags : [];
  if (tags.length > LISTING_LIMITS.tags) e.tags = `Add up to ${LISTING_LIMITS.tags} tags.`;
  else if (tags.some((t) => String(t).length > LISTING_LIMITS.tagLength))
    e.tags = `Each tag must be ${LISTING_LIMITS.tagLength} characters or fewer.`;

  const price = v.price;
  if (price == null || price === '') {
    if (need) e.price = 'Set a price (use 0 for a free item).';
  } else if (!Number.isInteger(price) || price < 0 || price > 99_999_999) e.price = 'Enter a valid price.';
  if (v.compareAtPrice != null && v.compareAtPrice !== '') {
    if (!Number.isInteger(v.compareAtPrice) || v.compareAtPrice < 0) e.compareAtPrice = 'Enter a valid amount.';
    else if (Number.isInteger(price) && v.compareAtPrice <= price) e.compareAtPrice = 'Must be higher than the price.';
  }

  if (v.deliveryType && !valuesOf(DELIVERY_OPTIONS).includes(v.deliveryType)) e.deliveryType = 'Choose how buyers receive it.';
  const link = String(v.downloadUrl ?? '').trim();
  if (v.deliveryType === 'external') {
    if (need && !link) e.downloadUrl = 'Add the link buyers will get.';
    else if (link && !isHttpsUrl(link)) e.downloadUrl = 'Use a secure https:// link.';
  } else if (need && !link) e.downloadUrl = 'Upload your PDF or ZIP file.';
  else if (link && !isUploadedSource(link)) e.downloadUrl = 'Upload a PDF or ZIP file, or choose “Add a link” for Canva, Notion and other links.';
  if (String(v.sourceFileName ?? '').length > 200) e.downloadUrl = 'That file name is too long.';
  if (String(v.fileFormat ?? '').length > 40) e.fileFormat = 'Keep it under 40 characters.';

  const choice = (key, options, message) => {
    if (v[key] ? !valuesOf(options).includes(v[key]) : need) e[key] = message;
  };
  choice('madeBy', MADE_BY, 'Tell buyers who made it.');
  choice('itemType', ITEM_TYPES, 'Choose what it is.');
  choice('madeWhen', MADE_WHEN, 'Choose when it was made.');
  choice('license', LICENSES, 'Choose how buyers may use it.');
  if (need && v.rightsConfirmed !== true) e.rightsConfirmed = 'Confirm you have the right to sell this.';
  return e;
}

/** Recognises common file hosts and suggests a direct-download form where one exists: { text, fix? } or null. */
export function downloadHint(url) {
  if (!isHttpsUrl(url)) return null;
  const { hostname, searchParams } = new URL(url);
  if (hostname.endsWith('dropbox.com')) {
    if (searchParams.get('dl') === '1') return { text: 'Dropbox direct-download link detected.' };
    return {
      text: 'Dropbox link: switch to a direct download (?dl=1) so buyers get the file, not a preview page.',
      fix: () => {
        const u = new URL(url);
        u.searchParams.set('dl', '1');
        return u.toString();
      },
    };
  }
  if (hostname === 'drive.google.com') return { text: 'Google Drive link: make sure sharing is set to “Anyone with the link”.' };
  return null;
}
