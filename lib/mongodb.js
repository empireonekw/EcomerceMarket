import dns from 'node:dns';
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
  // Each new pooled connection costs a TLS handshake + auth (several round trips). Keep a few open so a page's
  // parallel queries reuse warm sockets instead of each opening its own.
  minPoolSize: 5,
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 45000,
  // Building indexes on every cold start is expensive in production;
  // run `npm run db:indexes` during deploys instead.
  autoIndex: process.env.NODE_ENV !== 'production',
};

// mongodb+srv:// URIs need a DNS "SRV" lookup before connecting. Some routers' and ISPs' DNS servers refuse or drop
// those now and then ("querySrv EREFUSED"); when that happens we retry once through public DNS servers instead.
const PUBLIC_DNS = ['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4'];
const isSrvLookupFailure = (err) =>
  /querySrv|queryTxt/i.test(err?.message ?? '') || ['EREFUSED', 'ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(err?.code);

function connect(uri) {
  mongoose.set('strictQuery', true);
  return mongoose.connect(uri, options).then((m) => m);
}

export async function connectDB() {
  if (globalCache.conn) return globalCache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to .env.local (see .env.example).');
  }

  if (!globalCache.promise) {
    globalCache.promise = connect(uri).catch((err) => {
      if (!uri.startsWith('mongodb+srv://') || !isSrvLookupFailure(err) || globalCache.usingPublicDns) throw err;
      // Only affects this app's own DNS queries (dns.resolve*), not the rest of the machine.
      console.warn(`[mongodb] Database address lookup failed (${err.code ?? err.message}); retrying with public DNS.`);
      dns.setServers(PUBLIC_DNS);
      globalCache.usingPublicDns = true;
      return connect(uri);
    });
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
