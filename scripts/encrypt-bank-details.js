// Encrypts sellers' saved payout details and past payout snapshots that are still stored in plain text
// (User.seller.bankDetails → seller.bankDetailsEnc, Payout.destination → destinationEnc). Safe to re-run.
//
//   npm run encrypt:bank-details              encrypt everything still plain
//   npm run encrypt:bank-details -- --dry-run count only, change nothing
//
// Needs DATA_ENCRYPTION_KEY — the SAME value the running site uses (lib/field-encryption.js). Each value is
// decrypted again and compared before the plain copy is removed.
import { parseArgs } from 'node:util';
import { isDeepStrictEqual } from 'node:util';
import mongoose from 'mongoose';
import { connectDB } from '../lib/mongodb.js';
import { decryptJson, encryptionEnabled, encryptJson, PURPOSES } from '../lib/field-encryption.js';

const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const dryRun = values['dry-run'];

if (!encryptionEnabled()) {
  console.error('DATA_ENCRYPTION_KEY is not set. Add it to .env.local (openssl rand -hex 32) — the same value as the live site.');
  process.exit(1);
}

await connectDB();
const db = mongoose.connection.db;
const filled = (o) => o && typeof o === 'object' && Object.values(o).some((v) => v != null && v !== '');

async function migrate(collection, filter, read, field, encField, purpose) {
  const docs = await db.collection(collection).find(filter).project({ [field]: 1 }).toArray();
  let done = 0;
  for (const doc of docs) {
    const plain = read(doc);
    if (!filled(plain)) continue;
    const enc = encryptJson(plain, purpose);
    if (!isDeepStrictEqual(decryptJson(enc, purpose), JSON.parse(JSON.stringify(plain)))) throw new Error(`Round-trip check failed for ${collection} ${doc._id}`);
    if (!dryRun) await db.collection(collection).updateOne({ _id: doc._id }, { $set: { [encField]: enc }, $unset: { [field]: 1 } });
    done += 1;
  }
  console.log(`${dryRun ? 'Would encrypt' : '✓ Encrypted'} ${done} ${collection === 'users' ? 'seller payout details' : 'payout snapshots'}`);
}

await migrate('users', { 'seller.bankDetails': { $exists: true } }, (d) => d.seller?.bankDetails, 'seller.bankDetails', 'seller.bankDetailsEnc', PURPOSES.BANK);
await migrate('payouts', { destination: { $exists: true } }, (d) => d.destination, 'destination', 'destinationEnc', PURPOSES.PAYOUT);
await mongoose.disconnect();
