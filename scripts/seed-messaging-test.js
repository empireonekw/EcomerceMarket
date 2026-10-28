// Test data for live messaging: a buyer, a seller with a shop and one approved listing.
// Idempotent: re-running resets the accounts' passwords and keeps one listing.
//
//   npm run seed:messaging              create / refresh the test data
//   npm run seed:messaging -- --cleanup remove the accounts, the listing and their conversations
//
// Test-only accounts on @sellpify.test (not a real mail domain). Remove them before going live.
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

const MESSAGING_TEST = {
  password: 'MsgTest#2026a',
  buyer: { name: 'Test Buyer', email: 'msgtest-buyer@sellpify.test' },
  seller: { name: 'Test Seller', email: 'msgtest-seller@sellpify.test', storeName: 'Message Test Studio' },
  listing: { title: 'Message Test Planner Kit', slug: 'message-test-planner-kit' },
};

const { values } = parseArgs({ options: { cleanup: { type: 'boolean', default: false } } });
await connectDB();

const emails = [MESSAGING_TEST.buyer.email, MESSAGING_TEST.seller.email];

if (values.cleanup) {
  const users = await User.find({ email: { $in: emails } }).select('_id').lean();
  const ids = users.map((u) => u._id);
  const convs = await Conversation.find({ $or: [{ buyer: { $in: ids } }, { seller: { $in: ids } }] }).select('_id').lean();
  await Message.deleteMany({ conversation: { $in: convs.map((c) => c._id) } });
  await Conversation.deleteMany({ _id: { $in: convs.map((c) => c._id) } });
  await Product.deleteMany({ slug: MESSAGING_TEST.listing.slug });
  await User.deleteMany({ _id: { $in: ids } });
  console.log(`✓ Removed ${ids.length} test users, ${convs.length} conversations and the test listing.`);
  await mongoose.disconnect();
  process.exit(0);
}

async function upsertUser({ name, email }, extra = {}) {
  let user = await User.findOne({ email }).select('+password');
  if (!user) user = new User({ name, email, termsAcceptedAt: new Date() });
  user.set({ name, password: MESSAGING_TEST.password, ...extra });
  await user.save();
  return user;
}

const buyer = await upsertUser(MESSAGING_TEST.buyer, { role: 'customer' });
const now = new Date();
const seller = await upsertUser(MESSAGING_TEST.seller, {
  role: 'seller',
  'seller.storeName': MESSAGING_TEST.seller.storeName,
  'seller.storeDescription': 'A test shop for checking buyer ↔ seller messaging. Safe to delete.',
  'seller.joinedAt': now,
  'seller.storeSetupAt': now,
});

const category = await Category.findOne().sort({ sortOrder: 1 }).select('_id').lean();
if (!category) throw new Error('No categories yet — run `npm run seed` first.');

await Product.findOneAndUpdate(
  { slug: MESSAGING_TEST.listing.slug },
  {
    $set: {
      title: MESSAGING_TEST.listing.title,
      slug: MESSAGING_TEST.listing.slug,
      shortDescription: 'A test listing used to check the Message seller flow.',
      description: 'Test listing for messaging. Safe to delete.',
      price: 500,
      currency: 'USD',
      category: category._id,
      deliveryType: 'external',
      downloadUrl: 'https://example.com/message-test',
      fileFormat: 'Notion',
      sellerId: seller._id,
      status: 'approved',
      isPublished: true,
    },
  },
  { upsert: true, runValidators: true },
);

console.log(`✓ Buyer ${buyer.email} · Seller ${seller.email} (“${MESSAGING_TEST.seller.storeName}”) · /products/${MESSAGING_TEST.listing.slug}`);
await mongoose.disconnect();
