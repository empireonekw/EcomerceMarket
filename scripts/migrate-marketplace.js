// One-off, idempotent migration for the multi-vendor release:
// products created before moderation existed have no `status` — they were already live, so mark them approved.
// Usage: npm run migrate:marketplace
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb.js';
import Product from '../models/Product.js';

await connectDB();
const { modifiedCount } = await Product.updateMany({ status: { $exists: false } }, { $set: { status: 'approved' } });
console.log(`✓ products marked approved: ${modifiedCount}`);
await mongoose.disconnect();
