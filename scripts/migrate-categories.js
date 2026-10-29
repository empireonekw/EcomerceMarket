// One-off migration: replaces the earlier category trees — the flat one (Templates, E-books, Software, Vector Packs)
// and the 6-main starter tree (Paper & Party Supplies, Art & Collectibles…) — with the
// 3-main-category tree (Digital Products / Physical Products / Services › sub › inner) in scripts/taxonomy.js, moves every product (drafts too) into the closest new category,
// then deletes the old categories and their sub-categories.
//
//   npm run migrate:categories            dry run — prints the plan, changes nothing
//   npm run migrate:categories -- --apply  does it
//
// Safe to re-run: existing categories are never overwritten, and old categories are only deleted once no product
// points at them. Running sites pick up the new tree within an hour (category cache), or straight away after a redeploy.
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb.js';
import { orderTree } from '../lib/category-tree.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { flattenTaxonomy, upsertTaxonomy } from './taxonomy.js';

const APPLY = process.argv.includes('--apply');
const V1_FALLBACK = {
  'paper-party-supplies': 'digital-products/printables',
  'art-collectibles': 'digital-products/printables/printable-wall-art',
  'craft-supplies-tools': 'digital-products/patterns',
  'books-movies-music': 'digital-products/e-books-guides',
  'design-assets': 'digital-products/graphics-design',
  'software-tools': 'digital-products/software-code',
};
const LEGACY_SLUGS = ['templates', 'ebooks', 'software', 'vector-packs', ...Object.keys(V1_FALLBACK)];

// The 6-main starter tree: each category path → its place in the new tree (unlisted ones use V1_FALLBACK).
const V1_PATHS = {
  'software-tools/productivity/notion-templates': 'digital-products/templates/notion-templates',
  'software-tools/productivity/spreadsheet-templates': 'digital-products/spreadsheets-tools/budget-spreadsheets',
  'software-tools/productivity/digital-planners': 'digital-products/printables/printable-planners',
  'software-tools/code-apps/starter-kits-code': 'digital-products/software-code/starter-kits-code',
  'software-tools/code-apps/desktop-apps': 'digital-products/software-code/desktop-apps',
  'software-tools/code-apps/plugins-extensions': 'digital-products/software-code/plugins-extensions',
  'design-assets/graphic-design/icons': 'digital-products/graphics-design/icons',
  'design-assets/graphic-design/fonts': 'digital-products/graphics-design/fonts',
  'design-assets/graphic-design/vector-illustrations': 'digital-products/graphics-design/vector-illustrations',
  'design-assets/graphic-design/mockups': 'digital-products/graphics-design/mockups',
  'design-assets/web-ui-design/website-templates': 'digital-products/templates/website-templates',
  'design-assets/web-ui-design/ui-kits': 'digital-products/graphics-design/ui-kits',
  'design-assets/web-ui-design/presentation-templates': 'digital-products/templates/presentation-templates',
  'design-assets/social-media/social-media-templates': 'digital-products/templates/social-media-templates',
  'design-assets/social-media/canva-templates': 'digital-products/templates/canva-templates',
  'books-movies-music/books/guides-how-to': 'digital-products/e-books-guides/business-marketing',
  'books-movies-music/books/workbooks-journals': 'digital-products/printables/printable-planners',
  'books-movies-music/books/childrens-books': 'digital-products/e-books-guides/fiction',
  'books-movies-music/music/sheet-music': 'digital-products/music-audio/sheet-music',
  'books-movies-music/music/sound-effects-loops': 'digital-products/music-audio/sound-effects',
  'craft-supplies-tools/patterns-how-to/crochet-patterns': 'digital-products/patterns/crochet-patterns',
  'craft-supplies-tools/patterns-how-to/knitting-patterns': 'digital-products/patterns/knitting-patterns',
  'craft-supplies-tools/patterns-how-to/sewing-patterns': 'digital-products/patterns/sewing-patterns',
  'craft-supplies-tools/patterns-how-to/embroidery-patterns': 'digital-products/patterns/embroidery-patterns',
  'craft-supplies-tools/cutting-machine-files/svg-cut-files': 'digital-products/patterns/svg-cut-files',
  'craft-supplies-tools/cutting-machine-files/laser-cut-files': 'digital-products/patterns/svg-cut-files',
  'paper-party-supplies/paper/wedding-invitation-templates': 'digital-products/templates/wedding-invitation-templates',
  'paper-party-supplies/paper/resume-templates': 'digital-products/templates/resume-templates',
  'paper-party-supplies/paper/planner-templates': 'digital-products/templates/planner-templates',
  'paper-party-supplies/paper/recipe-cards': 'digital-products/e-books-guides/cooking-recipes',
  'paper-party-supplies/party-supplies/party-printables': 'digital-products/printables/party-printables',
  'art-collectibles/prints/digital-prints': 'digital-products/printables/printable-wall-art',
  'art-collectibles/drawing-illustration/clip-art': 'digital-products/graphics-design/clip-art',
};

