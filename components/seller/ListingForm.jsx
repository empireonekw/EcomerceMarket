'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Eye, FileArchive, FileText, Info, Link2, Pin, Plus, Upload, X } from 'lucide-react';
import RichText from '@/components/RichText';
import RichTextEditor from '@/components/seller/RichTextEditor';
import { StatusBadge } from '@/components/dashboard/ui';
import { useToast } from '@/components/dashboard/Toaster';
import { NO_PLATFORM_FEE, splitSale } from '@/lib/commission';
import { REMOTE_IMAGE_PATTERNS, isAllowedImageUrl } from '@/lib/image-hosts';
import {
  DELIVERY_OPTIONS,
  ITEM_TYPES,
  LICENSES,
  LISTING_LIMITS,
  MADE_BY,
  MADE_WHEN,
  UPLOAD_RULES,
  downloadHint,
  extensionOf,
  formatBytes,
  isUploadedSource,
  labelOf,
  listingStatus,
  uploadProblem,
  validateListing,
} from '@/lib/listing';
import { uploadFile } from '@/lib/upload-client';
import { formatPrice } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Sections (the tab bar scrolls to these) and which fields live in each
// ---------------------------------------------------------------------------

const SECTIONS = [
  { id: 'photos', label: 'Photo & Video', fields: ['images', 'videos'] },
  { id: 'details', label: 'Item Details', fields: ['category', 'title', 'description', 'shortDescription', 'tags'] },
  { id: 'pricing', label: 'Pricing & Delivery', fields: ['price', 'compareAtPrice', 'deliveryType', 'downloadUrl', 'fileFormat'] },
  { id: 'made', label: 'How It’s Made', fields: ['madeBy', 'itemType', 'madeWhen'] },
  { id: 'legal', label: 'Legal and compliance', fields: ['license', 'rightsConfirmed'] },
  { id: 'settings', label: 'Settings', fields: ['shopFeatured', 'isPublished'] },
];
const FIELD_ORDER = SECTIONS.flatMap((s) => s.fields);
const sectionOf = (field) => SECTIONS.find((s) => s.fields.includes(field))?.id;

const MONEY_RE = /^\d{1,6}(\.\d{1,2})?$/;
const toCents = (v) => (v.trim() === '' ? null : MONEY_RE.test(v.trim()) ? Math.round(Number.parseFloat(v) * 100) : Number.NaN);
const toDollars = (cents) => (cents == null ? '' : (cents / 100).toFixed(2).replace(/\.00$/, ''));
// Hosts a product photo may come from (the profile-picture hosts in the same list aren't meant for listings).
const ALLOWED_HOSTS = REMOTE_IMAGE_PATTERNS.filter((p) => !/avatars|googleusercontent/.test(p.hostname))
  .map((p) => p.hostname.replace(/^\*\*\./, '*.'))
  .join(', ');

const MEDIA_ACCEPT = [...new Set([...Object.values(UPLOAD_RULES.photo.types), ...Object.values(UPLOAD_RULES.video.types)])].join(',');
const SOURCE_ACCEPT = '.pdf,.zip,application/pdf,application/zip';
const isVideoFile = (file) => file.type.startsWith('video/') || Boolean(UPLOAD_RULES.video.types[extensionOf(file.name)]);

function initialValues(listing) {
  // An uploaded PDF/ZIP is "Upload a file"; any other saved link (Canva, Dropbox…) is "Add a link".
  const location = listing?.downloadUrl ?? '';
  const uploaded = isUploadedSource(location);
  return {
    images: listing?.images?.length ? listing.images : listing?.coverImage ? [listing.coverImage] : [],
    videos: listing?.videos ?? [],
    category: listing?.category?._id ?? '',
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    shortDescription: listing?.shortDescription ?? '',
    tags: listing?.tags ?? [],
    price: toDollars(listing?.price),
    compareAtPrice: toDollars(listing?.compareAtPrice),
    deliveryType: location && !uploaded ? 'external' : (listing?.deliveryType ?? 'file'),
    fileUrl: uploaded ? location : '', // uploaded PDF/ZIP
    sourceFileName: uploaded ? (listing?.sourceFileName ?? '') : '',
    fileSize: uploaded ? (listing?.fileSize ?? null) : null, // display only — the server measures it
    linkUrl: uploaded ? '' : location, // Canva, Notion, Figma, Drive…
    fileFormat: listing?.fileFormat ?? '',
    madeBy: listing?.madeBy ?? '',
    itemType: listing?.itemType ?? '',
    madeWhen: listing?.madeWhen ?? '',
    license: listing?.license ?? '',
    rightsConfirmed: listing?.rightsConfirmed ?? false,
    shopFeatured: listing?.shopFeatured ?? false,
    isPublished: listing?.isPublished ?? true,
  };
}

/** Form state → API payload (prices in cents; blanks become null so the server clears them). */
function toPayload(v) {
  return {
    images: v.images,
    videos: v.videos,
    category: v.category,
    title: v.title.trim(),
    description: v.description.trim() || null,
    shortDescription: v.shortDescription.trim() || null,
    tags: v.tags,
    price: toCents(v.price),
    compareAtPrice: toCents(v.compareAtPrice),
    deliveryType: v.deliveryType,
    downloadUrl: (v.deliveryType === 'external' ? v.linkUrl.trim() : v.fileUrl) || null,
    sourceFileName: v.deliveryType === 'external' ? null : v.sourceFileName || null,
    fileFormat: v.fileFormat.trim() || null,
    madeBy: v.madeBy || null,
    itemType: v.itemType || null,
    madeWhen: v.madeWhen || null,
    license: v.license || null,
    rightsConfirmed: v.rightsConfirmed,
    shopFeatured: v.shopFeatured,
    isPublished: v.isPublished,
  };
}

// ---------------------------------------------------------------------------
// Presentational pieces
// ---------------------------------------------------------------------------

const inputCls = (err) =>
  `mt-2 h-12 w-full rounded-xl border bg-white px-4 text-[15px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
    err ? 'border-red-400 focus:border-red-500' : 'border-stone-300 hover:border-stone-400 focus:border-ink'
  }`;

function Card({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <h2 className="headline text-2xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      <div className="mt-7 space-y-8">{children}</div>
    </div>
  );
}

