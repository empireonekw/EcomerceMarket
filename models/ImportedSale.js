import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Sales a seller made outside Sellpify (their other shop), added by an admin after checking proof (lib/imported.js). */
const importedSaleSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    count: { type: Number, required: true, min: 1 },
    note: { type: String, required: true, trim: true, maxlength: 300 }, // how the admin checked it (admins only)
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false },
);

// In development a hot reload re-runs this file, but mongoose would keep the model compiled from the old schema (still
// requiring the removed `platform` field). Drop it, so schema edits apply without restarting the server.
if (process.env.NODE_ENV !== 'production' && mongoose.models.ImportedSale) mongoose.deleteModel('ImportedSale');
export default mongoose.models.ImportedSale || mongoose.model('ImportedSale', importedSaleSchema);
