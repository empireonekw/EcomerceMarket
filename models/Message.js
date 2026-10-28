import mongoose from 'mongoose';
import { MESSAGE_LIMITS } from '../lib/validation.js';

const { Schema } = mongoose;

/** One message in a Conversation. `sender` is empty for marketplace (system) notices. */
const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    body: { type: String, required: true, trim: true, maxlength: MESSAGE_LIMITS.max },
    product: { type: Schema.Types.ObjectId, ref: 'Product' }, // listing the buyer was looking at when they wrote
    auto: { type: Boolean, default: false }, // seller's automatic away reply
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.models.Message || mongoose.model('Message', messageSchema);
