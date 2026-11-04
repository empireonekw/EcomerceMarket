import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { InputError, updateProduct } from '@/lib/data/product-writes';
import { sendSystemMessage } from '@/lib/data/messages';
import { siteConfig } from '@/lib/site';
import Product from '@/models/Product';

// Admin moderation of seller listings, one or many at once (Admin → Products). UNGUARDED: callers authorize first.

export const MODERATION_STATUSES = ['approved', 'rejected'];
const MAX_AT_ONCE = 500;

const quoted = (titles) => titles.map((t) => `“${t}”`).join(', ');

/** The "From Sellpify" message a seller gets about their listings that were just approved / rejected. */
export function moderationMessage(status, titles) {
  const one = titles.length === 1;
  if (status === 'approved') {
    return one
      ? `Good news. Your listing ${quoted(titles)} was approved and is now live on ${siteConfig.name}.`
      : `Good news. ${titles.length} of your listings were approved and are now live on ${siteConfig.name}: ${quoted(titles)}.`;
  }
  return `${one ? `Your listing ${quoted(titles)} wasn’t` : `${titles.length} of your listings weren’t`} approved${one ? '' : `: ${quoted(titles)}`}. Please review our listing guidelines, update ${one ? 'it' : 'them'} and submit again. Questions? Reply through the contact page.`;
}

/**
 * Approves or rejects many listings: `ids` (the admin's selection), or `all: true` = every listing awaiting review.
 * Each goes through updateProduct (same checks as one at a time); each seller gets ONE message for all of theirs.
 * @returns {{ updated: number, failed: { id, title, error }[], slugs: string[] }}
 */
export async function moderateProducts({ ids, all = false, status }) {
  if (!MODERATION_STATUSES.includes(status)) throw new InputError('Choose approve or reject.');
  let filter;
  if (all) {
    if (status !== 'approved') throw new InputError('Only “Approve all” is available for every listing at once.');
    filter = { status: 'pending' };
  } else {
    const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
    if (!list.length) throw new InputError('Select at least one product.');
    if (list.length > MAX_AT_ONCE || !list.every((id) => mongoose.isValidObjectId(id))) throw new InputError('Invalid selection.');
    filter = { _id: { $in: list }, status: status === 'approved' ? { $in: ['pending', 'rejected'] } : 'pending' }; // live ones stay live
  }

  await connectDB();
  const products = await Product.find(filter).select('_id title').sort({ createdAt: 1 }).limit(MAX_AT_ONCE).lean();
  const bySeller = new Map();
  const failed = [];
  const slugs = [];
  for (const { _id, title } of products) {
    try {
      const { product } = await updateProduct(String(_id), { status });
      slugs.push(product.slug);
      if (product.sellerId) {
        const key = String(product.sellerId);
        bySeller.set(key, [...(bySeller.get(key) ?? []), product.title]);
      }
    } catch (err) {
      failed.push({ id: String(_id), title, error: err instanceof InputError ? Object.values(err.fields ?? {})[0] || err.message : 'Could not update.' });
      if (!(err instanceof InputError)) console.error('[moderateProducts]', String(_id), err);
    }
  }
  for (const [sellerId, titles] of bySeller) await sendSystemMessage(sellerId, moderationMessage(status, titles));
  return { updated: slugs.length, failed, slugs };
}
