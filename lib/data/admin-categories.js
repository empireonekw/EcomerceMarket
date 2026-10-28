import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { categorySlug, MAX_CATEGORY_LEVELS, orderTree, SLUG_RE, subtreeLevels } from '@/lib/category-tree';
import { InputError } from '@/lib/data/product-writes';
import { toPlain } from '@/lib/utils';
import Category from '@/models/Category';
import Product from '@/models/Product';

// Admin → Categories. Reads authorize themselves; writes are called by /api/admin/categories routes,
// which authorize first.

export const BULK_CATEGORIES_MAX = 100;

/** Every category in tree order with `count` = products directly in it (any status except seller drafts). */
export async function getAdminCategories() {
  await requireAdmin();
  return loadTree();
}

async function loadTree() {
  await connectDB();
  const [categories, counts] = await Promise.all([
    Category.find().select('name slug description parent sortOrder isActive').lean(),
    Product.aggregate([{ $match: { status: { $ne: 'draft' } } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));
  return orderTree(toPlain(categories)).map((c) => ({ ...c, count: countById.get(c._id) ?? 0 }));
}

/** Validates { name, slug, parent, description } for a new category (id omitted) or an existing one. */
async function cleanInput(input, id) {
  const fields = {};
  const name = String(input?.name ?? '').trim();
  if (!name) fields.name = 'Enter a name.';
  else if (name.length > 60) fields.name = 'Keep the name under 60 characters.';

  const slug = categorySlug(input?.slug || name);
  if (!slug) fields.slug = 'Enter a slug (letters, numbers and hyphens).';
  else if (!SLUG_RE.test(slug)) fields.slug = 'Use lowercase letters, numbers and hyphens only.';

  const description = String(input?.description ?? '').trim();
  if (description.length > 300) fields.description = 'Keep the description under 300 characters.';

  const tree = await loadTree();
  const parentId = input?.parent ? String(input.parent) : null;
  if (parentId) {
    const parent = mongoose.isValidObjectId(parentId) && tree.find((c) => c._id === parentId);
    if (!parent) fields.parent = 'That parent category no longer exists.';
    else if (id && (parentId === id || parent.ancestors.includes(id)))
      fields.parent = 'A category can’t be placed inside itself or its own sub-categories.';
    // The category (and everything below it) must still fit: deepest level = parent's depth + levels it brings.
    else if (parent.depth + (id ? subtreeLevels(id, tree) : 1) > MAX_CATEGORY_LEVELS - 1)
      fields.parent = `Categories go at most ${MAX_CATEGORY_LEVELS} levels deep (main › sub › inner).`;
  }

  const taken = slug && tree.find((c) => c.slug === slug && c._id !== id);
  if (taken) fields.slug = `That slug is already used by “${taken.name}”.`;
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  return { name, slug, description: description || undefined, parent: parentId, tree };
}

const duplicateSlug = (err) =>
  err?.code === 11000 ? new InputError('Please fix the highlighted fields.', { slug: 'That slug is already in use.' }, 409) : err;

/** Adds a category at the end of its siblings. */
export async function createCategory(input) {
  const { tree, ...data } = await cleanInput(input);
  const siblings = tree.filter((c) => (c.parent ?? null) === data.parent);
  try {
    const doc = await Category.create({ ...data, sortOrder: Math.max(0, ...siblings.map((c) => c.sortOrder ?? 0)) + 1 });
    return toPlain(doc.toObject());
  } catch (err) {
    throw duplicateSlug(err);
  }
}

/** Renames / re-slugs / moves a category (never inside itself or its own sub-categories). */
export async function updateCategory(id, input) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('Category not found.', {}, 404);
  await connectDB();
  if (!(await Category.exists({ _id: id }))) throw new InputError('Category not found.', {}, 404);
  const { tree: _, description, ...data } = await cleanInput(input, String(id));
  try {
    const update = description ? { $set: { ...data, description } } : { $set: data, $unset: { description: 1 } };
    const doc = await Category.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true }).lean();
    return toPlain(doc);
  } catch (err) {
    throw duplicateSlug(err);
  }
}

/**
 * Deletes one category, WordPress-style: its sub-categories move up to its parent, and its products move to its
 * parent too. A main category that still has products is refused (products always need a category).
 */
async function deleteOne(id) {
  const cat = await Category.findById(id).select('name parent').lean();
  if (!cat) throw new InputError('Category not found.', {}, 404);
  const products = await Product.countDocuments({ category: cat._id });
  if (products > 0 && !cat.parent) {
    throw new InputError(`“${cat.name}” still has ${products} product${products === 1 ? '' : 's'}. Move them to another category first.`, {}, 409);
  }
  let moved = 0;
  await mongoose.connection.transaction(async (session) => {
    if (products > 0) moved = (await Product.updateMany({ category: cat._id }, { $set: { category: cat.parent } }, { session })).modifiedCount;
    await Category.updateMany({ parent: cat._id }, { $set: { parent: cat.parent ?? null } }, { session });
    await Category.deleteOne({ _id: cat._id }, { session });
  });
  return { id: String(cat._id), name: cat.name, productsMoved: moved };
}

/**
 * Deletes several categories (deepest first, so sub-categories hand their products up before their parent goes).
 * One that can't be deleted is skipped with the reason; the rest still go. Returns { deleted, skipped }.
 */
export async function deleteCategories(ids) {
  const unique = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String))];
  if (!unique.length) throw new InputError('Select at least one category.');
  if (unique.length > BULK_CATEGORIES_MAX) throw new InputError(`Select at most ${BULK_CATEGORIES_MAX} categories at a time.`);
  const tree = await loadTree();
  const depthOf = new Map(tree.map((c) => [c._id, c.depth]));
  const ordered = unique.filter((id) => mongoose.isValidObjectId(id)).sort((a, b) => (depthOf.get(b) ?? 0) - (depthOf.get(a) ?? 0));

  const deleted = [];
  const skipped = [];
  for (const id of ordered) {
    try {
      deleted.push(await deleteOne(id));
    } catch (err) {
      if (!(err instanceof InputError)) throw err;
      skipped.push({ id, name: tree.find((c) => c._id === id)?.name ?? 'Unknown category', reason: err.message });
    }
  }
  return { deleted, skipped };
}
