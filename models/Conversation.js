import mongoose from 'mongoose';

const { Schema } = mongoose;

export const CONVERSATION_KINDS = ['direct', 'system'];

/**
 * One participant's private view of a conversation: which folder it sits in, read state, star, labels.
 * Every flag is per person, so archiving or binning a thread never changes what the other side sees.
 */
const participantStateSchema = new Schema(
  {
    unread: { type: Boolean, default: false },
    starred: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    spam: { type: Boolean, default: false },
    trashed: { type: Boolean, default: false }, // "Recycling bin"
    purged: { type: Boolean, default: false }, // deleted from the bin/spam: hidden until a new message arrives
    labels: { type: [String], default: [] },
    sentAt: { type: Date }, // last time this participant sent a message ("Sent" folder)
    reportedAt: { type: Date },
  },
  { _id: false },
);

/**
 * A message thread.
 *  - direct: one thread per (buyer, seller) pair; `product` is the listing it was last about.
 *  - system: the user's thread with the marketplace ("From Sellpify"): listing notices plus a two-way support chat
 *    with the admin team. The user sits in `seller`, `buyer` is empty. `support` marks threads with a real chat
 *    (a message from the user or an admin), which are the ones admins see under /admin/messages.
 */
const conversationSchema = new Schema(
  {
    kind: { type: String, enum: CONVERSATION_KINDS, default: 'direct' },
    buyer: { type: Schema.Types.ObjectId, ref: 'User' },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    // Set when the buyer has a paid order from this seller; threads without it are "From potential buyers".
    buyerIsCustomer: { type: Boolean, default: false },
    lastMessage: {
      body: { type: String, maxlength: 200 },
      sender: { type: Schema.Types.ObjectId, ref: 'User' },
      at: { type: Date },
    },
    buyerState: { type: participantStateSchema, default: () => ({}) },
    sellerState: { type: participantStateSchema, default: () => ({}) },
    autoRepliedAt: { type: Date }, // seller's away message: sent at most once a day per thread
    support: { type: Boolean, default: false },
    // The admin team's shared view of a support chat.
    supportState: {
      unread: { type: Boolean, default: false },
      status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    },
  },
  { timestamps: true, versionKey: false },
);

// Inbox lists: newest activity first, per side.
conversationSchema.index({ buyer: 1, 'lastMessage.at': -1 });
conversationSchema.index({ seller: 1, 'lastMessage.at': -1 });
// Admin support inbox: chats by status, newest activity first.
conversationSchema.index({ kind: 1, support: 1, 'supportState.status': 1, 'lastMessage.at': -1 });
// One direct thread per buyer/seller pair, one system thread per user.
conversationSchema.index({ buyer: 1, seller: 1 }, { unique: true, partialFilterExpression: { kind: 'direct' } });
conversationSchema.index({ seller: 1 }, { unique: true, partialFilterExpression: { kind: 'system' }, name: 'system_thread_per_user' });

export default mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
