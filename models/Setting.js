import mongoose from 'mongoose';

const { Schema } = mongoose;

// Site-wide switches the admin changes from the admin panel (lib/data/settings.js). One document per group.
const settingSchema = new Schema(
  {
    _id: { type: String }, // group, e.g. 'marketplace'
    // New and edited seller listings go live at once (true) or wait in Admin → Products for approval (false).
    autoApproveListings: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.models.Setting || mongoose.model('Setting', settingSchema);
