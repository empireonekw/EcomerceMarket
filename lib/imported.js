// Sales and reviews a seller earned outside Sellpify (their other shop), added by an admin after checking the proof
// the seller sent. Shown as "from the seller's other shop", never as Sellpify purchases.
// Shared by the admin form (components/admin/ImportedRecordsPanel.jsx) and the server (lib/data/imported.js).

export const IMPORT_LIMITS = { sales: 1_000_000, name: 60, review: 2000, note: 300 };

/** Problems with an "add sales" entry, as { field: message } (empty when it's fine). */
export function importedSaleProblems({ count, note }) {
  const e = {};
  if (!Number.isInteger(count) || count < 1 || count > IMPORT_LIMITS.sales) e.count = 'Enter a whole number of sales (1 or more).';
  if (!String(note ?? '').trim()) e.note = 'Say how you checked it (e.g. "Etsy sales screenshot, sent in Messages").';
  else if (String(note).length > IMPORT_LIMITS.note) e.note = `Keep it under ${IMPORT_LIMITS.note} characters.`;
  return e;
}

/** Problems with an "add review" entry, as { field: message } (empty when it's fine). */
export function importedReviewProblems({ authorName, rating, body, reviewedAt, note }) {
  const e = {};
  if (!String(authorName ?? '').trim()) e.authorName = 'Enter the reviewer’s name.';
  else if (String(authorName).length > IMPORT_LIMITS.name) e.authorName = `Keep it under ${IMPORT_LIMITS.name} characters.`;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) e.rating = 'Choose 1 to 5 stars.';
  const text = String(body ?? '').trim();
  if (text.length < 2) e.body = 'Paste the review text.';
  else if (text.length > IMPORT_LIMITS.review) e.body = `Keep it under ${IMPORT_LIMITS.review} characters.`;
  const date = new Date(reviewedAt);
  if (!reviewedAt || Number.isNaN(date.getTime()) || date > new Date()) e.reviewedAt = 'Enter the date it was written.';
  if (!String(note ?? '').trim()) e.note = 'Say how you checked it.';
  else if (String(note).length > IMPORT_LIMITS.note) e.note = `Keep it under ${IMPORT_LIMITS.note} characters.`;
  return e;
}
