import mongoose from 'mongoose';
import { CONTACT_LIMITS } from '../lib/validation.js';

const { Schema } = mongoose;

/** A message sent through the /contact form. Admins read them under /admin/messages. */
const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    message: { type: String, required: true, trim: true, minlength: CONTACT_LIMITS.min, maxlength: CONTACT_LIMITS.max },
    user: { type: Schema.Types.ObjectId, ref: 'User' }, // set when the sender was signed in
    status: { type: String, enum: ['new', 'resolved'], default: 'new' },
  },
  { timestamps: true, versionKey: false },
);

contactMessageSchema.index({ status: 1, createdAt: -1 }); // admin inbox: open first, newest first
contactMessageSchema.index({ createdAt: -1 });

export default mongoose.models.ContactMessage || mongoose.model('ContactMessage', contactMessageSchema);
