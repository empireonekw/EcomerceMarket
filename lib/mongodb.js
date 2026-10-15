import mongoose from 'mongoose';

/**
 * Cached Mongoose connection.
 *
 * In development, Next.js hot-reloads modules, and in serverless production each
 * warm lambda re-imports modules. Storing the connection promise on `globalThis`
 * means every request reuses one connection pool instead of opening a new one.
 */
const globalCache = globalThis.__mongoose ?? { conn: null, promise: null };
globalThis.__mongoose = globalCache;

const options = {
  bufferCommands: false, // fail fast instead of queueing queries while disconnected
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  // Building indexes on every cold start is expensive in production;
  // run `npm run db:indexes` during deploys instead.
  autoIndex: process.env.NODE_ENV !== 'production',
};

export async function connectDB() {
  if (globalCache.conn) return globalCache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to .env.local (see .env.example).');
  }

  if (!globalCache.promise) {
    mongoose.set('strictQuery', true);
    globalCache.promise = mongoose.connect(uri, options).then((m) => m);
  }

  try {
    globalCache.conn = await globalCache.promise;
  } catch (err) {
    // Reset so the next request retries instead of reusing a rejected promise.
    globalCache.promise = null;
    throw err;
  }

  return globalCache.conn;
}

export default connectDB;
