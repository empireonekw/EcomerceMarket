'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/dashboard/Toaster';
import { slugify, formatPrice } from '@/lib/utils';
import { isAllowedImageUrl, isLocalMediaPath } from '@/lib/image-hosts';
import { downloadHint, filesProblem, isUploadedSource } from '@/lib/listing';
import { listingCategoryProblem } from '@/lib/category-tree';
import CategorySelect from '@/components/CategorySelect';
import DigitalFilesInput from '@/components/DigitalFilesInput';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONEY_RE = /^\d{1,6}(\.\d{1,2})?$/;

const isHttpsUrl = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};
const toCents = (dollars) => Math.round(Number.parseFloat(dollars) * 100);
const toDollars = (cents) => (cents == null ? '' : (cents / 100).toFixed(2).replace(/\.00$/, ''));
const parseTags = (s) => [...new Set(s.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];

function validate(v, categories) {
  const e = {};
  if (!v.title.trim()) e.title = 'Title is required.';
  else if (v.title.length > 140) e.title = 'Keep the title under 140 characters.';

  if (v.slug && !SLUG_RE.test(v.slug)) e.slug = 'Use lowercase letters, numbers and single hyphens only.';
  if (!v.category) e.category = 'Choose a category.';
  else if (listingCategoryProblem(v.category, categories)) e.category = listingCategoryProblem(v.category, categories);

  if (v.price === '') e.price = 'Price is required (use 0 for a free product).';
  else if (!MONEY_RE.test(v.price)) e.price = 'Enter a valid amount, e.g. 19 or 19.99.';

  if (v.compareAtPrice !== '') {
    if (!MONEY_RE.test(v.compareAtPrice)) e.compareAtPrice = 'Enter a valid amount.';
    else if (MONEY_RE.test(v.price) && Number(v.compareAtPrice) <= Number(v.price)) e.compareAtPrice = 'Must be higher than the price.';
  }

  if (v.coverImage) {
    if (!isHttpsUrl(v.coverImage) && !isLocalMediaPath(v.coverImage)) e.coverImage = 'Must be an https:// image URL.';
    else if (!isAllowedImageUrl(v.coverImage)) {
      e.coverImage = `Host “${new URL(v.coverImage, 'https://x').hostname}” isn’t allowed for images. Add it to lib/image-hosts.js or use an allowed host.`;
    }
  }

  if (v.deliveryType === 'external') {
    if (!v.downloadUrl.trim()) e.downloadUrl = 'An access link is required.';
    else if (!isHttpsUrl(v.downloadUrl)) e.downloadUrl = 'Access links must be secure https:// URLs.';
  } else if (!v.files.length && !v.legacyFile) {
    e.files = 'Upload at least one file buyers will download.';
  } else if (filesProblem(v.files)) e.files = filesProblem(v.files);

  if (v.shortDescription.length > 280) e.shortDescription = 'Keep the summary under 280 characters.';
  if (v.description.trim().length < 20) e.description = 'Write at least 20 characters so buyers know what they get.';
  else if (v.description.length > 20000) e.description = 'Description is too long.';

  const tags = parseTags(v.tags);
  if (tags.length > 20) e.tags = 'Use at most 20 tags.';
  else if (tags.some((t) => t.length > 30)) e.tags = 'Each tag must be 30 characters or fewer.';
  return e;
}

// ---------------------------------------------------------------------------
// Field primitives
// ---------------------------------------------------------------------------

const inputBase = 'mt-1.5 w-full rounded-xl border bg-white px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20';
const inputCls = (err) => `${inputBase} h-11 ${err ? 'border-red-400 focus:border-red-500' : 'border-stone-300 focus:border-ink'}`;

function Field({ id, label, hint, error, optional, children }) {
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium">
        {label}
        {optional && <span className="text-xs font-normal text-stone-400">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>
      )}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <h2 className="font-medium">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

const DONE_URL = '/admin/products';

/**
 * Admin product form (sellers use components/seller/ListingForm.jsx).
 * @param {{ mode: 'create' | 'edit', categories: Array<{ _id, name, slug }>, product?: object, uploads: 'blob' | 'local' | null }} props
 */
export default function ProductForm({ mode, categories, product, uploads }) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = mode === 'edit';

  const [values, setValues] = useState(() => {
    return {
      title: product?.title ?? '',
      slug: product?.slug ?? '',
      category: product?.category?._id ?? '',
      price: toDollars(product?.price),
      compareAtPrice: toDollars(product?.compareAtPrice),
      coverImage: product?.coverImage ?? '',
      deliveryType: product?.deliveryType ?? 'file',
      // Access link (deliveryType 'external'); uploaded files are in `files`.
      downloadUrl: product?.deliveryType === 'external' ? (product?.downloadUrl ?? '') : '',
      files: product?.deliveryType === 'external' ? [] : (product?.files ?? []),
      // An older product delivering a typed link or storage key: kept until files are uploaded.
      legacyFile: product?.deliveryType !== 'external' && product?.downloadUrl && !isUploadedSource(product.downloadUrl) ? product.downloadUrl : '',
      fileFormat: product?.fileFormat ?? '',
      shortDescription: product?.shortDescription ?? '',
      description: product?.description ?? '',
      tags: (product?.tags ?? []).join(', '),
      isPublished: product?.isPublished ?? true,
      isFeatured: product?.isFeatured ?? false,
    };
  });
  // New products: slug follows the title until the admin edits it. Existing products keep their URL.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false); // file uploads still running

  const errors = useMemo(() => ({ ...validate(values, categories), ...serverErrors }), [values, categories, serverErrors]);
  const show = (key) => (touched[key] || submitted ? errors[key] : undefined);

  function update(key, value) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      if (key === 'title' && !slugTouched) next.slug = slugify(value);
      return next;
    });
    if (serverErrors[key]) setServerErrors(({ [key]: _, ...rest }) => rest);
    if (key === 'coverImage') setPreviewBroken(false);
  }

  const bind = (key) => ({
    id: key,
    name: key,
    value: values[key],
    onChange: (e) => update(key, e.target.value),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    'aria-invalid': Boolean(show(key)) || undefined,
    'aria-describedby': show(key) ? `${key}-error` : undefined,
  });

  async function onSubmit(e) {
    e.preventDefault();
    if (filesBusy) {
      toast.error('Uploads still in progress', 'Wait for your files to finish uploading, then save.');
      return;
    }
    setSubmitted(true);
    const clientErrors = validate(values, categories);
    if (Object.keys(clientErrors).length) {
      toast.error('Please fix the highlighted fields');
      const first = Object.keys(clientErrors)[0];
      // Category: focus the dropdown still to be filled in (the sub one once a main is picked).
      const focusId = first === 'files' ? 'source-upload' : first === 'category' && document.getElementById('category')?.value ? 'category-sub' : first;
      document.getElementById(focusId)?.focus();
      return;
    }

    const payload = {
      title: values.title.trim(),
      category: values.category,
      price: toCents(values.price),
      compareAtPrice: values.compareAtPrice === '' ? null : toCents(values.compareAtPrice),
      coverImage: values.coverImage.trim() || null,
      fileFormat: values.fileFormat.trim() || null,
      shortDescription: values.shortDescription.trim() || null,
      description: values.description.trim(),
      tags: parseTags(values.tags),
      slug: values.slug || undefined,
      deliveryType: values.deliveryType,
      ...(values.deliveryType === 'external'
        ? { downloadUrl: values.downloadUrl.trim() }
        : values.files.length || !values.legacyFile
          ? { files: values.files } // the server sets downloadUrl from these
          : {}), // nothing uploaded yet: the older delivery stays as it is
      isPublished: values.isPublished,
      isFeatured: values.isFeatured,
    };
    if (!isEdit) for (const k of Object.keys(payload)) if (payload[k] === null) delete payload[k];

    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/products/${product._id}` : '/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        toast.error('Your session expired', 'Please sign in again.');
        router.push('/login?next=' + encodeURIComponent(window.location.pathname));
        return;
      }
      if (!res.ok) {
        setServerErrors(data.fields ?? {});
        toast.error(isEdit ? 'Could not save changes' : 'Could not create product', data.error);
        setSaving(false);
        return;
      }

      toast.success(isEdit ? 'Changes saved' : 'Product created', `“${data.title}” · /products/${data.slug}`);
      router.push(DONE_URL);
      router.refresh();
    } catch {
      toast.error('Network error', 'Check your connection and try again.');
      setSaving(false);
    }
  }

  const tags = parseTags(values.tags);
  const hint = downloadHint(values.downloadUrl);
  const coverOk = values.coverImage && !errors.coverImage && !previewBroken;
  const priceOk = MONEY_RE.test(values.price);
  const picked = categories.find((c) => c._id === values.category);
  const categoryName = picked?.name;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[1fr_20rem] xl:items-start">
      <div className="space-y-6">
        {/* ---------- Basics ---------- */}
        <Section title="Basics" description="What you’re selling and where it lives in the store.">
          <Field id="title" label="Title" error={show('title')}>
            <input {...bind('title')} maxLength={140} placeholder="e.g. Ultimate Notion Budget Planner" className={inputCls(show('title'))} />
          </Field>

          <Field
            id="slug"
            label="URL slug"
            error={show('slug')}
            hint={isEdit ? 'Changing the slug changes the product URL. Old links will stop working.' : 'Generated from the title. Edit it if you like; duplicates get a -2 suffix.'}
          >
            <div className="mt-1.5 flex items-stretch overflow-hidden rounded-xl border border-stone-300 bg-stone-50 focus-within:border-ink">
              <span className="hidden items-center px-3 text-sm text-stone-500 sm:flex">/products/</span>
              <input
                {...bind('slug')}
                onChange={(e) => {
                  setSlugTouched(true);
                  update('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
                placeholder="ultimate-notion-budget-planner"
                className="h-11 min-w-0 flex-1 bg-white px-3.5 text-sm focus:outline-none"
              />
              {!isEdit && slugTouched && (
                <button
                  type="button"
                  onClick={() => {
                    setSlugTouched(false);
                    update('slug', slugify(values.title));
                  }}
                  className="border-l border-stone-200 px-3 text-xs font-medium text-stone-500 hover:text-ink"
                >
                  Reset
                </button>
              )}
            </div>
          </Field>

          <fieldset>
            <legend className="text-sm font-medium">Category</legend>
            <p className="mt-0.5 text-xs text-stone-500">
              Pick the main category, then its sub category. Inner is optional.{' '}
              <Link href="/admin/categories" className="font-medium text-brand-700 hover:underline">
                Manage categories
              </Link>
            </p>
            <CategorySelect
              size="md"
              className="mt-3"
              categories={categories}
              value={values.category}
              onChange={(id) => {
                update('category', id);
                if (id) setTouched((t) => ({ ...t, category: true }));
              }}
              error={show('category')}
            />
            {picked && <p className="mt-2 break-all font-mono text-xs text-stone-500">Category page: /{picked.slugPath}</p>}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="fileFormat" label="File format" optional hint="Shown to buyers, e.g. “PDF + EPUB” or “Figma”.">
              <input {...bind('fileFormat')} maxLength={40} placeholder="ZIP (SVG, AI, EPS)" className={inputCls()} />
            </Field>
          </div>
        </Section>

        {/* ---------- Pricing ---------- */}
        <Section title="Pricing" description="Prices are in US dollars. Use 0 for a free product.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="price" label="Price (USD)" error={show('price')}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 mt-0.75 -translate-y-1/2 text-sm text-stone-500">$</span>
                <input {...bind('price')} inputMode="decimal" placeholder="19.99" className={`${inputCls(show('price'))} pl-7`} />
              </div>
            </Field>
            <Field id="compareAtPrice" label="Compare-at price" optional error={show('compareAtPrice')} hint="Shows as a strikethrough “was” price.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 mt-0.75 -translate-y-1/2 text-sm text-stone-500">$</span>
                <input {...bind('compareAtPrice')} inputMode="decimal" placeholder="29.99" className={`${inputCls(show('compareAtPrice'))} pl-7`} />
              </div>
            </Field>
          </div>
        </Section>

        {/* ---------- Media & delivery ---------- */}
        <Section title="Media & delivery" description="The cover buyers see, and the file they receive after paying.">
          <Field
            id="coverImage"
            label="Cover image URL"
            optional
            error={show('coverImage')}
            hint="https link to a 4:3 image (e.g. Unsplash, S3, R2)."
          >
            <input {...bind('coverImage')} type="url" placeholder="https://images.unsplash.com/photo-…" className={inputCls(show('coverImage'))} />
          </Field>
          <div className="relative aspect-[4/3] w-full max-w-xs overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
            {coverOk ? (
              // Plain <img> on purpose: instant preview of any URL while typing, without the image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.coverImage} alt="Cover preview" className="size-full object-cover" onError={() => setPreviewBroken(true)} />
            ) : (
              <div className="grid size-full place-items-center p-4 text-center text-xs text-stone-400">
                {previewBroken ? 'Couldn’t load this image. Check the URL.' : 'Image preview appears here'}
              </div>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Delivery type</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { value: 'file', label: 'File download', text: 'Upload up to 5 files (20 MB each) that buyers download.' },
                { value: 'external', label: 'Access link', text: 'Buyers get a link: Notion, Figma, Google Drive, Dropbox, a course portal…' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors ${
                    values.deliveryType === opt.value ? 'border-ink bg-stone-50' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryType"
                    value={opt.value}
                    checked={values.deliveryType === opt.value}
                    onChange={() => update('deliveryType', opt.value)}
                    className="mt-0.5 accent-ink"
                  />
                  <span>
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-stone-500">{opt.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {values.deliveryType === 'external' ? (
            <Field id="downloadUrl" label="Secure access URL" error={show('downloadUrl')} hint="Private: only revealed to buyers after purchase.">
              <input {...bind('downloadUrl')} placeholder="https://www.notion.so/…" className={inputCls(show('downloadUrl'))} autoComplete="off" />
            </Field>
          ) : (
            <div>
              <p className="text-sm font-medium">Digital files</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Up to 5 files, 20 MB each. File names (letters, numbers, periods, underscores, hyphens; up to 70) are what buyers see and can’t be
                changed after upload. Private: delivered only through signed links after purchase.
              </p>
              {values.legacyFile && !values.files.length && (
                <p className="mt-2 break-all rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Currently delivers <span className="font-mono">{values.legacyFile}</span>. It stays until you upload files here.
                </p>
              )}
              <DigitalFilesInput
                files={values.files}
                onChange={(change) => {
                  setValues((v) => ({ ...v, files: change(v.files) }));
                  if (serverErrors.files) setServerErrors(({ files: _, ...rest }) => rest);
                }}
                onBusy={setFilesBusy}
                driver={uploads}
                error={show('files')}
                otherBytes={product?.mediaBytes ?? 0}
              />
            </div>
          )}
          {values.deliveryType === 'external' && hint && !show('downloadUrl') && (
            <div className="-mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs text-sky-800">
              {hint.text}
              {hint.fix && (
                <button type="button" onClick={() => update('downloadUrl', hint.fix())} className="font-medium underline underline-offset-2">
                  Fix it
                </button>
              )}
            </div>
          )}
        </Section>

        {/* ---------- Description ---------- */}
        <Section title="Description & tags">
          <Field id="shortDescription" label="Summary" optional error={show('shortDescription')} hint={`${values.shortDescription.length}/280 · Shown under the title and in search results.`}>
            <input {...bind('shortDescription')} maxLength={280} placeholder="One sentence that sells it." className={inputCls(show('shortDescription'))} />
          </Field>
          <Field id="description" label="Detailed description" error={show('description')} hint="Line breaks are preserved. Explain what’s included, formats and requirements.">
            <textarea
              {...bind('description')}
              rows={8}
              className={`${inputBase} py-3 leading-relaxed ${show('description') ? 'border-red-400' : 'border-stone-300 focus:border-ink'}`}
            />
          </Field>
          <Field id="tags" label="Tags" optional error={show('tags')} hint="Comma-separated, e.g. notion, budget, finance">
            <input {...bind('tags')} placeholder="notion, budget, finance" className={inputCls(show('tags'))} />
          </Field>
          {tags.length > 0 && (
            <ul className="-mt-2 flex flex-wrap gap-1.5" aria-label="Tag preview">
              {tags.map((t) => (
                <li key={t} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  #{t}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ---------- Sidebar: visibility, preview, actions ---------- */}
      <aside className="space-y-6 xl:sticky xl:top-10">
        <Section title="Visibility">
          {[
            { key: 'isPublished', label: 'Published', text: 'Visible in the store and purchasable.' },
            { key: 'isFeatured', label: 'Featured', text: 'Prioritised in featured placements.' },
          ].map((opt) => (
            <label key={opt.key} className="flex cursor-pointer items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">{opt.label}</span>
                <span className="block text-xs text-stone-500">{opt.text}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={values[opt.key]}
                onChange={(e) => update(opt.key, e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-brand-600"
              />
            </label>
          ))}
        </Section>

        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wide text-stone-400">Card preview</p>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
            {coverOk && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={values.coverImage} alt="" className="size-full object-cover" />
            )}
            {categoryName && (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-stone-700 shadow-sm">{categoryName}</span>
            )}
          </div>
          <div className="px-1 pt-3">
            <p className="line-clamp-2 font-medium">{values.title || 'Untitled product'}</p>
            <p className="mt-1 font-medium">{priceOk ? (toCents(values.price) === 0 ? 'Free' : formatPrice(toCents(values.price))) : '–'}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-lg btn-primary"
          >
            {saving && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create product'}
          </button>
          <Link href={DONE_URL} className="flex h-11 items-center justify-center rounded-full text-sm font-medium text-stone-600 hover:bg-stone-100">
            Cancel
          </Link>
        </div>
      </aside>
    </form>
  );
}
