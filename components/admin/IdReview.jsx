'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, ImageOff, Maximize2, RotateCw, ShieldCheck, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from '@/components/dashboard/Toaster';
import { countryOf } from '@/lib/seller-onboarding';

const STATUS = {
  pending: { label: 'Waiting for review', cls: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-red-600/20' },
};
const SIDES = [
  { key: 'front', label: 'ID front' },
  { key: 'back', label: 'ID back' },
  { key: 'selfie', label: 'Live selfie' },
];
// One tap fills the reason in; the admin can still edit it. Seller-facing, so plain and actionable.
const REASONS = [
  'The photo is blurry. Please upload a sharper one.',
  'Part of the ID card is cut off. Please show the whole card.',
  'The selfie doesn’t match the photo on the ID card.',
  'The name on the ID doesn’t match your account.',
  'The ID card has expired. Please use a valid one.',
];
const day = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

/** One ID file: the picture (rotated), or a calm placeholder when it's a PDF, missing or can't be loaded. */
function DocImage({ src, doc, label, rotate = 0, className = '', onOpen }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!doc)
    return (
      <div className={`grid place-items-center bg-stone-100 text-center text-sm text-stone-500 ${className}`}>
        <span className="px-4">{label} not sent</span>
      </div>
    );
  if (doc.pdf)
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className={`grid place-items-center gap-2 bg-stone-100 text-sm font-medium text-ink hover:bg-stone-200/70 ${className}`}
      >
        <span className="flex flex-col items-center gap-2">
          <FileText size={28} strokeWidth={1.5} aria-hidden="true" />
          Open {label} (PDF)
        </span>
      </a>
    );
  if (failed)
    return (
      <div className={`grid place-items-center bg-stone-100 text-center text-sm text-stone-500 ${className}`}>
        <span className="flex flex-col items-center gap-2 px-4">
          <ImageOff size={24} strokeWidth={1.5} aria-hidden="true" />
          This file couldn’t be loaded.
        </span>
      </div>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative overflow-hidden bg-stone-100 ${className}`}
      aria-label={`Open ${label} full screen`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        onError={() => setFailed(true)}
        className="size-full object-contain transition-transform duration-200"
        style={{ transform: `rotate(${rotate}deg)` }}
      />
      <span className="absolute right-2 bottom-2 hidden items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs text-white group-hover:flex">
        <Maximize2 size={12} strokeWidth={2} aria-hidden="true" />
        Full screen
      </span>
    </button>
  );
}

/** Full-screen viewer: arrow keys switch files, click zooms in at that spot, R rotates, Esc closes. */
function Lightbox({ items, index, setIndex, rotate, setRotate, onClose }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const item = items[index];
  const move = useCallback((d) => (setZoom(false), setIndex((i) => (i + d + items.length) % items.length)), [items.length, setIndex]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key.toLowerCase() === 'r') setRotate(item.key, (rotate[item.key] ?? 0) + 90);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => (document.removeEventListener('keydown', onKey), (document.body.style.overflow = overflow));
  }, [move, onClose, item, rotate, setRotate]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.label}, full screen`}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-medium">
          {item.label}{' '}
          <span className="text-white/50">
            · {index + 1} of {items.length}
          </span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => !z)}
            className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
            aria-label={zoom ? 'Zoom out' : 'Zoom in'}
          >
            {zoom ? <ZoomOut size={18} strokeWidth={1.75} /> : <ZoomIn size={18} strokeWidth={1.75} />}
          </button>
          <button
            type="button"
            onClick={() => setRotate(item.key, (rotate[item.key] ?? 0) + 90)}
            className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
            aria-label="Rotate"
          >
            <RotateCw size={18} strokeWidth={1.75} />
          </button>
          <a
            href={item.src}
            target="_blank"
            rel="noreferrer"
            className="grid size-9 place-items-center rounded-lg hover:bg-white/10"
            aria-label="Open the original file"
          >
            <ExternalLink size={18} strokeWidth={1.75} />
          </a>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Close">
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-14 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.src}
          alt={item.label}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
            setZoom((z) => !z);
          }}
          className={`max-h-full max-w-full object-contain transition-transform duration-200 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          style={{ transform: `rotate(${rotate[item.key] ?? 0}deg) scale(${zoom ? 2.2 : 1})`, transformOrigin: origin }}
        />
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              className="absolute left-3 grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Previous file"
            >
              <ChevronLeft size={22} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              className="absolute right-3 grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              aria-label="Next file"
            >
              <ChevronRight size={22} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Admin → user → Identity check: the seller's ID front, back and live selfie in a large viewer (switch files, compare
 * the selfie with the ID side by side, full screen with zoom and rotate), next to the details they should match, and
 * the decision: verify, or reject with a reason the seller is messaged (quick reasons fill it in).
 */
export default function IdReview({ userId, name, email, shop }) {
  const router = useRouter();
  const toast = useToast();
  const v = shop.verification;
  const status = STATUS[v.status] ?? STATUS.pending;
  const docs = SIDES.map((s) => ({ ...s, doc: v[s.key], src: `/api/admin/users/${userId}/id-document/${s.key}` }));
  const images = docs.filter((d) => d.doc && !d.doc.pdf);

  const [mode, setMode] = useState('documents');
  const [active, setActive] = useState('front');
  const [rotate, setRotateMap] = useState({});
  const setRotate = (key, deg) => setRotateMap((m) => ({ ...m, [key]: deg % 360 }));
  const [lightbox, setLightbox] = useState(null); // index into `images`
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const current = docs.find((d) => d.key === active);
  const openFull = (key) => {
    const i = images.findIndex((d) => d.key === key);
    if (i >= 0) setLightbox(i);
  };

  async function decide(next) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.fields?.note ?? body.error ?? 'Could not save.');
      toast.success(next === 'verified' ? 'Seller verified' : 'Verification rejected. The seller has been messaged.');
      setRejecting(false);
      setNote('');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const a = shop.address;
  const checks = [
    ['Account name', name],
    ['Shop', shop.storeName ?? 'Not opened yet'],
    ['Email', email],
    ['Country', countryOf(shop.preferences?.country)?.name ?? 'Not given'],
    ['Address', a ? [a.line1, a.line2, a.city, a.state, a.postalCode].filter(Boolean).join(', ') : 'Not given'],
    ['Phone', shop.phone ? `${shop.phone.dial} ${shop.phone.number}` : 'Not given'],
  ];

  return (
    <section
      id="identity"
      className={`scroll-mt-24 rounded-2xl border bg-white ${v.status === 'pending' ? 'border-brand-400 shadow-[0_18px_40px_-28px_rgba(201,133,0,0.8)]' : 'border-stone-200'}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-100 text-brand-800">
            <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Identity check</h2>
            <p className="text-xs text-stone-500">
              Sent {day(v.submittedAt) ?? 'on an unknown date'}
              {v.reviewedAt && ` · reviewed ${day(v.reviewedAt)}`}
            </p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${status.cls}`}>{status.label}</span>
      </header>
      {v.status === 'rejected' && v.note && (
        <p className="mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-medium">Reason sent to the seller:</span> {v.note}
        </p>
      )}

      <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ---------- Viewer ---------- */}
        <div className="min-w-0">
          <div role="tablist" aria-label="View" className="mb-3 inline-flex rounded-xl bg-stone-100 p-1">
            {[
              ['documents', 'Documents'],
              ['compare', 'Compare selfie with ID'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === key ? 'bg-white text-ink shadow-[0_1px_2px_rgba(16,16,16,0.08)]' : 'text-stone-500 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'documents' ? (
            <>
              <div className="relative">
                <DocImage
                  src={current.src}
                  doc={current.doc}
                  label={current.label}
                  rotate={rotate[current.key] ?? 0}
                  onOpen={() => openFull(current.key)}
                  className="aspect-[4/3] w-full rounded-xl"
                />
                {current.doc && !current.doc.pdf && (
                  <button
                    type="button"
                    onClick={() => setRotate(current.key, (rotate[current.key] ?? 0) + 90)}
                    className="absolute top-2 right-2 grid size-9 place-items-center rounded-lg bg-white/90 text-ink shadow-sm hover:bg-white"
                    aria-label={`Rotate ${current.label}`}
                  >
                    <RotateCw size={16} strokeWidth={1.75} />
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {docs.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setActive(d.key)}
                    aria-pressed={d.key === active}
                    className={`overflow-hidden rounded-xl border-2 text-left transition-colors ${d.key === active ? 'border-ink' : 'border-transparent hover:border-stone-300'}`}
                  >
                    <span
                      aria-hidden="true"
                      className="block aspect-[4/3] w-full bg-stone-100 bg-cover bg-center"
                      style={d.doc && !d.doc.pdf ? { backgroundImage: `url(${d.src})` } : undefined}
                    />
                    <span className="block px-2 py-1.5 text-xs font-medium text-stone-700">
                      {d.label}
                      {!d.doc && <span className="text-stone-400"> · not sent</span>}
                      {d.doc?.pdf && <span className="text-stone-400"> · PDF</span>}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {['selfie', 'front'].map((key) => {
                const d = docs.find((x) => x.key === key);
                return (
                  <figure key={key}>
                    <DocImage
                      src={d.src}
                      doc={d.doc}
                      label={d.label}
                      rotate={rotate[key] ?? 0}
                      onOpen={() => openFull(key)}
                      className="aspect-[3/4] w-full rounded-xl"
                    />
                    <figcaption className="mt-2 text-center text-xs font-medium text-stone-600">{d.label}</figcaption>
                  </figure>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-stone-500">
            Click a picture for full screen: zoom in on the details, rotate a sideways photo, use the arrow keys to switch.
          </p>
        </div>

        {/* ---------- What to check + decision ---------- */}
        <div className="flex min-w-0 flex-col">
          <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">Should match the ID</p>
          <dl className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 text-sm">
            {checks.map(([k, val]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
                <dt className="shrink-0 text-stone-500">{k}</dt>
                <dd className="min-w-0 text-right font-medium break-words text-ink [overflow-wrap:anywhere]">{val}</dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 space-y-1 text-xs text-stone-500">
            <li>· The selfie is the same person as the photo on the ID.</li>
            <li>· The name on the ID matches the account name.</li>
            <li>· Both sides are sharp, complete and not expired.</li>
          </ul>

          <div className="mt-auto pt-5">
            {rejecting ? (
              <div className="rounded-xl border border-stone-200 p-3.5">
                <p className="text-sm font-medium text-ink">Why is it rejected?</p>
                <p className="text-xs text-stone-500">The seller gets this message and can send their ID again.</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNote(r)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${note === r ? 'border-ink bg-ink text-white' : 'border-stone-200 text-stone-700 hover:border-stone-400'}`}
                    >
                      {r.split('.')[0]}
                    </button>
                  ))}
                </div>
                <label htmlFor="reject-note" className="sr-only">
                  Reason
                </label>
                <textarea
                  id="reject-note"
                  rows={3}
                  maxLength={300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Or write your own reason"
                  className="mt-3 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-ink focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={saving || note.trim().length < 5}
                    onClick={() => decide('rejected')}
                    className="btn btn-md flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject and message seller
                  </button>
                  <button type="button" disabled={saving} onClick={() => setRejecting(false)} className="btn btn-md btn-outline">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {v.status !== 'verified' && (
                  <button type="button" disabled={saving} onClick={() => decide('verified')} className="btn btn-lg btn-dark w-full">
                    <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                    Verify this seller
                  </button>
                )}
                {v.status !== 'rejected' && (
                  <button type="button" disabled={saving} onClick={() => setRejecting(true)} className="btn btn-md btn-outline w-full">
                    Reject…
                  </button>
                )}
                {v.status === 'verified' && (
                  <p className="text-center text-xs text-stone-500">Verified sellers show a blue tick and can request payouts.</p>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>

      {lightbox !== null && images.length > 0 && (
        <Lightbox items={images} index={lightbox} setIndex={setLightbox} rotate={rotate} setRotate={setRotate} onClose={() => setLightbox(null)} />
      )}
    </section>
  );
}
