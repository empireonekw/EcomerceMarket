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
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, trim: true, maxlength: 300 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

// Navigation / filter lists: active categories in display order.
categorySchema.index({ isActive: 1, sortOrder: 1, name: 1 });

categorySchema.pre('validate', function ensureSlug() {
  if (!this.slug && this.name) this.slug = slugify(this.name);
});

export default mongoose.models.Category || mongoose.model('Category', categorySchema);
