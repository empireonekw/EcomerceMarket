import mongoose from 'mongoose';
import { slugify } from '../lib/utils.js';

const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: 60,
    },
    // URL segment: /main/sub/inner. Unique among siblings (two parents may both have an "accessories").
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, trim: true, maxlength: 300 },
    // What can be listed here — the badge in the seller's category search (lib/category-tree.js CATEGORY_TYPES).
    type: { type: String, enum: ['digital', 'both', 'physical', 'service'], default: 'digital' },
    // SEO for the category page (/main/sub/inner); fall back to the name and description when empty.
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 160 },
    // Hierarchy: null = main category; otherwise the parent (main › sub › inner, see lib/category-tree.js).
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

// Navigation / filter lists: active categories in display order.
categorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });
categorySchema.index({ parent: 1, slug: 1 }, { unique: true }); // one slug per level of the tree; also lists children

categorySchema.pre('validate', function ensureSlug() {
  if (!this.slug && this.name) this.slug = slugify(this.name);
});

export default mongoose.models.Category || mongoose.model('Category', categorySchema);