// Old main category → [words in the title / tags / file format, new category], first match wins; then the fallback.
const RULES = {
  templates: [
    [/notion/, 'digital-products/templates/notion-templates'],
    [/crochet/, 'digital-products/patterns/crochet-patterns'],
    [/knit/, 'digital-products/patterns/knitting-patterns'],
    [/embroider/, 'digital-products/patterns/embroidery-patterns'],
    [/sewing/, 'digital-products/patterns/sewing-patterns'],
    [/\b(resume|cv|cover letter)\b/, 'digital-products/templates/resume-templates'],
    [/wedding/, 'digital-products/templates/wedding-invitation-templates'],
    [/recipe/, 'digital-products/e-books-guides/cooking-recipes'],
    [/party|birthday/, 'digital-products/printables/party-printables'],
    [/planner/, 'digital-products/templates/planner-templates'],
    [/canva/, 'digital-products/templates/canva-templates'],
    [/instagram|social media|pinterest|tiktok/, 'digital-products/templates/social-media-templates'],
    [/budget|finance|expense/, 'digital-products/spreadsheets-tools/budget-spreadsheets'],
    [/spreadsheet|excel|google sheets/, 'digital-products/spreadsheets-tools/business-spreadsheets'],
    [/presentation|powerpoint|keynote|slides|pitch deck/, 'digital-products/templates/presentation-templates'],
    [/landing page|website|wordpress|webflow|framer|shopify/, 'digital-products/templates/website-templates'],
    [/figma|ui kit|dashboard|app design/, 'digital-products/graphics-design/ui-kits'],
  ],
  ebooks: [
    [/crochet/, 'digital-products/patterns/crochet-patterns'],
    [/knit/, 'digital-products/patterns/knitting-patterns'],
    [/sewing/, 'digital-products/patterns/sewing-patterns'],
    [/workbook|journal/, 'digital-products/printables/printable-planners'],
    [/children|kids/, 'digital-products/e-books-guides/fiction'],
    [/design|education|course|learn/, 'digital-products/e-books-guides/education'],
  ],
  software: [
    [/notion/, 'digital-products/templates/notion-templates'],
    [/plugin|extension|add-?on/, 'digital-products/software-code/plugins-extensions'],
    [/desktop|installer|windows|macos|linux/, 'digital-products/software-code/desktop-apps'],
  ],
  'vector-packs': [
    [/\bicons?\b/, 'digital-products/graphics-design/icons'],
    [/\bfonts?\b|typeface/, 'digital-products/graphics-design/fonts'],
    [/mockup/, 'digital-products/graphics-design/mockups'],
    [/cricut|silhouette|cut file/, 'digital-products/patterns/svg-cut-files'],
    [/clip ?art/, 'digital-products/graphics-design/clip-art'],
  ],
};
const FALLBACK = {
  templates: 'digital-products/templates',
  ebooks: 'digital-products/e-books-guides/business-marketing',
  software: 'digital-products/software-code/starter-kits-code',
  'vector-packs': 'digital-products/graphics-design/vector-illustrations',
};

const searchText = (p) =>
  [p.title, ...(p.tags ?? []), p.fileFormat]
    .join(' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const targetFor = (product, legacyRoot, slugPath) =>
  V1_PATHS[slugPath] ?? (RULES[legacyRoot] ?? []).find(([re]) => re.test(searchText(product)))?.[1] ?? FALLBACK[legacyRoot] ?? V1_FALLBACK[legacyRoot];

await connectDB();

// The old categories, plus any sub-categories an admin added under them.
const tree = orderTree((await Category.find().select('name slug parent').lean()).map((c) => ({ ...c, _id: String(c._id), parent: c.parent && String(c.parent) })));
const legacyRootById = new Map();
for (const c of tree) {
  const rootId = c.ancestors[0] ?? c._id;
  const root = tree.find((r) => r._id === rootId);
  if (root?.depth === 0 && LEGACY_SLUGS.includes(root.slug)) legacyRootById.set(c._id, root.slug);
}
const legacy = tree.filter((c) => legacyRootById.has(c._id));
console.log(`Old categories found: ${legacy.length ? legacy.map((c) => c.path).join(', ') : 'none'}`);

const products = await Product.find({ category: { $in: legacy.map((c) => c._id) } })
  .select('title tags fileFormat category status')
  .lean();
const pathById = new Map(tree.map((c) => [c._id, c.slugPath]));
const plan = products.map((p) => ({ product: p, target: targetFor(p, legacyRootById.get(String(p.category)), pathById.get(String(p.category))) }));

const newPaths = new Set(flattenTaxonomy().map((n) => n.slugPath));
const missing = plan.filter((m) => !newPaths.has(m.target));
if (missing.length) throw new Error(`Rule points at an unknown category: ${[...new Set(missing.map((m) => m.target))].join(', ')}`);

console.log(`\nNew tree: ${flattenTaxonomy().length} categories in ${flattenTaxonomy().filter((n) => !n.parentPath).length} main categories.`);
console.log(`Products to move: ${plan.length}`);
for (const { product, target } of plan) console.log(`  ${product.title.slice(0, 50).padEnd(50)} (${product.status ?? 'approved'}) → /${target}`);

if (!APPLY) {
  console.log('\nDry run — nothing changed. Re-run with --apply to migrate:  npm run migrate:categories -- --apply');
  await mongoose.disconnect();
  process.exit(0);
}

// The old schema made slugs unique across the whole tree; the new one only among siblings.
const dropped = await Category.syncIndexes();
if (dropped.length) console.log(`\n✓ indexes updated (dropped: ${dropped.join(', ')})`);

const ids = await upsertTaxonomy(Category);
console.log(`✓ new tree ready (${ids.size} categories)`);

if (plan.length) {
  const { modifiedCount } = await Product.bulkWrite(
    plan.map(({ product, target }) => ({ updateOne: { filter: { _id: product._id }, update: { $set: { category: ids.get(target) } } } })),
  );
  console.log(`✓ products moved: ${modifiedCount}`);
}

const left = await Product.countDocuments({ category: { $in: legacy.map((c) => c._id) } });
if (left) {
  console.log(`! ${left} product(s) were added to an old category meanwhile — old categories kept. Run this again.`);
} else if (legacy.length) {
  const { deletedCount } = await Category.deleteMany({ _id: { $in: legacy.map((c) => c._id) } });
  console.log(`✓ old categories deleted: ${deletedCount}`);
}

await mongoose.disconnect();