function Label({ htmlFor, children, required, as: As = 'label' }) {
  return (
    <As {...(As === 'label' ? { htmlFor } : {})} className="block text-[15px] font-medium text-black">
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-red-600">
          *
        </span>
      )}
    </As>
  );
}

function Help({ children }) {
  return <p className="mt-1 text-sm text-stone-500">{children}</p>;
}

function ErrorText({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-2 text-sm font-medium text-red-600">
      {children}
    </p>
  );
}

function RadioList({ name, options, value, onChange, error }) {
  return (
    <div
      role="radiogroup"
      aria-invalid={Boolean(error) || undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className="mt-3 space-y-2.5"
    >
      {options.map((o, i) => (
        <label key={o.value} className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input
            type="radio"
            id={i === 0 ? name : undefined}
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-0.5 size-5 shrink-0 accent-ink"
          />
          <span>
            {o.label}
            {o.text && <span className="block text-sm text-stone-500">{o.text}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function OptionCards({ name, options, value, onChange, error }) {
  return (
    <div role="radiogroup" aria-invalid={Boolean(error) || undefined} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((o, i) => (
        <label
          key={o.value}
          className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
            value === o.value ? 'border-ink bg-stone-50' : error ? 'border-red-300' : 'border-stone-200 hover:border-stone-300'
          }`}
        >
          <input
            type="radio"
            id={i === 0 ? name : undefined}
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-0.5 size-4 shrink-0 accent-ink"
          />
          <span>
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="mt-0.5 block text-xs text-stone-500">{o.text}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

/** Placeholder tile with a progress bar while a photo or video uploads. */
function UploadingTile({ upload, video = false }) {
  return (
    <li
      className={`flex flex-col justify-end rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 ${video ? 'aspect-video' : 'aspect-square'}`}
      role="status"
    >
      <p className="truncate text-xs text-stone-600">{upload.name}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${upload.progress}%` }} />
      </div>
      <p className="mt-1 text-[11px] tabular-nums text-stone-500">Uploading… {upload.progress}%</p>
    </li>
  );
}

const selectCls = (err) =>
  `${inputCls(err)} appearance-none pr-11 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400`;

/** The main › sub › inner ids of category `id` (empty strings below it). */
function levelsOf(id, categories) {
  const c = categories.find((x) => x._id === id);
  if (!c) return ['', '', ''];
  const ids = [...c.ancestors, c._id];
  return [ids[0] ?? '', ids[1] ?? '', ids[2] ?? ''];
}

/**
 * Category: Main, then Sub, then Inner, each a dropdown of what's under the one before (set up by the admin under
 * Admin → Categories), so every product sits in its place on the category pages. A sub category is required when the
 * main has any; the inner one is optional. Stores the deepest picked id, or '' while a required sub is still missing.
 */
function CategorySelect({ categories, value, onChange, error }) {
  const [levels, setLevels] = useState(() => levelsOf(value, categories));
  // A new value from outside (the form loading a listing): show it. The form's own '' (sub missing) keeps the picks.
  useEffect(() => {
    if (value) setLevels(levelsOf(value, categories));
  }, [value, categories]);

  const childrenOf = (parentId) => categories.filter((c) => (c.parent ?? null) === parentId);
  const [main, sub, inner] = levels;
  const options = [childrenOf(null), main ? childrenOf(main) : [], sub ? childrenOf(sub) : []];
  const needsSub = Boolean(main) && options[1].length > 0 && !sub;

  function pick(level, id) {
    const next = [...levels.slice(0, level), id, '', ''].slice(0, 3);
    setLevels(next);
    const [m, s] = next;
    const deepest = next.findLast(Boolean) ?? '';
    // A main that has sub categories only groups them: nothing to store until a sub is picked.
    onChange(m && !s && childrenOf(m).length ? '' : deepest);
  }

  // Which dropdown the error belongs to: the one the seller still has to fill in.
  const errorAt = error ? (!main ? 0 : needsSub ? 1 : -1) : -1;
  const fields = [
    { id: 'category', label: 'Main category', required: true, placeholder: 'Choose a main category' },
    { id: 'category-sub', label: 'Sub category', required: options[1].length > 0, placeholder: main ? 'Choose a sub category' : 'Choose a main category first' },
    { id: 'category-inner', label: 'Inner category', required: false, placeholder: sub ? 'Choose an inner category' : 'Choose a sub category first' },
  ];
  const message = errorAt === 1 ? 'Choose a sub category.' : error;

  return (
    <div className="mt-3 grid max-w-3xl grid-cols-1 gap-4 lg:grid-cols-3">
      {fields.map((f, level) => {
        const list = options[level];
        // Hide the inner dropdown when the picked sub has none (it's optional anyway).
        const empty = level > 0 && levels[level - 1] && list.length === 0;
        return (
          <div key={f.id} className="min-w-0">
            <label htmlFor={f.id} className="text-sm font-medium text-stone-700">
              {f.label}{' '}
              {f.required ? <span className="text-red-600">*</span> : <span className="font-normal text-stone-400">(optional)</span>}
            </label>
            <div className="relative">
              <select
                id={f.id}
                value={levels[level]}
                disabled={level > 0 && (!levels[level - 1] || empty)}
                onChange={(e) => pick(level, e.target.value)}
                aria-invalid={errorAt === level || undefined}
                aria-describedby={errorAt === level ? 'category-error' : undefined}
                className={selectCls(errorAt === level)}
              >
                <option value="">{empty ? `No ${level === 1 ? 'sub' : 'inner'} categories` : f.placeholder}</option>
                {list.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-[calc(50%+4px)] -translate-y-1/2 text-stone-500"
              />
            </div>
            {errorAt === level && <ErrorText id="category-error">{message}</ErrorText>}
          </div>
        );
      })}
      {error && errorAt === -1 && (
        <div className="lg:col-span-3">
          <ErrorText id="category-error">{error}</ErrorText>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

/**
 * Seller listing form: one page, six sections, with a sticky tab bar that smooth-scrolls to each section and
 * highlights the one in view. Footer: Cancel · Preview · Save as draft · Publish (= submit for review).
 * @param {{ categories: Array<{ _id, name, slug }>, listing?: object, uploads: 'blob' | 'local' | null }} props
 *   `listing` = edit mode; `uploads` = where files go (lib/uploads.js → uploadDriver()), null when uploads are off
 */
export default function ListingForm({ categories, listing, uploads }) {
  const router = useRouter();
  const toast = useToast();
  const previewRef = useRef(null);
  const isEdit = Boolean(listing);

  const [values, setValues] = useState(() => initialValues(listing));
  const [touched, setTouched] = useState({});
  const [attempt, setAttempt] = useState(null); // 'draft' | 'publish' after a save attempt — shows every error
  const [serverErrors, setServerErrors] = useState({});
  const [saving, setSaving] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [uploading, setUploading] = useState([]); // photo/video uploads in flight: { id, kind, name, progress }
  const [mediaError, setMediaError] = useState(null);
  const [dropActive, setDropActive] = useState(null); // 'media' | 'source' while files are dragged over a drop zone
  const [showPhotoLink, setShowPhotoLink] = useState(!uploads);
  const [sourceProgress, setSourceProgress] = useState(null);
  const [sourceError, setSourceError] = useState(null);
  const mediaInputRef = useRef(null);
  const sourceInputRef = useRef(null);

  const payload = useMemo(() => toPayload(values), [values]);
  const errors = useMemo(() => ({ ...validateListing(payload, { draft: attempt === 'draft', categories }), ...serverErrors }), [payload, attempt, serverErrors, categories]);
  const show = (key) => (touched[key] || attempt ? errors[key] : undefined);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Highlight the tab of the section in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  /** `value` may be a function of the field's current value (for lists edited by several quick clicks). */
  function update(key, value) {
    setValues((v) => ({ ...v, [key]: typeof value === 'function' ? value(v[key]) : value }));
    setDirty(true);
    if (serverErrors[key]) setServerErrors(({ [key]: _, ...rest }) => rest);
  }
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));

  function scrollTo(id) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Photos ----
  function addPhoto(raw) {
    const url = String(raw ?? '').trim();
    if (!url) return;
    setPhotoError(null);
    if (values.images.length >= LISTING_LIMITS.photos) return setPhotoError(`You can add up to ${LISTING_LIMITS.photos} photos.`);
    if (!/^https:\/\//i.test(url)) return setPhotoError('Use a secure https:// image link.');
    if (!isAllowedImageUrl(url)) return setPhotoError(`That image host isn’t supported. Use: ${ALLOWED_HOSTS}.`);
    if (values.images.includes(url)) return setPhotoError('That photo is already added.');
    update('images', (images) => (images.includes(url) || images.length >= LISTING_LIMITS.photos ? images : [...images, url]));
    setPhotoUrl('');
  }
  function movePhoto(from, to) {
    update('images', (images) => {
      if (to < 0 || to >= images.length || from === to) return images;
      const next = [...images];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  // ---- Photo & video uploads ----
  async function startUpload(file, kind) {
    const id = `${Date.now()}-${Math.random()}`;
    const key = kind === 'video' ? 'videos' : 'images';
    const limit = kind === 'video' ? LISTING_LIMITS.videos : LISTING_LIMITS.photos;
    setUploading((u) => [...u, { id, kind, name: file.name, progress: 0 }]);
    try {
      const { url } = await uploadFile(file, {
        kind,
        driver: uploads,
        onProgress: (progress) => setUploading((u) => u.map((x) => (x.id === id ? { ...x, progress } : x))),
      });
      update(key, (list) => (list.length >= limit ? list : [...list, url]));
    } catch (err) {
      setMediaError((prev) => (prev ? `${prev} ${err.message}` : err.message));
    } finally {
      setUploading((u) => u.filter((x) => x.id !== id));
    }
  }

  /** Files picked or dropped: photos and videos are sorted out, checked against the limits, then uploaded. */
  function addMediaFiles(fileList) {
    setMediaError(null);
    let photos = values.images.length + uploading.filter((u) => u.kind === 'photo').length;
    let videos = values.videos.length + uploading.filter((u) => u.kind === 'video').length;
    const problems = new Set();
    for (const file of fileList) {
      const kind = isVideoFile(file) ? 'video' : 'photo';
      if (kind === 'photo' && photos >= LISTING_LIMITS.photos) problems.add(`You can add up to ${LISTING_LIMITS.photos} photos.`);
      else if (kind === 'video' && videos >= LISTING_LIMITS.videos) problems.add(`You can add up to ${LISTING_LIMITS.videos} videos.`);
      else {
        const problem = uploadProblem(kind, file);
        if (problem) problems.add(problem);
        else {
          if (kind === 'photo') photos += 1;
          else videos += 1;
          startUpload(file, kind);
        }
      }
    }
    if (problems.size) setMediaError([...problems].join(' '));
  }

  // ---- Source file (PDF / ZIP) ----
  async function uploadSource(file) {
    setSourceError(null);
    const problem = uploadProblem('source', file);
    if (problem) return setSourceError(problem);
    setSourceProgress(0);
    try {
      const { url, size } = await uploadFile(file, { kind: 'source', driver: uploads, onProgress: setSourceProgress });
      setValues((v) => ({ ...v, fileUrl: url, sourceFileName: file.name, fileSize: size, fileFormat: extensionOf(file.name).toUpperCase() }));
      setDirty(true);
      if (serverErrors.downloadUrl) setServerErrors(({ downloadUrl: _, ...rest }) => rest);
    } catch (err) {
      setSourceError(err.message);
    } finally {
      setSourceProgress(null);
    }
  }

  // ---- Tags ----
  function addTags(raw) {
    const incoming = String(raw)
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (!incoming.length) return;
    update('tags', (tags) => [...new Set([...tags, ...incoming.map((t) => t.slice(0, LISTING_LIMITS.tagLength))])].slice(0, LISTING_LIMITS.tags));
    setTagInput('');
  }

  // ---- Save ----
  async function save(mode) {
    if (uploading.length || sourceProgress != null) {
      toast.error('Uploads still in progress', 'Wait for your files to finish uploading, then try again.');
      return;
    }
    setAttempt(mode);
    const found = validateListing(payload, { draft: mode === 'draft', categories });
    if (Object.keys(found).length) {
      const first = FIELD_ORDER.find((f) => found[f]) ?? Object.keys(found)[0];
      toast.error(mode === 'draft' ? 'Add a title to save a draft' : 'A few things need your attention', found[first]);
      scrollTo(sectionOf(first) ?? 'photos');
      const focusId =
        {
          images: 'media-upload',
          videos: 'media-upload',
          downloadUrl: values.deliveryType === 'external' ? 'downloadUrl' : 'source-upload',
          // Main picked but its sub missing: go to the sub dropdown.
          category: document.getElementById('category')?.value ? 'category-sub' : 'category',
        }[first] ?? first;
      setTimeout(() => document.getElementById(focusId)?.focus({ preventScroll: true }), 400);
      return;
    }

    setSaving(mode);
    try {
      const res = await fetch(isEdit ? `/api/seller/products/${listing._id}` : '/api/seller/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, draft: mode === 'draft' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast.error('Your session expired', 'Please log in again.');
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (!res.ok) {
        setServerErrors(data.fields ?? {});
        const first = FIELD_ORDER.find((f) => data.fields?.[f]);
        if (first) scrollTo(sectionOf(first));
        toast.error('Could not save the listing', data.error);
        setSaving(null);
        return;
      }
      setDirty(false);
      toast.success(
        mode === 'draft' ? 'Draft saved' : isEdit ? 'Changes submitted for review' : 'Listing submitted for review',
        mode === 'draft' ? `“${data.title ?? data.product?.title}” is saved in your drafts.` : 'It goes live as soon as our team approves it.',
      );
      router.push(`/seller/listings?status=${mode === 'draft' ? 'draft' : 'review'}`);
      router.refresh();
    } catch {
      toast.error('Network error', 'Check your connection and try again.');
      setSaving(null);
    }
  }

  const priceCents = toCents(values.price);
  const split = Number.isInteger(priceCents) ? splitSale(priceCents) : null;
  const hint = downloadHint(values.linkUrl);
  const categoryName = categories.find((c) => c._id === values.category)?.path;
  const tagsLeft = LISTING_LIMITS.tags - values.tags.length;
  const status = isEdit ? listingStatus(listing) : null;

  return (
    <div>
      {/* ---------- Header ---------- */}
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-stone-600">
          <Link href="/seller/listings" className="underline underline-offset-2 hover:text-black">
            Listings
          </Link>
          <ChevronRight size={14} strokeWidth={2} aria-hidden="true" className="text-stone-400" />
          <span className="text-black">{isEdit ? 'Edit listing' : 'New listing'}</span>
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="headline text-3xl sm:text-4xl">{isEdit ? 'Edit listing' : 'New listing'}</h1>
          {status && <StatusBadge status={status.tone} label={status.label} />}
        </div>
        {isEdit && listing.status !== 'draft' && (
          <p className="mt-3 flex items-start gap-2 text-sm text-stone-600">
            <Info size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700" />
            {listing.status === 'rejected'
              ? 'Fix what needs changing and publish. It goes back to our team for review.'
              : 'Publishing your changes sends this listing back for a quick review. It’s hidden from the store until it’s approved again.'}
          </p>
        )}
      </div>

      {/* ---------- Section tabs (sticky) ---------- */}
      <div className="sticky top-16 z-20 -mx-4 mt-6 border-b border-stone-200 bg-stone-50/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <nav aria-label="Listing sections" className="-mb-px flex gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => {
            const hasError = attempt && s.fields.some((f) => errors[f]);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                aria-current={activeSection === s.id ? 'true' : undefined}
                className={`relative shrink-0 whitespace-nowrap border-b-2 py-4 text-[15px] transition-colors ${
                  activeSection === s.id ? 'border-brand-600 font-medium text-brand-700' : 'border-transparent text-stone-700 hover:text-black'
                }`}
              >
                {s.label}
                {hasError && <span aria-label="has errors" className="absolute -right-2 top-3.5 size-1.5 rounded-full bg-red-500" />}
              </button>
            );
          })}
        </nav>
      </div>

      <form id="listing-form" onSubmit={(e) => (e.preventDefault(), save('publish'))} noValidate className="mt-8 space-y-6 pb-6">
        {/* ---------- Photo & video ---------- */}
        <section id="photos" aria-labelledby="photos-heading" className="scroll-mt-36 lg:scroll-mt-24">
          <Card
            title={<span id="photos-heading">Photo and video</span>}
            description="Show off different angles, preview pages, or a peek at what’s inside."
          >
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Label as="p" required>
                  Add up to {LISTING_LIMITS.photos} photos and {LISTING_LIMITS.videos} videos.
                </Label>
                <span className="text-sm tabular-nums text-stone-500">
                  {values.images.length}/{LISTING_LIMITS.photos} photos · {values.videos.length}/{LISTING_LIMITS.videos} videos
                </span>
              </div>
              <Help>Drag to reorder. The first photo is your cover. It’s what buyers see in search. At least one photo is required.</Help>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex == null) setDropActive('media');
                }}
                onDragLeave={() => setDropActive(null)}
                onDrop={(e) => {
                  setDropActive(null);
                  if (dragIndex != null) return;
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) {
                    if (uploads) addMediaFiles(e.dataTransfer.files);
                    else setMediaError('File uploads aren’t set up on this site yet. Add photos from a link instead.');
                  } else addPhoto(e.dataTransfer.getData('text/uri-list').split('\n')[0] || e.dataTransfer.getData('text/plain'));
                }}
                className={`mt-4 rounded-xl border-2 border-dashed px-5 py-9 text-center transition-colors ${
                  dropActive === 'media'
                    ? 'border-brand-600 bg-brand-50/60'
                    : show('images') || show('videos')
                      ? 'border-red-300 bg-red-50/40'
                      : 'border-stone-300 bg-stone-50'
                }`}
              >
                <p className="font-medium">{uploads ? 'Drag and drop files or' : 'Drag an image here from another tab, or'}</p>
                {uploads ? (
                  <>
                    <button
                      id="media-upload"
                      type="button"
                      onClick={() => mediaInputRef.current?.click()}
                      className="btn btn-md mt-3 bg-stone-200/80 text-black hover:bg-stone-300"
                    >
                      <Upload size={17} strokeWidth={2} aria-hidden="true" />
                      Upload
                    </button>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      multiple
                      accept={MEDIA_ACCEPT}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="hidden"
                      onChange={(e) => {
                        addMediaFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <p className="mt-3 text-xs text-stone-500">
                      Photos: {UPLOAD_RULES.photo.label}, up to {formatBytes(UPLOAD_RULES.photo.maxBytes)} · Videos: {UPLOAD_RULES.video.label}, up to{' '}
                      {formatBytes(UPLOAD_RULES.video.maxBytes)}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-stone-500">paste an image link below. (File uploads aren’t set up on this site yet.)</p>
                )}
              </div>

              {uploads && (
                <button
                  type="button"
                  onClick={() => setShowPhotoLink((v) => !v)}
                  aria-expanded={showPhotoLink}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-stone-600 underline-offset-2 hover:text-black hover:underline"
                >
                  <Link2 size={15} strokeWidth={1.75} aria-hidden="true" />
                  Add a photo from a link instead
                </button>
              )}
              {showPhotoLink && (
                <div className="mt-3 max-w-xl">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label htmlFor="photo-url" className="sr-only">
                      Image link
                    </label>
                    <input
                      id="photo-url"
                      type="url"
                      value={photoUrl}
                      onChange={(e) => (setPhotoUrl(e.target.value), setPhotoError(null))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhoto(photoUrl))}
                      placeholder="https://images.unsplash.com/photo-…"
                      aria-describedby="photo-hosts"
                      className="h-11 w-full min-w-0 rounded-full border border-stone-300 bg-white px-4 text-sm focus:border-ink focus:outline-none sm:flex-1"
                    />
                    <button type="button" onClick={() => addPhoto(photoUrl)} className="btn btn-md btn-outline shrink-0">
                      <Plus size={16} strokeWidth={2} aria-hidden="true" />
                      Add photo
                    </button>
                  </div>
                  <p id="photo-hosts" className="mt-2 text-xs text-stone-500">
                    https links from: {ALLOWED_HOSTS}
                  </p>
                  {photoError && <p className="mt-2 text-sm font-medium text-red-600">{photoError}</p>}
                </div>
              )}
              {mediaError && (
                <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                  {mediaError}
                </p>
              )}
              <ErrorText id="images-error">{show('images')}</ErrorText>
              <ErrorText id="videos-error">{show('videos')}</ErrorText>

              {(values.images.length > 0 || uploading.some((u) => u.kind === 'photo')) && (
                <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Photos">
                  {values.images.map((url, i) => (
                    <li
                      key={url}
                      draggable
                      onDragStart={(e) => (setDragIndex(i), (e.dataTransfer.effectAllowed = 'move'))}
                      onDragEnd={() => setDragIndex(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragIndex != null) movePhoto(dragIndex, i);
                        setDragIndex(null);
                      }}
                      className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl border bg-stone-100 active:cursor-grabbing ${
                        dragIndex === i ? 'opacity-40' : ''
                      } ${i === 0 ? 'border-ink' : 'border-stone-200'}`}
                    >
                      {/* Plain <img>: instant preview without the image optimizer. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Photo ${i + 1}`} className="size-full object-cover" draggable={false} />
                      {i === 0 && (
                        <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-white">Cover</span>
                      )}
                      <button
                        type="button"
                        onClick={() => update('images', (images) => images.filter((u) => u !== url))}
                        aria-label={`Remove photo ${i + 1}`}
                        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/95 text-stone-700 shadow-sm hover:text-red-600"
                      >
                        <X size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                      <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => movePhoto(i, i - 1)}
                          disabled={i === 0}
                          aria-label={`Move photo ${i + 1} earlier`}
                          className="grid size-7 place-items-center rounded-full bg-white/95 shadow-sm disabled:invisible"
                        >
                          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePhoto(i, i + 1)}
                          disabled={i === values.images.length - 1}
                          aria-label={`Move photo ${i + 1} later`}
                          className="grid size-7 place-items-center rounded-full bg-white/95 shadow-sm disabled:invisible"
                        >
                          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                  {uploading
                    .filter((u) => u.kind === 'photo')
                    .map((u) => (
                      <UploadingTile key={u.id} upload={u} />
                    ))}
                </ul>
              )}

              {(values.videos.length > 0 || uploading.some((u) => u.kind === 'video')) && (
                <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Videos">
                  {values.videos.map((url, i) => (
                    <li key={url} className="relative aspect-video overflow-hidden rounded-xl border border-stone-200 bg-black">
                      <video
                        src={url}
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        className="size-full object-contain"
                        aria-label={`Video ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => update('videos', (videos) => videos.filter((v) => v !== url))}
                        aria-label={`Remove video ${i + 1}`}
                        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/95 text-stone-700 shadow-sm hover:text-red-600"
                      >
                        <X size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                  {uploading
                    .filter((u) => u.kind === 'video')
                    .map((u) => (
                      <UploadingTile key={u.id} upload={u} video />
                    ))}
                </ul>
              )}
            </div>
          </Card>
        </section>

        {/* ---------- Item details + attributes ---------- */}
        <section id="details" aria-labelledby="details-heading" className="scroll-mt-36 space-y-6 lg:scroll-mt-24">
          <Card title={<span id="details-heading">Item details</span>} description="Help buyers understand your item better.">
            <div>
              <Label as="p" required>
                Category
              </Label>
              <Help>Pick where your item belongs, so buyers find it under the right category.</Help>
              <CategorySelect
                categories={categories}
                value={values.category}
                // Only a complete pick marks it touched: a main still waiting for its sub isn't an error until Publish.
                onChange={(id) => (update('category', id), id && touch('category'))}
                error={show('category')}
              />
            </div>

            <div className="max-w-2xl">
              <Label htmlFor="title" required>
                Title
              </Label>
              <Help>Make sure your title is easy to understand and clearly describes what you’re selling.</Help>
              <input
                id="title"
                value={values.title}
                maxLength={LISTING_LIMITS.title}
                onChange={(e) => update('title', e.target.value)}
                onBlur={() => touch('title')}
                aria-invalid={Boolean(show('title')) || undefined}
                aria-describedby={show('title') ? 'title-error' : undefined}
                className={inputCls(show('title'))}
              />
              <div className="mt-1.5 flex justify-between gap-4">
                <ErrorText id="title-error">{show('title')}</ErrorText>
                <span className="ml-auto text-sm tabular-nums text-stone-500">
                  {values.title.length}/{LISTING_LIMITS.title}
                </span>
              </div>
            </div>

            <div className="max-w-2xl">
              <Label as="p" required>
                Description
              </Label>
              <Help>What makes your item special? Say what’s included, the formats, and anything buyers need to use it.</Help>
              <RichTextEditor
                id="description"
                value={values.description}
                onChange={(text) => update('description', text)}
                onBlur={() => touch('description')}
                invalid={Boolean(show('description'))}
                describedBy={show('description') ? 'description-error' : undefined}
              />
              <ErrorText id="description-error">{show('description')}</ErrorText>
            </div>

            <div className="max-w-2xl">
              <Label htmlFor="shortDescription">
                Summary <span className="text-sm font-normal text-stone-400">(optional)</span>
              </Label>
              <Help>One line shown under the title and in search results.</Help>
              <input
                id="shortDescription"
                value={values.shortDescription}
                maxLength={LISTING_LIMITS.summary}
                onChange={(e) => update('shortDescription', e.target.value)}
                className={inputCls(show('shortDescription'))}
              />
              <p className="mt-1.5 text-right text-sm tabular-nums text-stone-500">
                {values.shortDescription.length}/{LISTING_LIMITS.summary}
              </p>
            </div>
          </Card>

          <Card
            title="Attributes"
            description="These details help buyers find your item in search as they get specific about what they’re looking for."
          >
            <div>
              <Label htmlFor="tags">Tags</Label>
              <Help>Add up to {LISTING_LIMITS.tags} tags to help people search for your listings.</Help>
              <div className="mt-2 flex max-w-2xl items-center gap-3">
                <input
                  id="tags"
                  value={tagInput}
                  disabled={tagsLeft === 0}
                  onChange={(e) => (e.target.value.endsWith(',') ? addTags(e.target.value) : setTagInput(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTags(tagInput))}
                  placeholder="Style, format, use, software, etc."
                  className={`${inputCls(show('tags'))} mt-0 flex-1 disabled:bg-stone-50`}
                />
                <button
                  type="button"
                  onClick={() => addTags(tagInput)}
                  disabled={!tagInput.trim() || tagsLeft === 0}
                  className="btn btn-md btn-outline shrink-0 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              <p className="mt-2 text-sm text-stone-600">{tagsLeft} left</p>
              <ErrorText id="tags-error">{show('tags')}</ErrorText>
              {values.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Tags">
                  {values.tags.map((t) => (
                    <li key={t} className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm text-stone-700">
                      {t}
                      <button
                        type="button"
                        onClick={() =>
                          update(
                            'tags',
                            values.tags.filter((x) => x !== t),
                          )
                        }
                        aria-label={`Remove tag ${t}`}
                        className="grid size-6 place-items-center rounded-full hover:bg-stone-200"
                      >
                        <X size={13} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </section>

        {/* ---------- Pricing & delivery ---------- */}
        <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-36 space-y-6 lg:scroll-mt-24">
          <Card title={<span id="pricing-heading">Price</span>} description="Set your item price in US dollars. Use 0 for a free item.">
            <div className="grid max-w-xl gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="price" required>
                  Price
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-[1.4rem] text-sm text-stone-500">USD</span>
                  <input
                    id="price"
                    inputMode="decimal"
                    value={values.price}
                    onChange={(e) => update('price', e.target.value)}
                    onBlur={() => touch('price')}
                    placeholder="0.00"
                    aria-invalid={Boolean(show('price')) || undefined}
                    aria-describedby={show('price') ? 'price-error' : undefined}
                    className={`${inputCls(show('price'))} pl-14`}
                  />
                </div>
                <ErrorText id="price-error">{show('price')}</ErrorText>
              </div>
              <div>
                <Label htmlFor="compareAtPrice">
                  Compare-at price <span className="text-sm font-normal text-stone-400">(optional)</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-[1.4rem] text-sm text-stone-500">USD</span>
                  <input
                    id="compareAtPrice"
                    inputMode="decimal"
                    value={values.compareAtPrice}
                    onChange={(e) => update('compareAtPrice', e.target.value)}
                    onBlur={() => touch('compareAtPrice')}
                    placeholder="0.00"
                    className={`${inputCls(show('compareAtPrice'))} pl-14`}
                  />
                </div>
                <ErrorText id="compareAtPrice-error">{show('compareAtPrice')}</ErrorText>
                {!show('compareAtPrice') && <Help>Shown as a strikethrough “was” price.</Help>}
              </div>
            </div>
            {split && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                You earn <span className="font-medium">{priceCents === 0 ? '$0. It’s free' : formatPrice(split.sellerEarning)}</span> per sale
                {NO_PLATFORM_FEE ? ', no platform fees.' : ` after a ${formatPrice(split.commission)} platform fee.`}
              </p>
            )}
          </Card>

          <Card title="Delivery" description="What buyers receive the moment they pay. Files and links stay private until someone buys.">
            <div>
              <Label as="p" required>
                How buyers receive it
              </Label>
              <OptionCards
                name="deliveryType"
                options={DELIVERY_OPTIONS}
                value={values.deliveryType}
                onChange={(v) => update('deliveryType', v)}
                error={show('deliveryType')}
              />
            </div>

            {values.deliveryType === 'external' ? (
              <>
                <div className="max-w-2xl">
                  <Label htmlFor="downloadUrl" required>
                    Link
                  </Label>
                  <Help>The link buyers get after paying, e.g. a Canva template link (https://canva.link/…), a Notion page or a Figma file.</Help>
                  <input
                    id="downloadUrl"
                    value={values.linkUrl}
                    autoComplete="off"
                    onChange={(e) => update('linkUrl', e.target.value)}
                    onBlur={() => touch('downloadUrl')}
                    placeholder="https://canva.link/…"
                    aria-invalid={Boolean(show('downloadUrl')) || undefined}
                    aria-describedby={show('downloadUrl') ? 'downloadUrl-error' : undefined}
                    className={inputCls(show('downloadUrl'))}
                  />
                  <ErrorText id="downloadUrl-error">{show('downloadUrl')}</ErrorText>
                  {hint && !show('downloadUrl') && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs text-sky-800">
                      {hint.text}
                      {hint.fix && (
                        <button type="button" onClick={() => update('linkUrl', hint.fix())} className="font-medium underline underline-offset-2">
                          Fix it
                        </button>
                      )}
                    </p>
                  )}
                </div>
                <div className="max-w-sm">
                  <Label htmlFor="fileFormat">
                    Format <span className="text-sm font-normal text-stone-400">(optional)</span>
                  </Label>
                  <input
                    id="fileFormat"
                    value={values.fileFormat}
                    maxLength={40}
                    onChange={(e) => update('fileFormat', e.target.value)}
                    placeholder="e.g. Canva template, Notion, Figma"
                    className={inputCls(show('fileFormat'))}
                  />
                  <ErrorText id="fileFormat-error">{show('fileFormat')}</ErrorText>
                </div>
              </>
            ) : (
              <div className="max-w-2xl">
                <Label as="p" required>
                  Source file
                </Label>
                <Help>
                  {UPLOAD_RULES.source.label}, up to {formatBytes(UPLOAD_RULES.source.maxBytes)}. Buyers download it from a private link after paying.
                </Help>
                <input
                  ref={sourceInputRef}
                  type="file"
                  accept={SOURCE_ACCEPT}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadSource(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                {sourceProgress != null ? (
                  <div className="mt-3 rounded-xl border border-stone-200 p-4" role="status">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Uploading…</span>
                      <span className="tabular-nums text-stone-500">{sourceProgress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${sourceProgress}%` }} />
                    </div>
                  </div>
                ) : values.fileUrl ? (
                  <div className="mt-3 flex items-center gap-4 rounded-xl border border-stone-200 p-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-700">
                      {extensionOf(values.fileUrl) === 'zip' ? (
                        <FileArchive size={20} strokeWidth={1.75} aria-hidden="true" />
                      ) : (
                        <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {values.sourceFileName || `Your ${extensionOf(values.fileUrl).toUpperCase()} file`}
                      </p>
                      <p className="text-xs text-stone-500">
                        {extensionOf(values.fileUrl).toUpperCase()}
                        {values.fileSize ? ` · ${formatBytes(values.fileSize)}` : ''} · Uploaded
                      </p>
                    </div>
                    <button
                      id="source-upload"
                      type="button"
                      onClick={() => sourceInputRef.current?.click()}
                      disabled={!uploads}
                      className="btn btn-sm btn-outline disabled:opacity-40"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setValues((v) => ({ ...v, fileUrl: '', sourceFileName: '', fileSize: null }));
                        setDirty(true);
                      }}
                      aria-label="Remove file"
                      className="grid size-8 place-items-center rounded-full text-stone-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => (e.preventDefault(), setDropActive('source'))}
                    onDragLeave={() => setDropActive(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDropActive(null);
                      const file = e.dataTransfer.files?.[0];
                      if (file && uploads) uploadSource(file);
                    }}
                    className={`mt-3 rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors ${
                      dropActive === 'source'
                        ? 'border-brand-600 bg-brand-50/60'
                        : show('downloadUrl')
                          ? 'border-red-300 bg-red-50/40'
                          : 'border-stone-300 bg-stone-50'
                    }`}
                  >
                    {uploads ? (
                      <>
                        <p className="font-medium">Drag and drop your PDF or ZIP, or</p>
                        <button
                          id="source-upload"
                          type="button"
                          onClick={() => sourceInputRef.current?.click()}
                          className="btn btn-md mt-3 bg-stone-200/80 text-black hover:bg-stone-300"
                        >
                          <Upload size={17} strokeWidth={2} aria-hidden="true" />
                          Upload file
                        </button>
                      </>
                    ) : (
                      <p className="text-sm text-stone-600">
                        File uploads aren’t set up on this site yet. Choose <span className="font-medium">Add a link</span> to deliver your file from
                        Canva, Google Drive, Dropbox or similar.
                      </p>
                    )}
                  </div>
                )}
                {sourceError && (
                  <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                    {sourceError}
                  </p>
                )}
                <ErrorText id="downloadUrl-error">{show('downloadUrl')}</ErrorText>
              </div>
            )}
          </Card>
        </section>

        {/* ---------- How it's made ---------- */}
        <section id="made" aria-labelledby="made-heading" className="scroll-mt-36 lg:scroll-mt-24">
          <Card
            title={<span id="made-heading">How it’s made</span>}
            description="Buyers want to know who’s behind what they buy. This helps show what makes your item special."
          >
            <div>
              <Label as="p" required>
                Who made it?
              </Label>
              <RadioList name="madeBy" options={MADE_BY} value={values.madeBy} onChange={(v) => update('madeBy', v)} error={show('madeBy')} />
              <ErrorText id="madeBy-error">{show('madeBy')}</ErrorText>
            </div>
            <div>
              <Label as="p" required>
                What is it?
              </Label>
              <RadioList
                name="itemType"
                options={ITEM_TYPES}
                value={values.itemType}
                onChange={(v) => update('itemType', v)}
                error={show('itemType')}
              />
              <ErrorText id="itemType-error">{show('itemType')}</ErrorText>
            </div>
            <div className="max-w-sm">
              <Label htmlFor="madeWhen" required>
                When was it made?
              </Label>
              <div className="relative">
                <select
                  id="madeWhen"
                  value={values.madeWhen}
                  onChange={(e) => update('madeWhen', e.target.value)}
                  aria-invalid={Boolean(show('madeWhen')) || undefined}
                  aria-describedby={show('madeWhen') ? 'madeWhen-error' : undefined}
                  className={`${inputCls(show('madeWhen'))} appearance-none pr-10 ${values.madeWhen ? '' : 'text-stone-500'}`}
                >
                  <option value="" disabled>
                    When was it made?
                  </option>
                  {MADE_WHEN.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-8 -translate-y-1/2 text-stone-600"
                />
              </div>
              <ErrorText id="madeWhen-error">{show('madeWhen')}</ErrorText>
            </div>
          </Card>
        </section>

        {/* ---------- Legal and compliance ---------- */}
        <section id="legal" aria-labelledby="legal-heading" className="scroll-mt-36 lg:scroll-mt-24">
          <Card
            title={<span id="legal-heading">Legal and compliance</span>}
            description="How buyers may use your item, and your confirmation that it’s yours to sell."
          >
            <div>
              <Label as="p" required>
                Licence
              </Label>
              <Help>Shown on the product page so buyers know what they’re allowed to do with it.</Help>
              <OptionCards name="license" options={LICENSES} value={values.license} onChange={(v) => update('license', v)} error={show('license')} />
              <ErrorText id="license-error">{show('license')}</ErrorText>
            </div>
            <div>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${show('rightsConfirmed') ? 'border-red-300 bg-red-50/40' : values.rightsConfirmed ? 'border-ink bg-stone-50' : 'border-stone-200'}`}
              >
                <input
                  id="rightsConfirmed"
                  type="checkbox"
                  checked={values.rightsConfirmed}
                  onChange={(e) => update('rightsConfirmed', e.target.checked)}
                  aria-describedby={show('rightsConfirmed') ? 'rightsConfirmed-error' : undefined}
                  className="mt-0.5 size-5 shrink-0 accent-ink"
                />
                <span className="text-sm leading-relaxed text-stone-700">
                  <span className="font-medium text-black">I have the right to sell this item.</span> I made it, or have permission to sell everything
                  in it, and it follows the{' '}
                  <a href="/terms#acceptable-use" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-black">
                    Terms of Service
                  </a>
                  .
                  <span aria-hidden="true" className="ml-0.5 text-red-600">
                    *
                  </span>
                </span>
              </label>
              <ErrorText id="rightsConfirmed-error">{show('rightsConfirmed')}</ErrorText>
            </div>
          </Card>
        </section>

        {/* ---------- Settings ---------- */}
        <section id="settings" aria-labelledby="settings-heading" className="scroll-mt-36 lg:scroll-mt-24">
          <Card
            title={<span id="settings-heading">Settings</span>}
            description="Choose how this listing shows up in your Listings and when it goes live."
          >
            <div className="flex max-w-2xl items-start justify-between gap-6">
              <div>
                <p className="text-[15px] font-medium">Feature this listing</p>
                <Help>Pin it to the top of your Listings and the Featured filter so it’s always at hand.</Help>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={values.shopFeatured}
                aria-label="Feature this listing"
                onClick={() => update('shopFeatured', !values.shopFeatured)}
                className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors ${values.shopFeatured ? 'border-ink bg-ink' : 'border-stone-300 bg-white'}`}
              >
                <span
                  className={`absolute grid size-6 place-items-center rounded-full transition-all ${values.shopFeatured ? 'left-[1.625rem] bg-white text-ink' : 'left-0.5 bg-stone-400 text-white'}`}
                >
                  <Pin size={12} strokeWidth={2.25} aria-hidden="true" />
                </span>
              </button>
            </div>
            <div>
              <Label as="p" required>
                When it’s approved
              </Label>
              <Help>Every listing is reviewed by our team before it can go live.</Help>
              <RadioList
                name="isPublished"
                value={values.isPublished ? 'auto' : 'manual'}
                onChange={(v) => update('isPublished', v === 'auto')}
                options={[
                  { value: 'auto', label: 'Automatic', text: 'Goes live in the store as soon as it’s approved (recommended).' },
                  { value: 'manual', label: 'Manual', text: 'Stays inactive after approval, I’ll activate it from Listings myself.' },
                ]}
              />
            </div>
          </Card>
        </section>
      </form>

      {/* ---------- Sticky actions ---------- */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-2">
          <Link href="/seller/listings" className="btn btn-md px-3 text-stone-700 hover:bg-stone-100 sm:px-5">
            Cancel
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => previewRef.current?.showModal()} className="btn btn-md btn-outline max-sm:px-3">
              <Eye size={16} strokeWidth={1.75} aria-hidden="true" className="sm:hidden" />
              <span className="max-sm:sr-only">Preview</span>
            </button>
            <button type="button" onClick={() => save('draft')} disabled={Boolean(saving)} className="btn btn-md btn-outline max-sm:px-3.5">
              {saving === 'draft' ? 'Saving…' : 'Save as draft'}
            </button>
            <button type="submit" form="listing-form" disabled={Boolean(saving)} className="btn btn-md btn-dark">
              {saving === 'publish' && (
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {saving === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Preview ---------- */}
      <dialog
        ref={previewRef}
        aria-label="Listing preview"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-auto rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/50"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-3 backdrop-blur">
          <p className="text-sm font-medium">Preview: how buyers will see your listing</p>
          <button
            type="button"
            onClick={() => previewRef.current?.close()}
            aria-label="Close preview"
            className="grid size-9 place-items-center rounded-full hover:bg-stone-100"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
              {values.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={values.images[0]} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-sm text-stone-400">Your cover photo appears here</span>
              )}
            </div>
            {values.videos.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-2">
                {values.videos.map((url) => (
                  <li key={url} className="aspect-video overflow-hidden rounded-lg border border-stone-200 bg-black">
                    <video src={url} controls muted playsInline preload="metadata" className="size-full object-contain" />
                  </li>
                ))}
              </ul>
            )}
            {values.images.length > 1 && (
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {values.images.slice(1).map((url) => (
                  <li key={url} className="aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="size-full object-cover" />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            {categoryName && (
              <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">{categoryName}</span>
            )}
            <h2 className="headline mt-3 text-3xl leading-tight">{values.title || 'Your listing title'}</h2>
            {values.shortDescription && <p className="mt-2 text-stone-600">{values.shortDescription}</p>}
            <p className="mt-4 flex items-baseline gap-3">
              <span className="headline text-3xl tabular-nums">
                {Number.isInteger(priceCents) ? (priceCents === 0 ? 'Free' : formatPrice(priceCents)) : '–'}
              </span>
              {Number.isInteger(toCents(values.compareAtPrice)) && Number.isInteger(priceCents) && toCents(values.compareAtPrice) > priceCents && (
                <span className="text-stone-500 line-through">{formatPrice(toCents(values.compareAtPrice))}</span>
              )}
            </p>
            <dl className="mt-5 divide-y divide-stone-200 rounded-xl border border-stone-200 text-sm">
              {[
                ['Delivery', values.deliveryType === 'external' ? 'Instant access link' : 'Instant digital download'],
                ['Format', values.fileFormat],
                ['Size', values.deliveryType === 'file' && values.fileSize ? formatBytes(values.fileSize) : null],
                ['Licence', labelOf(LICENSES, values.license)],
                ['Made by', labelOf(MADE_BY, values.madeBy)],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-stone-500">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
            </dl>
            {values.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {values.tags.map((t) => (
                  <li key={t} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                    #{t}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="md:col-span-2">
            <h3 className="headline text-xl">About this item</h3>
            {values.description ? (
              <RichText text={values.description} className="mt-2 leading-relaxed text-stone-600" />
            ) : (
              <p className="mt-2 text-stone-400">Your description appears here.</p>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
