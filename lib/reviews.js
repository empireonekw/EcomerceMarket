// Product reviews — rules shared by the review forms (client) and lib/data/reviews.js (server), so both agree.
// Relative imports: models/Review.js (also loaded by plain Node scripts) uses this.
import { REVIEW_LIMITS } from './validation.js';

/** A buyer can change their review this many times after publishing it (to fix mistakes). Admin edits don't count. */
export const REVIEW_EDIT_LIMIT = 3;

/** Why a seller reports a review to Sellpify. */
export const REPORT_REASONS = [
  { value: 'fake', label: 'Fake review or not a real buyer' },
  { value: 'wrong-product', label: 'About a different product or shop' },
  { value: 'offensive', label: 'Offensive, abusive or personal' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'other', label: 'Something else' },
];
export const REPORT_LIMITS = { min: 20, max: 1000 };
export const reportReasonLabel = (value) => REPORT_REASONS.find((r) => r.value === value)?.label ?? 'Other';

export const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** { field: message } for a review's rating (1–5) and text. */
export function reviewProblems({ rating, body }) {
  const fields = {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) fields.rating = 'Choose a rating from 1 to 5 stars.';
  const text = String(body ?? '').trim();
  if (text.length < REVIEW_LIMITS.min) fields.body = `Write at least ${REVIEW_LIMITS.min} characters.`;
  else if (text.length > REVIEW_LIMITS.max) fields.body = `Keep it under ${REVIEW_LIMITS.max} characters.`;
  return fields;
}

/** { field: message } for a seller's report: a reason and their own message to Sellpify. */
export function reportProblems({ reason, message }) {
  const fields = {};
  if (!REPORT_REASONS.some((r) => r.value === reason)) fields.reason = 'Choose why you’re reporting it.';
  const text = String(message ?? '').trim();
  if (text.length < REPORT_LIMITS.min) fields.message = `Tell us what’s wrong in at least ${REPORT_LIMITS.min} characters.`;
  else if (text.length > REPORT_LIMITS.max) fields.message = `Keep it under ${REPORT_LIMITS.max} characters.`;
  return fields;
}
