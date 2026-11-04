import 'server-only';
import { connectDB } from '@/lib/mongodb';
import Setting from '@/models/Setting';

// Marketplace settings (Admin → Products: "Listing approval"). Read on every listing submit, so they're kept in
// memory for a few seconds; this server's own changes apply at once.

const DEFAULTS = { autoApproveListings: true };
const TTL_MS = 15_000;
let cached = null; // { value, at }

/** { autoApproveListings } — the defaults until an admin changes something. */
export async function getMarketplaceSettings() {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  await connectDB();
  const doc = await Setting.findById('marketplace').lean();
  const value = { autoApproveListings: doc?.autoApproveListings ?? DEFAULTS.autoApproveListings };
  cached = { value, at: Date.now() };
  return value;
}

/** Saves the given settings (UNGUARDED: callers authorize an admin first). */
export async function updateMarketplaceSettings(patch) {
  const $set = {};
  if (typeof patch?.autoApproveListings === 'boolean') $set.autoApproveListings = patch.autoApproveListings;
  await connectDB();
  const doc = await Setting.findByIdAndUpdate('marketplace', { $set }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  const value = { autoApproveListings: doc.autoApproveListings };
  cached = { value, at: Date.now() };
  return value;
}
