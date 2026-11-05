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

export default mongoose.models.ImportedSale || mongoose.model('ImportedSale', importedSaleSchema);
