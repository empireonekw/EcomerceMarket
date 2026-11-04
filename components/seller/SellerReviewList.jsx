'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Flag } from 'lucide-react';
import Stars from '@/components/Stars';
import { useToast } from '@/components/dashboard/Toaster';
import { FieldError, FormAlert, SubmitButton, inputClass } from '@/components/auth/AuthFields';
import { REPORT_LIMITS, REPORT_REASONS, reportProblems, reportReasonLabel } from '@/lib/reviews';

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const REPORT_STATE = {
  open: { label: 'Reported · waiting for Sellpify', cls: 'bg-amber-50 text-amber-800' },
  kept: { label: 'Reviewed by Sellpify · kept', cls: 'bg-stone-100 text-stone-600' },
  edited: { label: 'Reviewed by Sellpify · corrected', cls: 'bg-sky-50 text-sky-800' },
  removed: { label: 'Removed by Sellpify', cls: 'bg-red-50 text-red-700' },
};

/** "Report to Sellpify": why (a reason) and the seller's own message, for the admins who review it. */
function ReportDialog({ review, onReported }) {
  const dialogRef = useRef(null);
  const id = useId();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const found = reportProblems({ reason, message });
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? 'Could not send your report.');
        return;
      }
      dialogRef.current?.close();
      toast.success('Report sent', 'We’ll look at it and message you in your inbox.');
      onReported();
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn btn-sm btn-outline">
        <Flag size={14} strokeWidth={1.75} aria-hidden="true" />
        Report
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.target === e.currentTarget && !pending && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <form onSubmit={onSubmit} noValidate className="space-y-5 p-6 sm:p-8">
          <div>
            <h2 id={`${id}-title`} className="headline text-2xl">
              Report this review
            </h2>
            <p className="mt-1 text-sm text-stone-500">Sellpify’s team checks it and can correct or remove it. The buyer isn’t told who reported it.</p>
          </div>
          <blockquote className="rounded-xl border-l-4 border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            <Stars rating={review.rating} size={13} />
            <p className="mt-1 line-clamp-3">{review.body}</p>
          </blockquote>
          <FormAlert>{formError}</FormAlert>

          <fieldset>
            <legend className="text-sm font-medium text-stone-800">Why are you reporting it?</legend>
            <div className="mt-2 space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${reason === r.value ? 'border-ink bg-stone-50' : 'border-stone-200 hover:border-stone-400'}`}
                >
                  <input type="radio" name={`${id}-reason`} value={r.value} checked={reason === r.value} onChange={() => (setReason(r.value), setErrors(({ reason: _, ...rest }) => rest))} className="accent-ink" />
                  {r.label}
                </label>
              ))}
            </div>
            <FieldError id={`${id}-reason-error`}>{errors.reason}</FieldError>
          </fieldset>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor={`${id}-message`} className="text-sm font-medium text-stone-800">
                Your message to Sellpify
              </label>
              <span className="text-xs tabular-nums text-stone-400">
                {message.trim().length}/{REPORT_LIMITS.max}
              </span>
            </div>
            <textarea
              id={`${id}-message`}
              rows={4}
              maxLength={REPORT_LIMITS.max}
              value={message}
              onChange={(e) => (setMessage(e.target.value), setErrors(({ message: _, ...rest }) => rest))}
              placeholder="What’s wrong with it? e.g. This person never bought from us: the order number they mention doesn’t exist."
              aria-invalid={Boolean(errors.message) || undefined}
              className={`${inputClass(errors.message)} h-auto! resize-none py-3 leading-relaxed`}
            />
            <FieldError id={`${id}-message-error`}>{errors.message}</FieldError>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="btn btn-md text-stone-700 hover:bg-stone-100">
              Cancel
            </button>
            <div className="w-44">
              <SubmitButton pending={pending} pendingLabel="Sending…">
                Send report
              </SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** Seller → Reviews list: each review with its product, and Report (or where its report stands). */
export default function SellerReviewList({ items }) {
  const router = useRouter();
  return (
    <ul className="space-y-3">
      {items.map((r) => {
        const state = r.report ? REPORT_STATE[r.report.status] : r.hidden ? REPORT_STATE.removed : null;
        return (
          <li key={r.id} className={`rounded-2xl border bg-white p-5 ${r.hidden ? 'border-red-100 opacity-75' : 'border-stone-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/products/${r.productSlug}#reviews`} className="line-clamp-1 text-sm font-medium text-ink hover:underline">
                  {r.productTitle}
                </Link>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
                  <Stars rating={r.rating} size={14} />
                  <span className="font-medium text-stone-700">{r.authorName}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <BadgeCheck size={12} strokeWidth={2} aria-hidden="true" />
                    Verified purchase
                  </span>
                  <span>· {fmtDate(r.createdAt)}</span>
                  {r.edited && <span>· Edited</span>}
                </p>
              </div>
              {state ? (
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${state.cls}`}>{state.label}</span>
              ) : (
                <ReportDialog review={r} onReported={() => router.refresh()} />
              )}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700">{r.body}</p>
            {r.report && (
              <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">
                You reported it: {reportReasonLabel(r.report.reason)} · {fmtDate(r.report.reportedAt)}
                {r.report.note && <span className="mt-1 block text-stone-700">Sellpify: {r.report.note}</span>}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
