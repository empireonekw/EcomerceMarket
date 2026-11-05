import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { publicName, toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { importedReviewProblems, importedSaleProblems } from '@/lib/imported';
import ImportedSale from '@/models/ImportedSale';
import ImportedReview from '@/models/ImportedReview';
import User from '@/models/User';

// Sales and reviews from the seller's other shop (lib/imported.js). The add / list / delete functions are UNGUARDED: call
// them after checking for an admin session (app/api/admin/users/[id]/imported).

const isId = (v) => mongoose.isValidObjectId(v);
const fail = (fields) => new InputError('Please fix the highlighted fields.', fields);

async function requireSeller(sellerId) {
  if (!isId(sellerId)) throw new InputError('Seller not found.', {}, 404);
  await connectDB();
  if (!(await User.exists({ _id: sellerId, role: 'seller' }))) throw new InputError('Seller not found.', {}, 404);
}

/** Admin: everything imported for a seller, newest first (with the admin's notes). */
export async function getImportedRecords(sellerId) {
  if (!isId(sellerId)) return { sales: [], reviews: [] };
  await connectDB();
  const [sales, reviews] = await Promise.all([
    ImportedSale.find({ seller: sellerId }).sort({ createdAt: -1 }).lean(),
    ImportedReview.find({ seller: sellerId }).sort({ createdAt: -1 }).lean(),
  ]);
  return toPlain({ sales, reviews });
}

/** Admin: add `count` sales. */
export async function addImportedSale(sellerId, input, adminId) {
  const entry = { count: Number(input?.count), note: String(input?.note ?? '').trim() };
  const problems = importedSaleProblems(entry);
  if (Object.keys(problems).length) throw fail(problems);
  await requireSeller(sellerId);
  return toPlain(await ImportedSale.create({ ...entry, seller: sellerId, addedBy: adminId }));
}

/** Admin: add one review. */
export async function addImportedReview(sellerId, input, adminId) {
  const entry = {
    authorName: String(input?.authorName ?? '').trim(),
    rating: Number(input?.rating),
    body: String(input?.body ?? '').trim(),
    reviewedAt: input?.reviewedAt,
    note: String(input?.note ?? '').trim(),
  };
  const problems = importedReviewProblems(entry);
  if (Object.keys(problems).length) throw fail(problems);
  await requireSeller(sellerId);
  return toPlain(await ImportedReview.create({ ...entry, reviewedAt: new Date(entry.reviewedAt), seller: sellerId, addedBy: adminId }));
}

/** Admin: remove one imported entry (`kind` 'sale' | 'review') of this seller. */
export async function deleteImportedRecord(sellerId, kind, entryId) {
  const Model = kind === 'sale' ? ImportedSale : kind === 'review' ? ImportedReview : null;
  if (!Model || !isId(sellerId) || !isId(entryId)) throw new InputError('Not found.', {}, 404);
  await connectDB();
  const { deletedCount } = await Model.deleteOne({ _id: entryId, seller: sellerId });
  if (!deletedCount) throw new InputError('Not found.', {}, 404);
  return { deleted: true };
}

/**
 * Public: a seller's imported totals for their shop card, without the admin notes:
 * { sales, reviews: { count, ratingSum }, recent: [{ rating, body, authorName, reviewedAt }] }.
 */
export async function getImportedSummary(sellerId) {
  const empty = { sales: 0, reviews: { count: 0, ratingSum: 0 }, recent: [] };
  if (!isId(sellerId)) return empty;
  await connectDB();
  const seller = new mongoose.Types.ObjectId(String(sellerId));
  const [sales, reviews, recent] = await Promise.all([
    ImportedSale.aggregate([{ $match: { seller } }, { $group: { _id: null, n: { $sum: '$count' } } }]),
    ImportedReview.aggregate([{ $match: { seller } }, { $group: { _id: null, count: { $sum: 1 }, ratingSum: { $sum: '$rating' } } }]),
    ImportedReview.find({ seller }).select('rating body authorName reviewedAt').sort({ reviewedAt: -1 }).limit(2).lean(),
  ]);
  return toPlain({
    sales: sales[0]?.n ?? 0,
    reviews: { count: reviews[0]?.count ?? 0, ratingSum: reviews[0]?.ratingSum ?? 0 },
    recent: recent.map((r) => ({ ...r, authorName: publicName(r.authorName), imported: true })),
  });
}
