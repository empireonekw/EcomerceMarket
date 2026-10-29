// Seeds demo products into an "Uncategorized" category (admins build their own categories). Idempotent: upserts, never deletes.
// Usage: npm run seed
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb.js';
import { slugify } from '../lib/utils.js';
import { createBlurDataURL } from '../lib/blur.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';

const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const products = [
  {
    title: 'SaaS Landing Page Kit', price: 4900, compareAtPrice: 7900, isFeatured: true,
    shortDescription: '40+ responsive Figma sections for launching a SaaS product fast.',
    description: 'A complete landing page system for SaaS founders.\n\nIncludes hero, pricing, testimonial, FAQ and footer sections with auto-layout, light/dark variants and a matching component library.',
    tags: ['figma', 'saas', 'landing page'], fileFormat: 'Figma', deliveryType: 'external',
    downloadUrl: 'https://www.figma.com/community/file/REPLACE_ME', coverImage: img('1460925895917-afdab827c52f'), salesCount: 312,
  },
  {
    title: 'Notion Freelancer OS', price: 2900, isFeatured: true,
    shortDescription: 'Clients, projects, invoices and time tracking in one Notion workspace.',
    description: 'Run your entire freelance business from Notion.\n\nCRM, project boards, invoice generator, time tracker and a weekly review dashboard.',
    tags: ['notion', 'productivity', 'freelance'], fileFormat: 'Notion', deliveryType: 'external',
    downloadUrl: 'https://notion.so/REPLACE_ME', coverImage: img('1498050108023-c5249f4df085'), salesCount: 540,
  },
  {
    title: 'The Indie Hacker Playbook', price: 1900, isFeatured: true,
    shortDescription: 'From idea to first $10k MRR — a 180-page practical guide.',
    description: 'Validation, pricing, distribution and retention, distilled from dozens of bootstrapped products.',
    tags: ['startup', 'marketing', 'business'], fileFormat: 'PDF + EPUB', fileSize: 14_500_000,
    downloadUrl: 'products/indie-hacker-playbook.zip', coverImage: img('1544716278-ca5e3f4abd8c'), salesCount: 1210,
  },
  {
    title: 'Design Systems Handbook', price: 0,
    shortDescription: 'A free guide to building and scaling design systems.',
    description: 'Tokens, components, documentation and governance — everything a small team needs to start.',
    tags: ['design', 'design systems'], fileFormat: 'PDF', fileSize: 8_200_000,
    downloadUrl: 'products/design-systems-handbook.pdf', coverImage: img('1512820790803-83ca734da794'), salesCount: 4020,
  },
  {
    title: 'Next.js Commerce Starter', price: 9900, isFeatured: true,
    shortDescription: 'Production-ready Next.js + MongoDB storefront boilerplate.',
    description: 'Auth, product catalog, cart, checkout webhooks and an admin dashboard — ready to deploy.',
    tags: ['nextjs', 'react', 'boilerplate'], fileFormat: 'ZIP (source code)', fileSize: 2_300_000,
    downloadUrl: 'products/nextjs-commerce-starter.zip', coverImage: img('1555066931-4365d14bab8c'), salesCount: 188,
  },
  {
    title: 'Batch Image Optimizer', price: 1500,
    shortDescription: 'Desktop app that compresses thousands of images to AVIF/WebP in seconds.',
    description: 'Drag in a folder, pick a preset, done. Works offline on Windows, macOS and Linux.',
    tags: ['images', 'performance', 'desktop'], fileFormat: 'Installer (Win/Mac/Linux)', fileSize: 64_000_000,
    downloadUrl: 'products/batch-image-optimizer.zip', coverImage: img('1586717791821-3f44a563fa4c'), salesCount: 97,
  },
  {
    title: 'Abstract Shapes Vector Pack', price: 2400, isFeatured: true,
    shortDescription: '600 editable abstract shapes for brands, posters and UI.',
    description: 'Every shape is a clean, editable vector. Includes SVG, AI and EPS plus a Figma library.',
    tags: ['vectors', 'shapes', 'illustration'], fileFormat: 'ZIP (SVG, AI, EPS)', fileSize: 120_000_000,
    downloadUrl: 'products/abstract-shapes-pack.zip', coverImage: img('1561070791-2526d30994b5'), salesCount: 433,
  },
  {
    title: 'Line Icons Pro — 2,400 Icons', price: 3900,
    shortDescription: 'Pixel-perfect 24px line icons in 3 stroke weights.',
    description: 'A consistent icon set for product UI. SVG, icon font and React components included.',
    tags: ['icons', 'vectors', 'ui'], fileFormat: 'ZIP (SVG, font, React)', fileSize: 18_000_000,
    downloadUrl: 'products/line-icons-pro.zip', coverImage: img('1626785774573-4b799315345d'), salesCount: 780,
  },
];

await connectDB();

const uncategorized = await Category.findOneAndUpdate(
  { slug: 'uncategorized', parent: null },
  { $setOnInsert: { name: 'Uncategorized', slug: 'uncategorized', parent: null, description: 'Products waiting for a category.' } },
  { upsert: true, returnDocument: 'after' },
);
console.log('✓ category: Uncategorized');

for (const p of products) {
  const slug = slugify(p.title);
  await Product.updateOne(
    { slug },
    { $set: { ...p, slug, category: uncategorized._id } },
    { upsert: true, runValidators: true },
  );
}
console.log(`✓ ${products.length} products`);

// Backfill blur placeholders for any product that doesn't have one yet (in parallel).
const missingBlur = await Product.find({ coverImage: { $exists: true, $ne: '' }, coverBlurDataURL: { $exists: false } })
  .select('coverImage')
  .lean();
const results = await Promise.all(
  missingBlur.map(async (p) => {
    const blur = await createBlurDataURL(p.coverImage);
    if (blur) await Product.updateOne({ _id: p._id }, { $set: { coverBlurDataURL: blur } });
    return Boolean(blur);
  }),
);
console.log(`✓ blur placeholders: ${results.filter(Boolean).length}/${missingBlur.length} generated`);

await mongoose.disconnect();
