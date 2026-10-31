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
  else if (!parentId && RESERVED_ROOT_SLUGS.has(slug)) fields.slug = `“${slug}” is used by a page on the site. Choose another slug for a main category.`;
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

export const GROUP_LIMITS = { subs: 50, inners: 50 };
const cleanName = (n) => String(n ?? '').trim().replace(/\s+/g, ' ');
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
const sameSlug = (a, b) => categorySlug(a) === categorySlug(b); // "Notion" and "notion!" would share a URL

/**
 * Admin → Categories "Add New Category": one main category plus at least one sub category, each with any number of
 * (optional) inner categories, all as typed names:
 *   { main, subs: [{ name, inners: [name] }], description?, type?, metaTitle?, metaDescription? }
 * A name that already exists at its level (same name or slug among its siblings) is reused, so the same form adds
 * subs to an existing main or inners to an existing sub. The optional fields describe the main category when it's
 * new; new subs and inners take their parent's type. Everything is created together or not at all.
 * Field errors: `main`, `subs` (the list), `sub-<i>` (a sub's name), `inners-<i>` (a sub's inner categories).
 * Returns { created: [paths], reused, path }.
 */
export async function createCategoryGroup(input) {
  const main = cleanName(input?.main);
  const subs = (Array.isArray(input?.subs) ? input.subs : [])
    .map((s) => ({ name: cleanName(s?.name), inners: (Array.isArray(s?.inners) ? s.inners : []).map(cleanName).filter(Boolean) }))
    .filter((s) => s.name || s.inners.length);

  const fields = {};
  const checkName = (name, key) => {
    if (name.length > 60) fields[key] = `Keep “${name.slice(0, 20)}…” under 60 characters.`;
    else if (!categorySlug(name)) fields[key] = `“${name}” needs at least one letter or number.`;
  };
  if (!main) fields.main = 'Enter a main category.';
  else checkName(main, 'main');
  if (!subs.length) fields.subs = 'Add at least one sub category.';
  else if (subs.length > GROUP_LIMITS.subs) fields.subs = `Add up to ${GROUP_LIMITS.subs} sub categories at a time.`;
  subs.forEach((sub, i) => {
    if (!sub.name) fields[`sub-${i}`] = 'Enter the sub category’s name.';
    else if (subs.findIndex((o) => sameSlug(o.name, sub.name)) < i) fields[`sub-${i}`] = `“${sub.name}” is already in this list.`;
    else checkName(sub.name, `sub-${i}`);
    if (sub.inners.length > GROUP_LIMITS.inners) fields[`inners-${i}`] = `Add up to ${GROUP_LIMITS.inners} inner categories per sub category.`;
    const twin = sub.inners.find((n, k) => sub.inners.findIndex((o) => sameSlug(o, n)) < k);
    if (twin) fields[`inners-${i}`] = `“${twin}” is in this list twice.`;
    sub.inners.forEach((n) => checkName(n, `inners-${i}`));
  });

  const description = String(input?.description ?? '').trim();
  const metaTitle = String(input?.metaTitle ?? '').trim();
  const metaDescription = String(input?.metaDescription ?? '').trim();
  if (description.length > 300) fields.description = 'Keep the description under 300 characters.';
  if (metaTitle.length > 70) fields.metaTitle = 'Keep the SEO title under 70 characters.';
  if (metaDescription.length > 160) fields.metaDescription = 'Keep the SEO description under 160 characters.';
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);

  const tree = await loadTree();
  const childrenOf = (parentId) => tree.filter((c) => (c.parent ?? null) === parentId);
  const existing = (name, parentId) =>
    childrenOf(parentId).find((c) => sameName(c.name, name)) ?? childrenOf(parentId).find((c) => c.slug === categorySlug(name));

  const mainCat = existing(main, null);
  if (!mainCat && RESERVED_ROOT_SLUGS.has(categorySlug(main)))
    throw new InputError('Please fix the highlighted fields.', { main: `“${main}” is already a page on the site. Choose another name.` });

  // The live database is a single MongoDB server (no replica set), so there are no transactions: each category is
  // saved in turn, and if one fails the ones this request already created are removed again (all or nothing).
  const created = [];
  const createdIds = [];
  let reused = 0;
  let mainName = mainCat?.name ?? main;
  const nextOrder = (parentId) => Math.max(0, ...childrenOf(parentId).map((c) => c.sortOrder ?? 0)) + 1;
  const add = async (name, parent, extra, sortOrder, path) => {
    const data = { name, slug: categorySlug(name), parent: parent?._id ?? null, type: parent?.type ?? 'digital', sortOrder, ...extra };
    const doc = await Category.create(data);
    createdIds.push(doc._id);
    created.push(path);
    return doc.toObject();
  };
  try {
    let mainDoc = mainCat;
    if (mainDoc) reused += 1;
    else {
      const type = CATEGORY_TYPES.some((t) => t.value === input?.type) ? input.type : 'digital';
      const optional = Object.fromEntries(Object.entries({ description, metaTitle, metaDescription }).filter(([, v]) => v));
      mainDoc = await add(main, null, { type, ...optional }, nextOrder(null), main);
    }

    mainName = mainDoc.name;
    const mainId = String(mainDoc._id);
    let subOrder = nextOrder(mainId);
    for (const sub of subs) {
      let subDoc = existing(sub.name, mainId);
      if (subDoc) reused += 1;
      else subDoc = await add(sub.name, mainDoc, {}, subOrder++, `${mainDoc.name} › ${sub.name}`);

      const subId = String(subDoc._id);
      let innerOrder = nextOrder(subId);
      for (const inner of sub.inners) {
        if (existing(inner, subId)) reused += 1;
        else await add(inner, subDoc, {}, innerOrder++, `${mainDoc.name} › ${subDoc.name} › ${inner}`);
      }
    }
  } catch (err) {
    if (createdIds.length) await Category.deleteMany({ _id: { $in: createdIds } }).catch(() => {});
    if (err?.code !== 11000) throw err;
    throw new InputError('Please fix the highlighted fields.', { subs: 'One of these names was just added by someone else. Reload and try again.' }, 409);
  }
  if (!created.length) throw new InputError('These categories already exist.', { subs: 'All of these categories already exist.' }, 409);
  return { created, reused, path: mainName };
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
  // No transaction (the live database is a single server without a replica set). The order keeps every step safe
  // on its own: products and sub-categories move up first, so if a later step fails nothing points at a missing
  // category, and deleting again finishes the job.
  let moved = 0;
  if (products > 0) moved = (await Product.updateMany({ category: cat._id }, { $set: { category: cat.parent } })).modifiedCount;
  await Category.updateMany({ parent: cat._id }, { $set: { parent: cat.parent ?? null } });
  await Category.deleteOne({ _id: cat._id });
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
        throw new InputError('Reserved name', { category: `“${name}” is already a page on the site. Choose another main category name.` });
      }
      category = (await Category.create({ name, slug, parent: parent?._id ?? null, type: parent?.type ?? 'digital' })).toObject();
      created = true;
    }
    parent = category;
  }
  return { id: parent._id, created };
}
