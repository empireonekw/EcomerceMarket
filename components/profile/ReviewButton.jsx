'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import Stars from '@/components/Stars';
import { FieldError, FormAlert, SubmitButton, inputClass } from '@/components/auth/AuthFields';
import { REVIEW_LIMITS } from '@/lib/validation';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/**
 * My Purchases → "Write a review" for one product (verified purchase), or the rating already given.
 * Reviews are public with the buyer's name, which the form says up front.
 */
export default function ReviewButton({ productId, productTitle, authorName, existingRating }) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const id = useId();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  if (existingRating) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-stone-500">
        <Stars rating={existingRating} size={14} />
        Reviewed
      </span>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const found = {};
    if (!rating) found.rating = 'Choose a rating from 1 to 5 stars.';
    if (body.trim().length < REVIEW_LIMITS.min) found.body = `Write at least ${REVIEW_LIMITS.min} characters.`;
    setErrors(found);
    if (Object.keys(found).length) return;

    setPending(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
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
      router.refresh(); // the row switches to "Reviewed"
    } catch {
      setFormError('Network error — please try again.');
    } finally {
      setPending(false);
    }
  }

  const shown = hover || rating;
  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn btn-sm btn-outline">
        <Star size={14} strokeWidth={1.75} aria-hidden="true" />
        Write a review
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
              Review {productTitle}
            </h2>
            <p className="mt-1 text-sm text-stone-500">Thanks for helping other buyers decide.</p>
          </div>
          <FormAlert>{formError}</FormAlert>

          <fieldset>
            <legend className="text-sm font-medium text-stone-800">Your rating</legend>
            <div className="mt-2 flex items-center gap-3" onMouseLeave={() => setHover(0)}>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} onMouseEnter={() => setHover(n)} className="cursor-pointer rounded-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500">
                    <input type="radio" name={`${id}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
                    <Star size={28} strokeWidth={1.5} aria-hidden="true" className={n <= shown ? 'fill-amber-400 text-amber-400' : 'fill-stone-100 text-stone-300'} />
                    <span className="sr-only">
                      {n} star{n === 1 ? '' : 's'} — {LABELS[n]}
                    </span>
                  </label>
                ))}
              </div>
              <span className="text-sm text-stone-500">{LABELS[shown]}</span>
            </div>
            <FieldError id={`${id}-rating-error`}>{errors.rating}</FieldError>
          </fieldset>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor={`${id}-body`} className="text-sm font-medium text-stone-800">
                Your review
              </label>
              <span className="text-xs tabular-nums text-stone-400">
                {body.trim().length}/{REVIEW_LIMITS.max}
              </span>
            </div>
            <textarea
              id={`${id}-body`}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={REVIEW_LIMITS.max}
              placeholder="What did you use it for? What stood out?"
              aria-invalid={Boolean(errors.body) || undefined}
              className={`${inputClass(errors.body)} h-auto! resize-none py-3 leading-relaxed`}
            />
            <FieldError id={`${id}-body-error`}>{errors.body}</FieldError>
          </div>

          <p className="rounded-xl bg-stone-50 px-4 py-3 text-xs leading-relaxed text-stone-600">
            Your review will be shown publicly on our homepage with your name, <strong className="font-medium text-stone-800">{authorName}</strong>, and a
            “Verified buyer” badge.
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="btn btn-md text-stone-700 hover:bg-stone-100">
              Cancel
            </button>
            <div className="w-44">
              <SubmitButton pending={pending} pendingLabel="Publishing…">
                Publish review
              </SubmitButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
