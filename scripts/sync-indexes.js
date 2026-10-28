// Creates/updates MongoDB indexes to match the Mongoose schemas.
// Run on deploy (production has autoIndex disabled):  npm run db:indexes
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Transaction from '../models/Transaction.js';
import Payout from '../models/Payout.js';
import Review from '../models/Review.js';
import ContactMessage from '../models/ContactMessage.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

await connectDB();

for (const Model of [User, Category, Product, Order, Transaction, Payout, Review, ContactMessage, Conversation, Message]) {
  const dropped = await Model.syncIndexes();
  const indexes = await Model.listIndexes();
  console.log(`✓ ${Model.modelName}: ${indexes.map((i) => i.name).join(', ')}${dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''}`);
}

await mongoose.disconnect();
