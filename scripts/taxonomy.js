// The starter category tree: 3 main categories (Digital Products, Physical Products, Services) › sub › inner, shared by scripts/seed.js and scripts/migrate-categories.js.
// Admins can rename, move, add or remove any of these afterwards in Admin › Categories — the scripts never overwrite
// an existing category, they only create missing ones.
import { slugify } from '../lib/utils.js';

// type: what can be listed there — 'digital' | 'physical' | 'service' (CATEGORY_TYPES in lib/category-tree.js).
// Sub and inner categories inherit their main category's type.
export const TAXONOMY = [
  {
    name: "Digital Products",
    type: 'digital',
    description: "Templates, printables, e-books, courses, design assets, software and more — delivered instantly.",
    children: [
      { name: "Templates", description: "Ready-to-edit templates for work, events and social media.", children: [{ name: "Résumé Templates" }, { name: "Planner Templates" }, { name: "Wedding Invitation Templates" }, { name: "Social Media Templates" }, { name: "Canva Templates" }, { name: "Notion Templates" }, { name: "Presentation Templates" }, { name: "Website Templates" }] },
      { name: "Printables", description: "Download, print and use at home.", children: [{ name: "Printable Wall Art" }, { name: "Printable Planners" }, { name: "Party Printables" }, { name: "Kids Activity Sheets" }, { name: "Stickers & Labels" }] },
      { name: "E-books & Guides", description: "Practical guides and books from working experts.", children: [{ name: "Business & Marketing" }, { name: "Self-Help" }, { name: "Cooking & Recipes" }, { name: "Education" }, { name: "Fiction" }] },
      { name: "Courses & Tutorials", description: "Learn new skills at your own pace.", children: [{ name: "Video Courses" }, { name: "Workshops" }, { name: "Study Notes" }, { name: "Language Learning" }] },
      { name: "Graphics & Design", description: "Fonts, icons, illustrations, mockups and UI kits.", children: [{ name: "Fonts" }, { name: "Icons" }, { name: "Vector Illustrations" }, { name: "Clip Art" }, { name: "Mockups" }, { name: "UI Kits" }] },
      { name: "Patterns", description: "Step-by-step patterns and cut files for makers.", children: [{ name: "Crochet Patterns" }, { name: "Knitting Patterns" }, { name: "Sewing Patterns" }, { name: "Embroidery Patterns" }, { name: "SVG Cut Files" }] },
      { name: "Software & Code", description: "Starter kits, plugins, apps and scripts.", children: [{ name: "Starter Kits & Code" }, { name: "Plugins & Extensions" }, { name: "Desktop Apps" }, { name: "Mobile Apps" }, { name: "Scripts & Automation" }] },
      { name: "Spreadsheets & Tools", description: "Spreadsheets and trackers that do the maths for you.", children: [{ name: "Budget Spreadsheets" }, { name: "Business Spreadsheets" }, { name: "Trackers" }] },
      { name: "Photography & Video", description: "Stock photos, presets and video templates.", children: [{ name: "Stock Photos" }, { name: "Lightroom Presets" }, { name: "Video Templates" }, { name: "LUTs" }] },
      { name: "Music & Audio", description: "Sheet music, beats, loops and sound effects.", children: [{ name: "Sheet Music" }, { name: "Beats & Loops" }, { name: "Sound Effects" }, { name: "Podcast Assets" }] },
    ],
  },
  {
    name: "Physical Products",
    type: 'physical',
    description: "Clothing, jewellery, home goods, beauty, electronics and more — shipped to your door.",
    children: [
      { name: "Clothing", children: [{ name: "Women's Clothing" }, { name: "Men's Clothing" }, { name: "Kids' Clothing" }, { name: "T-shirts & Tops" }, { name: "Activewear" }] },
      { name: "Shoes", children: [{ name: "Women's Shoes" }, { name: "Men's Shoes" }, { name: "Kids' Shoes" }, { name: "Sneakers" }] },
      { name: "Jewelry", children: [{ name: "Necklaces" }, { name: "Earrings" }, { name: "Bracelets" }, { name: "Rings" }] },
      { name: "Bags & Accessories", children: [{ name: "Handbags" }, { name: "Backpacks" }, { name: "Wallets" }, { name: "Hats & Caps" }, { name: "Belts" }, { name: "Sunglasses" }] },
      { name: "Home & Living", children: [{ name: "Home Decor" }, { name: "Kitchen & Dining" }, { name: "Bedding" }, { name: "Candles" }, { name: "Furniture" }, { name: "Storage & Organization" }] },
      { name: "Beauty & Personal Care", children: [{ name: "Skincare" }, { name: "Makeup" }, { name: "Hair Care" }, { name: "Fragrances" }, { name: "Bath & Body" }] },
      { name: "Electronics & Accessories", children: [{ name: "Phone Accessories" }, { name: "Computer Accessories" }, { name: "Audio & Headphones" }, { name: "Smart Home" }, { name: "Cameras" }] },
      { name: "Toys & Games", children: [{ name: "Kids' Toys" }, { name: "Board Games" }, { name: "Puzzles" }, { name: "Plush Toys" }] },
      { name: "Books & Stationery", children: [{ name: "Printed Books" }, { name: "Notebooks & Journals" }, { name: "Pens & Art Supplies" }, { name: "Greeting Cards" }] },
      { name: "Craft Supplies", children: [{ name: "Yarn & Fiber" }, { name: "Fabric" }, { name: "Beads & Jewelry Making" }, { name: "Painting Supplies" }] },
      { name: "Health & Fitness", children: [{ name: "Fitness Equipment" }, { name: "Supplements" }, { name: "Yoga" }] },
      { name: "Pet Supplies", children: [{ name: "Dog Supplies" }, { name: "Cat Supplies" }, { name: "Pet Accessories" }] },
      { name: "Baby & Kids", children: [{ name: "Baby Clothing" }, { name: "Nursery Decor" }, { name: "Feeding" }, { name: "Baby Gifts" }] },
    ],
  },
  {
    name: "Services",
    type: 'service',
    description: "Hire independent creators for design, writing, development, marketing, lessons and custom work.",
    children: [
      { name: "Design Services", children: [{ name: "Logo Design" }, { name: "Branding" }, { name: "Social Media Design" }, { name: "Illustration" }] },
      { name: "Writing & Translation", children: [{ name: "Copywriting" }, { name: "Articles & Blog Posts" }, { name: "Translation" }, { name: "Proofreading" }, { name: "Resume Writing" }] },
      { name: "Web & Programming", children: [{ name: "Website Development" }, { name: "WordPress" }, { name: "Shopify Stores" }, { name: "Mobile App Development" }, { name: "Bug Fixes" }] },
      { name: "Digital Marketing", children: [{ name: "SEO" }, { name: "Social Media Marketing" }, { name: "Email Marketing" }, { name: "Paid Ads" }] },
      { name: "Video & Animation", children: [{ name: "Video Editing" }, { name: "Animation" }, { name: "Explainer Videos" }] },
      { name: "Music & Audio Services", children: [{ name: "Voice Over" }, { name: "Mixing & Mastering" }, { name: "Jingles" }] },
      { name: "Business & Consulting", children: [{ name: "Virtual Assistant" }, { name: "Business Plans" }, { name: "Bookkeeping" }, { name: "Market Research" }] },
      { name: "Lessons & Coaching", children: [{ name: "Online Tutoring" }, { name: "Fitness Coaching" }, { name: "Life Coaching" }, { name: "Language Lessons" }] },
      { name: "Custom Orders", children: [{ name: "Custom Portraits" }, { name: "Custom Patterns" }, { name: "Personalized Gifts" }] },
    ],
  },
];

/** Every node with its slug path ("paper-party-supplies/paper/resume-templates"), parents before children. */
export function flattenTaxonomy(nodes = TAXONOMY, parentPath = '', parentType = 'digital') {
  return nodes.flatMap((node, i) => {
    const slug = slugify(node.name);
    const slugPath = parentPath ? `${parentPath}/${slug}` : slug;
    const type = node.type ?? parentType;
    return [
      { name: node.name, slug, slugPath, parentPath: parentPath || null, type, description: node.description, sortOrder: i + 1 },
      ...flattenTaxonomy(node.children ?? [], slugPath, type),
    ];
  });
}

/** Creates the categories that don't exist yet (existing ones are left untouched). Returns Map slugPath → _id. */
export async function upsertTaxonomy(Category) {
  const ids = new Map();
  for (const node of flattenTaxonomy()) {
    const parent = node.parentPath ? ids.get(node.parentPath) : null;
    const { name, slug, type, description, sortOrder } = node;
    const doc = await Category.findOneAndUpdate(
      { slug, parent },
      { $setOnInsert: { name, slug, parent, type, sortOrder, ...(description && { description }) } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
    ids.set(node.slugPath, doc._id);
  }
  return ids;
}
