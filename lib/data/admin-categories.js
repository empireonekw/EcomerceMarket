import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { CATEGORY_TYPES, categorySlug, MAX_CATEGORY_LEVELS, orderTree, RESERVED_ROOT_SLUGS, SLUG_RE, subtreeLevels } from '@/lib/category-tree';
import { InputError } from '@/lib/data/product-writes';
import { escapeRegex, toPlain } from '@/lib/utils';
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
    Category.find().select('name slug description parent sortOrder isActive type metaTitle metaDescription').lean(),
    Product.aggregate([{ $match: { status: { $ne: 'draft' } } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));
  return orderTree(toPlain(categories)).map((c) => ({ ...c, count: countById.get(c._id) ?? 0 }));
}

/** Validates { name, slug, parent, description, type, metaTitle, metaDescription } for a new category (id omitted) or an existing one. */
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
  const type = CATEGORY_TYPES.some((t) => t.value === input?.type) ? input.type : 'digital';
  const metaTitle = String(input?.metaTitle ?? '').trim();
  if (metaTitle.length > 70) fields.metaTitle = 'Keep the SEO title under 70 characters.';
  const metaDescription = String(input?.metaDescription ?? '').trim();
  if (metaDescription.length > 160) fields.metaDescription = 'Keep the SEO description under 160 characters.';

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

  // Slugs are URL segments (/main/sub/inner): unique among siblings, and a main one can't shadow a site page.
  const taken = slug && !fields.slug && tree.find((c) => c.slug === slug && (c.parent ?? null) === parentId && c._id !== id);
  if (taken) fields.slug = `“${taken.name}” already uses this slug at this level.`;
  else if (!parentId && RESERVED_ROOT_SLUGS.has(slug)) fields.slug = `“${slug}” is used by a page on the site — choose another slug for a main category.`;
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);
  return { name, slug, parent: parentId, type, optional: { description, metaTitle, metaDescription }, tree };
}

const duplicateSlug = (err) =>
  err?.code === 11000 ? new InputError('Please fix the highlighted fields.', { slug: 'That slug is already used at this level.' }, 409) : err;

/** Adds a category at the end of its siblings. */
export async function createCategory(input) {
  const { tree, optional, ...data } = await cleanInput(input);
  const siblings = tree.filter((c) => (c.parent ?? null) === data.parent);
  const filled = Object.fromEntries(Object.entries(optional).filter(([, v]) => v));
  try {
    const doc = await Category.create({ ...data, ...filled, sortOrder: Math.max(0, ...siblings.map((c) => c.sortOrder ?? 0)) + 1 });
    return toPlain(doc.toObject());
  } catch (err) {
    throw duplicateSlug(err);
  }
}

const PATH_LEVELS = ['main', 'sub', 'inner'];

/**
 * Admin → Categories "Add New Category": { main, sub?, inner?, slug?, description?, type?, metaTitle?, metaDescription? }
 * typed as names. Levels above the new one are reused when a sibling has that name (or slug) and created otherwise;
 * the deepest level is the new category and gets the slug, description, type and SEO fields.
 * Field errors are reported on main / sub / inner.
 */
export async function createCategoryFromPath(input) {
  const names = PATH_LEVELS.map((k) => String(input?.[k] ?? '').trim().replace(/\s+/g, ' '));
  const fields = {};
  if (!names[0]) fields.main = 'Enter a main category.';
  if (names[2] && !names[1]) fields.sub = 'Enter a sub category before the inner category.';
  names.forEach((n, i) => n.length > 60 && (fields[PATH_LEVELS[i]] = 'Keep the name under 60 characters.'));
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);

  const depth = names.filter(Boolean).length - 1; // 0 = new main, 1 = new sub, 2 = new inner
  const level = PATH_LEVELS[depth];
  let parent = null;
  if (depth > 0) {
    try {
      parent = (await ensureCategoryPath({ main: names[0], sub: depth > 1 ? names[1] : '' })).id;
    } catch (err) {
      if (err instanceof InputError && err.fields?.category) throw new InputError(err.message, { main: err.fields.category }, err.status);
      throw err;
    }
  }

  try {
    const doc = await createCategory({ ...input, name: names[depth], parent });
    return { ...doc, path: names.filter(Boolean).join(' › ') };
  } catch (err) {
    if (!(err instanceof InputError)) throw err;
    const { name, parent: parentError, ...rest } = err.fields ?? {};
    const levelError = name ?? parentError ?? (rest.slug?.includes('already uses this slug') ? `“${names[depth]}” already exists here.` : undefined);
    throw new InputError(err.message, { ...rest, ...(levelError && { [level]: levelError }) }, err.status);
  }
}

/** Renames / re-slugs / moves a category (never inside itself or its own sub-categories). */
export async function updateCategory(id, input) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('Category not found.', {}, 404);
  await connectDB();
  if (!(await Category.exists({ _id: id }))) throw new InputError('Category not found.', {}, 404);
  const { tree: _, optional, ...data } = await cleanInput(input, String(id));
  // Empty optional fields are removed rather than stored as "".
  const set = { ...data };
  const unset = {};
  for (const [key, value] of Object.entries(optional)) {
    if (value) set[key] = value;
    else unset[key] = 1;
  }
  try {
    const update = Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set };
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
  const children = await Category.find({ parent: cat._id }).select('slug name').lean();
  if (children.length) {
    const clash = await Category.findOne({ parent: cat.parent ?? null, slug: { $in: children.map((c) => c.slug) }, _id: { $ne: cat._id } })
      .select('name slug')
      .lean();
    if (clash) throw new InputError(`Its sub-category “${children.find((c) => c.slug === clash.slug).name}” would clash with “${clash.name}” one level up. Rename one of them first.`, {}, 409);
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

/**
 * Admin product form: "Main / Sub / Inner" typed as names. Each level reuses the sibling with the same name or slug,
 * and creates it otherwise (new categories inherit their parent's type). Returns the deepest category's id.
 * Throws InputError({ category }) for an incomplete or unusable path. Callers authorize (admin only).
 */
export async function ensureCategoryPath({ main, sub, inner } = {}) {
  const names = [main, sub, inner].map((n) => String(n ?? '').trim().replace(/\s+/g, ' '));
  if (!names[0]) throw new InputError('Category is required', { category: 'Enter a main category.' });
  if (names[2] && !names[1]) throw new InputError('Sub-category missing', { category: 'Enter a sub-category before the inner category.' });
  if (names.some((n) => n.length > 60)) throw new InputError('Category name too long', { category: 'Keep category names under 60 characters.' });

  await connectDB();
  let parent = null;
  let created = false;
  for (const name of names.filter(Boolean)) {
    const slug = categorySlug(name);
    if (!slug) throw new InputError('Invalid category name', { category: `“${name}” needs at least one letter or number.` });
    let category =
      (await Category.findOne({ parent: parent?._id ?? null, name: new RegExp(`^${escapeRegex(name)}$`, 'i') }).lean()) ??
      (await Category.findOne({ parent: parent?._id ?? null, slug }).lean());
    if (!category) {
      if (!parent && RESERVED_ROOT_SLUGS.has(slug)) {
        throw new InputError('Reserved name', { category: `“${name}” is already a page on the site — choose another main category name.` });
      }
      category = (await Category.create({ name, slug, parent: parent?._id ?? null, type: parent?.type ?? 'digital' })).toObject();
      created = true;
    }
    parent = category;
  }
  return { id: parent._id, created };
}
