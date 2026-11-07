'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilLine, Star } from 'lucide-react';
import { FieldError, FormAlert, SubmitButton, inputClass } from '@/components/auth/AuthFields';
import { RATING_LABELS, REVIEW_EDIT_LIMIT, reviewProblems } from '@/lib/reviews';
import { REVIEW_LIMITS } from '@/lib/validation';
import { publicName } from '@/lib/utils';

/** 1–5 star picker (radio buttons under the hood: arrow keys work). */
export function StarInput({ id, value, onChange, size = 30 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="mt-2 flex items-center gap-3" onMouseLeave={() => setHover(0)}>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} onMouseEnter={() => setHover(n)} className="cursor-pointer rounded-md transition-transform hover:scale-110 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-700">
            <input type="radio" name={`${id}-rating`} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
            <Star size={size} strokeWidth={1.5} aria-hidden="true" className={n <= shown ? 'fill-amber-400 text-amber-400' : 'fill-stone-100 text-stone-300'} />
            <span className="sr-only">
              {n} star{n === 1 ? '' : 's'}: {RATING_LABELS[n]}
            </span>
          </label>
        ))}
      </div>
      <span className="min-w-[5.5rem] text-sm font-medium text-stone-600">{RATING_LABELS[shown]}</span>
    </div>
  );
}

/**
 * Write a review, or edit your own (REVIEW_EDIT_LIMIT times, to fix mistakes). `review` = the existing one
 * ({ id, rating, body, editsLeft }) to edit; otherwise a new review of `productId`. `trigger` = 'button' | 'link'.
 * After saving: `onSaved(review)` when given, else the page refreshes.
 */
export default function ReviewDialog({ productId, productTitle, authorName, review, onSaved, trigger = 'button', className = '' }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const id = useId();
  const editing = Boolean(review);
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [body, setBody] = useState(review?.body ?? '');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);
  const editsLeft = review?.editsLeft ?? REVIEW_EDIT_LIMIT;

  function open() {
    setRating(review?.rating ?? 0);
    setBody(review?.body ?? '');
    setErrors({});
    setFormError(null);
    dialogRef.current?.showModal();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const found = reviewProblems({ rating, body });
    setErrors(found);
    if (Object.keys(found).length) return;
    if (editing && rating === review.rating && body.trim() === review.body) return setFormError('Change something first, or press Cancel.');

    setPending(true);
    try {
      const res = await fetch(editing ? `/api/reviews/${review.id}` : '/api/reviews', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, rating, body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? 'Could not save your review.');
        return;
      }
      dialogRef.current?.close();
      if (onSaved) onSaved(data);
      else router.refresh();
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const disabled = editing && editsLeft <= 0;
  return (
    <>
      {trigger === 'link' ? (
        <button type="button" onClick={open} disabled={disabled} className={`inline-flex items-center gap-1 text-sm font-medium text-ink underline-offset-2 hover:underline disabled:text-stone-400 disabled:no-underline ${className}`}>
          <PencilLine size={14} strokeWidth={1.75} aria-hidden="true" />
          {disabled ? 'No edits left' : 'Edit'}
        </button>
      ) : (
        <button type="button" onClick={open} disabled={disabled} className={`btn btn-sm ${editing ? 'btn-outline' : 'btn-dark'} disabled:opacity-50 ${className}`}>
          {editing ? <PencilLine size={14} strokeWidth={1.75} aria-hidden="true" /> : <Star size={14} strokeWidth={1.75} aria-hidden="true" />}
          {editing ? (disabled ? 'No edits left' : `Edit review (${editsLeft} left)`) : 'Write a review'}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.target === e.currentTarget && !pending && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <form onSubmit={onSubmit} noValidate className="space-y-5 p-6 sm:p-8">
          <div>
            <h2 id={`${id}-title`} className="headline text-2xl">
              {editing ? 'Edit your review' : 'Write a review'}
            </h2>
            <p className="mt-1 line-clamp-1 text-sm text-stone-500">{productTitle}</p>
          </div>
          {editing && (
            <p className={`rounded-xl px-4 py-3 text-sm ${editsLeft === 1 ? 'bg-amber-50 text-amber-900' : 'bg-stone-50 text-stone-600'}`}>
              {editsLeft === 1
                ? 'This is your last edit, so check everything before you save.'
                : `You can edit this review ${editsLeft} more times, to fix mistakes. It shows as “Edited”.`}
            </p>
          )}
          <FormAlert>{formError}</FormAlert>

          <fieldset>
            <legend className="text-sm font-medium text-stone-800">Your rating</legend>
            <StarInput id={id} value={rating} onChange={(n) => (setRating(n), setErrors(({ rating: _, ...rest }) => rest))} />
            <FieldError id={`${id}-rating-error`}>{errors.rating}</FieldError>
          </fieldset>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor={`${id}-body`} className="text-sm font-medium text-stone-800">
                Your review
              </label>
              <span className={`text-xs tabular-nums ${body.trim().length < REVIEW_LIMITS.min ? 'text-stone-400' : 'text-emerald-700'}`}>
                {body.trim().length}/{REVIEW_LIMITS.max}
              </span>
            </div>
            <textarea
              id={`${id}-body`}
              rows={5}
              value={body}
              onChange={(e) => (setBody(e.target.value), setErrors(({ body: _, ...rest }) => rest))}
              maxLength={REVIEW_LIMITS.max}
              placeholder="What did you use it for? What stood out? Would you recommend it?"
              aria-invalid={Boolean(errors.body) || undefined}
              aria-describedby={`${id}-body-hint`}
              className={`${inputClass(errors.body)} h-auto! resize-none py-3 leading-relaxed`}
            />
            <FieldError id={`${id}-body-error`}>{errors.body}</FieldError>
            {!errors.body && (
              <p id={`${id}-body-hint`} className="mt-2 text-xs text-stone-500">
                At least {REVIEW_LIMITS.min} characters.
              </p>
            )}
          </div>

          <p className="rounded-xl bg-stone-50 px-4 py-3 text-xs leading-relaxed text-stone-600">
            Shown publicly on the product page with your name, <strong className="font-medium text-stone-800">{publicName(authorName)}</strong>, and a
            “Verified purchase” badge.{!editing && ` After publishing you can still edit it ${REVIEW_EDIT_LIMIT} times.`}
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="btn btn-md text-stone-700 hover:bg-stone-100">
              Cancel
            </button>
            <div className="w-44">
              <SubmitButton pending={pending} pendingLabel="Saving…">
                {editing ? 'Save changes' : 'Publish review'}
              </SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
