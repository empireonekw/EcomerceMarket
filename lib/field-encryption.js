import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Field-level encryption for the most sensitive data at rest: sellers' bank account and wallet numbers
 * (User.seller.bankDetailsEnc, Payout.destinationEnc). Anyone holding a copy of the database — a leaked backup,
 * a stolen connection string — sees only ciphertext; the key lives in the environment, never in MongoDB or git.
 *
 * AES-256-GCM, a fresh 96-bit IV per value, and the field's purpose as associated data (so a value can't be moved
 * to another field and still decrypt). Stored as "enc:v1:<base64url(iv | tag | ciphertext)>".
 *
 * DATA_ENCRYPTION_KEY: 32 random bytes as 64 hex characters (`openssl rand -hex 32`). The SAME key must be set
 * everywhere that shares the database (server and local .env.local). Losing it makes encrypted values unreadable.
 * Without it, values are stored as before (plain) so nothing breaks; scripts/encrypt-bank-details.js migrates them.
 */

const PREFIX = 'enc:v1:';
let cachedKey;

function key() {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!raw) return (cachedKey = null);
  if (!/^[0-9a-f]{64}$/i.test(raw)) throw new Error('DATA_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32).');
  return (cachedKey = Buffer.from(raw, 'hex'));
}

export const encryptionEnabled = () => Boolean(key());

/** Encrypts a JSON-serialisable value for `purpose` (e.g. 'bank-details'). Requires DATA_ENCRYPTION_KEY. */
export function encryptJson(value, purpose) {
  const k = key();
  if (!k) throw new Error('DATA_ENCRYPTION_KEY is not set.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/** The decrypted value, or null when it can't be read (no key, wrong key, tampered). Never throws. */
export function decryptJson(stored, purpose) {
  const k = key();
  if (!k || typeof stored !== 'string' || !stored.startsWith(PREFIX)) return null;
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', k, buf.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(buf.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8'));
  } catch {
    console.error(`[field-encryption] could not decrypt a ${purpose} value (wrong DATA_ENCRYPTION_KEY or tampered data)`);
    return null;
  }
}

const BANK = 'bank-details';
const PAYOUT = 'payout-destination';

/** Database update for saving a seller's payout details: encrypted when a key is set, plain otherwise. */
export function bankDetailsUpdate(details) {
  return encryptionEnabled()
    ? { $set: { 'seller.bankDetailsEnc': encryptJson(details, BANK) }, $unset: { 'seller.bankDetails': 1 } }
    : { $set: { 'seller.bankDetails': details } };
}

/** A seller's payout details from `user.seller` (encrypted or, before migration, plain). */
export const readBankDetails = (seller) => (seller?.bankDetailsEnc ? decryptJson(seller.bankDetailsEnc, BANK) ?? {} : seller?.bankDetails ?? {});

/** Payout fields for the destination snapshot (encrypted when a key is set). */
export const payoutDestinationFields = (details) =>
  encryptionEnabled() ? { destinationEnc: encryptJson(details, PAYOUT) } : { destination: details };

/** A payout's destination snapshot (encrypted or plain). */
export const readPayoutDestination = (payout) =>
  payout?.destinationEnc ? decryptJson(payout.destinationEnc, PAYOUT) ?? {} : payout?.destination ?? {};

/** For scripts/encrypt-bank-details.js. */
export const PURPOSES = { BANK, PAYOUT };
