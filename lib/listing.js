// Seller listings — options and validation shared by the listing form (client), the seller API (server) and
// models/Product.js, so all three always agree. Relative imports: the model is also loaded by plain Node scripts.
import { isAllowedImageUrl, isLocalMediaPath } from './image-hosts.js';
import { stripRichText } from './rich-text.js';
import { listingCategoryProblem } from './category-tree.js';

/** A shop becomes a "Best seller" (badge on all its product cards) once its listings have sold this many times in total. */
export const SELLER_BESTSELLER_SALES = 5;

/** How many listings a seller can feature (★) at once; they're shown at the top of their shop page. */
export const MAX_SHOP_FEATURED = 3;

export const LISTING_LIMITS = { title: 140, summary: 280, description: 20000, descriptionMin: 20, photos: 20, videos: 2, tags: 13, tagLength: 30, files: 5 };

const MB = 1024 * 1024;
/** Everything uploaded for one product (photos, videos and the files buyers get) together. */
export const PRODUCT_UPLOAD_MAX_BYTES = 100 * MB;
/** Digital file names, as buyers will see them: letters, numbers, periods, underscores and hyphens, up to 70. */
export const FILE_NAME_RE = /^[A-Za-z0-9._-]{1,70}$/;

/**
 * What sellers and admins may upload (checked in the browser before uploading, and again by the upload routes).
 * `source` = the files buyers get after paying, up to LISTING_LIMITS.files per listing (links cover Canva, Notion…).
 */
export const UPLOAD_RULES = {
  photo: {
    label: 'JPG, PNG, WebP or GIF',
    maxBytes: 10 * MB,
    types: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' },
  },
  video: { label: 'MP4, WebM or MOV', maxBytes: 20 * MB, types: { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' } },
  source: {
    label: 'PDF, ZIP, EPUB, MOBI, iBook, DOC, RTF, TXT, JPG, PNG, GIF, BMP, PSP, MP3, MPEG, MOV or STL',
    maxBytes: 20 * MB,
    types: {
      pdf: 'application/pdf',
      zip: 'application/zip',
      epub: 'application/epub+zip',
      mobi: 'application/x-mobipocket-ebook',
      ibook: 'application/x-ibooks+zip',
      ibooks: 'application/x-ibooks+zip',
      doc: 'application/msword',
      rtf: 'application/rtf',
      txt: 'text/plain',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      bmp: 'image/bmp',
      psp: 'application/octet-stream',
      mp3: 'audio/mpeg',
      mpeg: 'video/mpeg',
      mov: 'video/quicktime',
      stl: 'model/stl',
    },
  },
  // Government ID photos or scans for opening a shop (/sell-on-sellpify). Private like `source`: never a public URL.
  idDocument: {
    label: 'JPG, PNG or PDF',
    maxBytes: 10 * MB,
    types: { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf' },
  },
};
/** Upload kinds anyone signed in may use while opening a shop (shop logo / banner, ID). Sellers and admins: all. */
export const ONBOARDING_UPLOAD_KINDS = ['photo', 'idDocument'];
// Browsers label ZIPs differently (Windows: x-zip-compressed); the upload routes accept these for `source`.
export const ZIP_MIME_ALIASES = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'];

export const extensionOf = (name) =>
  String(name ?? '')
    .split(/[?#]/)[0]
    .split('.')
    .pop()
    ?.toLowerCase() ?? '';
export const formatBytes = (bytes) =>
  bytes >= MB ? `${(bytes / MB).toFixed(bytes >= 100 * MB ? 0 : 1)} MB` : bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '0 MB';

/** Why a digital file's name can't be used (buyers see it as is, and it can't be changed later), or null. */
export function fileNameProblem(name) {
  const value = String(name ?? '');
  if (value.length > 70) return `“${value.slice(0, 30)}…” has a name over 70 characters. Shorten it and upload again.`;
  if (!FILE_NAME_RE.test(value)) return `Rename “${value}” using only letters, numbers, periods, underscores or hyphens (no spaces), then upload it.`;
  return null;
}

/** Why a file can't be uploaded as `kind`, or null when it's fine. */
export function uploadProblem(kind, { name, size }) {
  const rule = UPLOAD_RULES[kind];
  if (!rule) return 'Unknown upload type.';
  if (!rule.types[extensionOf(name)]) return kind === 'source' ? `${name}: this file type can’t be sold here.` : `${name} isn’t a ${rule.label} file.`;
  if (kind === 'source' && fileNameProblem(name)) return fileNameProblem(name);
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
/** A seller-uploaded file buyers get (UPLOAD_RULES.source types): a Vercel Blob URL, or a private key on this server (uploads/private/…). */
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
  { value: 'file', label: 'Upload files', text: `Up to ${LISTING_LIMITS.files} files (20 MB each) that buyers download after paying.` },
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
 * price (cents), compareAtPrice, deliveryType, files[], downloadUrl, fileFormat, madeBy, itemType, madeWhen, license,
 * rightsConfirmed }. deliveryType 'file' = uploaded files in `files` (filesProblem); 'external' = an https link in
 * downloadUrl (Canva, Notion…).
 * Drafts only need a title (and whatever they do fill in must be valid). `categories` (the tree) adds the main › sub
 * rule: a main category that has sub-categories needs one of them picked. Returns { field: message }.
 */
export function validateListing(v, { draft = false, categories } = {}) {
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
  else if (need && categories) {
    const problem = listingCategoryProblem(v.category, categories);
    if (problem) e.category = problem;
  }

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
  } else {
    const problem = filesProblem(v.files, { need });
    if (problem) e.files = problem;
  }
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

/**
 * The files buyers get (`files`: [{ url, name, size, uploadedAt }]): at least one when `need`, up to
 * LISTING_LIMITS.files, each an upload of an allowed type within its size limit. Names and per-file sizes of new
 * uploads are checked when they're uploaded; the server measures the real sizes again. Returns a message or null.
 */
export function filesProblem(files, { need = false } = {}) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return need ? 'Upload at least one file buyers will download.' : null;
  if (list.length > LISTING_LIMITS.files) return `Upload up to ${LISTING_LIMITS.files} files.`;
  if (list.some((f) => !f || typeof f !== 'object' || !isUploadedSource(f.url))) return 'Every file must be uploaded here.';
  if (list.some((f) => !String(f.name ?? '').trim() || String(f.name).length > 200)) return 'Every file needs a name.';
  if (new Set(list.map((f) => f.url)).size !== list.length) return 'The same file is listed twice.';
  const total = list.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  if (total > PRODUCT_UPLOAD_MAX_BYTES) return `Files can add up to ${formatBytes(PRODUCT_UPLOAD_MAX_BYTES)} per listing.`;
  return null;
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
