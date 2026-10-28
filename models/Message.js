import mongoose from 'mongoose';
import { MESSAGE_LIMITS } from '../lib/validation.js';

const { Schema } = mongoose;

/**
 * One message in a Conversation. `sender` is empty for messages from the marketplace: listing notices, and admin
 * replies in a support chat (`team`, with the admin in `staff`; the user sees them as from the Sellpify team).
 */
const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    team: { type: Boolean }, // a support reply from the admin team (vs. an automatic notice)
    staff: { type: Schema.Types.ObjectId, ref: 'User' }, // which admin wrote it, when known (not for API-key replies)
    body: { type: String, required: true, trim: true, maxlength: MESSAGE_LIMITS.max },
    product: { type: Schema.Types.ObjectId, ref: 'Product' }, // listing the buyer was looking at when they wrote
    auto: { type: Boolean, default: false }, // seller's automatic away reply
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.models.Message || mongoose.model('Message', messageSchema);
