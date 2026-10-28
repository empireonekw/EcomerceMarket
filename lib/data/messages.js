import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex, toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { MESSAGE_LIMITS } from '@/lib/validation';
import { FOLDER_KEYS } from '@/lib/messaging';
import { emitToUsers, installRealtimeHooks, issueSocketTicket } from '@/lib/realtime';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import User from '@/models/User';
import Order from '@/models/Order';
import ContactMessage from '@/models/ContactMessage';
import Product, { PUBLIC_PRODUCT_FILTER } from '@/models/Product';

// ---------------------------------------------------------------------------
// Buyer ↔ seller messaging (Etsy-style inbox).
//
// A user sees every conversation they take part in, as the buyer or as the seller. Folders are views over each
// participant's own state (Conversation.buyerState / sellerState), so moving a thread never affects the other side.
// Callers pass the signed-in user's id; every query is scoped to it.
// ---------------------------------------------------------------------------

export const INBOX_PAGE_SIZE = 20;
const THREAD_PAGE_SIZE = 50;
const MAX_BULK = 100;
const AUTO_REPLY_EVERY_MS = 24 * 60 * 60 * 1000;

const FOLDER_SET = new Set(FOLDER_KEYS);

const SIDES = ['buyer', 'seller'];
const otherSide = (side) => (side === 'buyer' ? 'seller' : 'buyer');
const isId = (v) => mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(String(v));
const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** The part of a folder's filter that applies to one side of the thread, or null when that side can't be in it. */
function folderFilterFor(side, userId, folder, label) {
  const s = `${side}State`;
  const filter = { [side]: userId, [`${s}.purged`]: { $ne: true } };
  const live = { [`${s}.spam`]: { $ne: true }, [`${s}.trashed`]: { $ne: true } };

  if (label) return { ...filter, ...live, [`${s}.labels`]: label };
  switch (folder) {
    case 'inbox':
      return { ...filter, ...live, [`${s}.archived`]: { $ne: true } };
    case 'starred':
      return { ...filter, ...live, [`${s}.starred`]: true };
    case 'buyers':
      return side === 'seller' ? { ...filter, ...live, kind: 'direct', buyerIsCustomer: { $ne: true } } : null;
    case 'site':
      return { ...filter, ...live, kind: 'system' };
    case 'sent':
      return { ...filter, ...live, [`${s}.sentAt`]: { $exists: true } };
    case 'unread':
      return { ...filter, ...live, [`${s}.unread`]: true };
    case 'spam':
      return { ...filter, [`${s}.spam`]: true };
    case 'trash':
      return { ...filter, [`${s}.spam`]: { $ne: true }, [`${s}.trashed`]: true };
    default: // 'all'
      return { ...filter, ...live };
  }
}

function folderFilter(userId, folder, label) {
  const parts = SIDES.map((side) => folderFilterFor(side, userId, folder, label)).filter(Boolean);
  return parts.length === 1 ? parts[0] : { $or: parts };
}

const sideOf = (conv, userId) => {
  const uid = String(userId);
  if (String(conv.seller?._id ?? conv.seller) === uid) return 'seller';
  if (String(conv.buyer?._id ?? conv.buyer) === uid) return 'buyer';
  return null;
};

const personOf = (user, role) =>
  user && { id: String(user._id), name: role === 'seller' ? user.seller?.storeName || user.name : user.name, role };

const productOf = (p) => p && { id: String(p._id), title: p.title, slug: p.slug, coverImage: p.coverImage ?? null };

/** A conversation as one participant sees it. */
function summarize(conv, userId) {
  const side = sideOf(conv, userId);
  const state = conv[`${side}State`] ?? {};
  return {
    id: String(conv._id),
    kind: conv.kind,
    side,
    other: conv.kind === 'system' ? null : side === 'buyer' ? personOf(conv.seller, 'seller') : personOf(conv.buyer, 'buyer'),
    product: productOf(conv.product),
    lastMessage: conv.lastMessage?.at
      ? { body: conv.lastMessage.body, at: conv.lastMessage.at, fromMe: String(conv.lastMessage.sender ?? '') === String(userId) }
      : null,
    buyerIsCustomer: Boolean(conv.buyerIsCustomer),
    unread: Boolean(state.unread),
    starred: Boolean(state.starred),
    archived: Boolean(state.archived),
    spam: Boolean(state.spam),
    trashed: Boolean(state.trashed),
    labels: state.labels ?? [],
  };
}

function shapeMessage(msg, userId, senderName) {
  return {
    id: String(msg._id),
    body: msg.body,
    at: msg.createdAt,
    fromMe: Boolean(msg.sender) && String(msg.sender) === String(userId),
    senderName: msg.sender ? senderName : null,
    system: !msg.sender,
    auto: Boolean(msg.auto),
    product: productOf(msg.product),
  };
}

const POPULATE = [
  { path: 'buyer', select: 'name' },
  { path: 'seller', select: 'name seller.storeName' },
  { path: 'product', select: 'title slug coverImage' },
];

function cleanBody(body) {
  const text = String(body ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new InputError('Write a message first.', { body: 'Write a message first.' });
  if (text.length > MESSAGE_LIMITS.max) {
    throw new InputError(`Keep it under ${MESSAGE_LIMITS.max} characters.`, { body: `Keep it under ${MESSAGE_LIMITS.max} characters.` });
  }
  return text;
}

function cleanLabel(name) {
  const label = String(name ?? '').replace(/\s+/g, ' ').trim();
  if (!label) throw new InputError('Give the label a name.');
  if (label.length > MESSAGE_LIMITS.label) throw new InputError(`Labels can be up to ${MESSAGE_LIMITS.label} characters.`);
  return label;
}

const preview = (text) => (text.length > 190 ? `${text.slice(0, 189)}…` : text);

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Conversations with unread messages (outside spam and the bin) — the badge count. */
export async function countUnread(userId) {
  await connectDB();
  return Conversation.countDocuments(folderFilter(oid(userId), 'unread'));
}

/** Search across the other person's name / shop, the listing title and every message in the thread. */
async function searchFilter(userId, q) {
  const words = String(q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) return null;
  const rx = new RegExp(words.map((w) => escapeRegex(w.slice(0, 40))).join('.*'), 'i');

  const mine = await Conversation.find({ $or: [{ buyer: userId }, { seller: userId }] }).select('_id').limit(5000).lean();
  const [people, products, threads] = await Promise.all([
    User.find({ $or: [{ name: rx }, { 'seller.storeName': rx }] }).select('_id').limit(200).lean(),
    Product.find({ title: rx }).select('_id').limit(200).lean(),
    Message.distinct('conversation', { conversation: { $in: mine.map((c) => c._id) }, body: rx }),
  ]);
  const peopleIds = people.map((p) => p._id).filter((id) => String(id) !== String(userId));
  return {
    $or: [
      { buyer: { $in: peopleIds } },
      { seller: { $in: peopleIds } },
      { product: { $in: products.map((p) => p._id) } },
      { _id: { $in: threads } },
    ],
  };
}

/** One page of a folder (or a label), newest activity first. */
export async function listConversations(userId, { folder = 'inbox', label, q, page = 1 } = {}) {
  await connectDB();
  const me = oid(userId);
  const key = FOLDER_SET.has(folder) ? folder : 'inbox';
  const base = folderFilter(me, key, label ? String(label) : undefined);
  const search = await searchFilter(me, q);
  const filter = search ? { $and: [base, search] } : base;

  const limit = INBOX_PAGE_SIZE;
  const total = await Conversation.countDocuments(filter);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), totalPages);

  const items = await Conversation.find(filter)
    .sort({ 'lastMessage.at': -1, _id: -1 })
    .skip((current - 1) * limit)
    .limit(limit)
    .populate(POPULATE)
    .lean();

  return toPlain({
    items: items.map((c) => summarize(c, me)),
    folder: label ? null : key,
    label: label || null,
    pagination: { page: current, limit, total, totalPages },
  });
}

async function loadOwnConversation(userId, id) {
  if (!isId(id)) throw new InputError('Conversation not found.', {}, 404);
  await connectDB();
  const conv = await Conversation.findOne({ _id: id, $or: [{ buyer: userId }, { seller: userId }] }).populate(POPULATE).lean();
  const side = conv && sideOf(conv, userId);
  if (!conv || conv[`${side}State`]?.purged) throw new InputError('Conversation not found.', {}, 404);
  return { conv, side };
}

/**
 * A thread with its latest messages (or the ones before `before`, a message id, for "Load earlier").
 * Opening a thread marks it read.
 */
export async function getConversation(userId, id, { before } = {}) {
  const me = oid(userId);
  const { conv, side } = await loadOwnConversation(me, id);

  const filter = { conversation: conv._id };
  if (isId(before)) filter._id = { $lt: oid(before) };
  const batch = await Message.find(filter).sort({ _id: -1 }).limit(THREAD_PAGE_SIZE + 1).populate('product', 'title slug coverImage').lean();
  const hasMore = batch.length > THREAD_PAGE_SIZE;
  const messages = batch.slice(0, THREAD_PAGE_SIZE).reverse();

  const names = { [String(conv.buyer?._id)]: conv.buyer?.name, [String(conv.seller?._id)]: conv.seller?.seller?.storeName || conv.seller?.name };

  if (conv[`${side}State`]?.unread) {
    await Conversation.updateOne({ _id: conv._id }, { $set: { [`${side}State.unread`]: false } });
    conv[`${side}State`].unread = false;
    pushUnread([me]);
  }

  return toPlain({
    conversation: summarize(conv, me),
    messages: messages.map((m) => shapeMessage(m, me, names[String(m.sender)])),
    hasMore,
  });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Pushes fresh unread counts to each user's open tabs. */
async function pushUnread(userIds) {
  try {
    for (const id of userIds) emitToUsers([id], 'inbox:unread', { count: await countUnread(id) });
  } catch (err) {
    console.error('[messages] unread push failed', err);
  }
}

async function hasBoughtFrom(buyerId, sellerId) {
  return Boolean(await Order.exists({ user: buyerId, paymentStatus: 'paid', 'items.seller': sellerId }));
}

/**
 * Adds a message to a thread and moves it into the recipient's inbox (unless they marked it spam).
 * `side` is the sender's side, or null for a marketplace notice.
 */
async function appendMessage(conv, { side, senderId, body, productId, auto = false }) {
  const now = new Date();
  const msg = await Message.create({ conversation: conv._id, sender: senderId ?? undefined, body, product: productId ?? undefined, auto });

  const recipientSide = side ? otherSide(side) : 'seller';
  const recipient = conv[recipientSide]?._id ?? conv[recipientSide];
  const r = `${recipientSide}State`;
  const set = {
    lastMessage: { body: preview(body), sender: senderId ?? undefined, at: now },
    [`${r}.unread`]: true,
  };
  if (!conv[r]?.spam) Object.assign(set, { [`${r}.archived`]: false, [`${r}.trashed`]: false, [`${r}.purged`]: false });
  if (productId) set.product = productId;
  if (side) Object.assign(set, { [`${side}State.sentAt`]: now, [`${side}State.unread`]: false, [`${side}State.trashed`]: false, [`${side}State.purged`]: false });
  if (auto) set.autoRepliedAt = now;
  if (conv.kind === 'direct' && !conv.buyerIsCustomer && (await hasBoughtFrom(conv.buyer?._id ?? conv.buyer, conv.seller?._id ?? conv.seller))) {
    set.buyerIsCustomer = true;
  }

  const updated = await Conversation.findByIdAndUpdate(conv._id, { $set: set }, { new: true }).populate(POPULATE).lean();
  const populated = await Message.findById(msg._id).populate('product', 'title slug coverImage').lean();
  const senderName = side === 'seller' ? updated.seller?.seller?.storeName || updated.seller?.name : updated.buyer?.name;

  // Each participant gets the thread and message from their own point of view.
  const people = [recipient, senderId].filter(Boolean).map(String);
  for (const person of new Set(people)) {
    emitToUsers([person], 'message:new', {
      conversation: toPlain(summarize(updated, person)),
      message: toPlain(shapeMessage(populated, person, senderName)),
    });
  }
  pushUnread([...new Set(people)]);
  return { conversation: updated, message: populated };
}

/** The seller's away message, at most once a day per thread. */
async function maybeAutoReply(conv) {
  if (conv.kind !== 'direct') return;
  const sellerId = conv.seller?._id ?? conv.seller;
  const seller = await User.findById(sellerId).select('messaging.autoReply').lean();
  const auto = seller?.messaging?.autoReply;
  if (!auto?.enabled || !auto.message?.trim()) return;
  if (conv.autoRepliedAt && Date.now() - new Date(conv.autoRepliedAt).getTime() < AUTO_REPLY_EVERY_MS) return;
  await appendMessage(conv, { side: 'seller', senderId: sellerId, body: auto.message.trim(), auto: true });
}

/**
 * A buyer writes to a shop, from a listing (`productId`) or the shop itself (`sellerId`).
 * Reuses the pair's existing thread, so a buyer and a shop always have one conversation.
 */
export async function startConversation(userId, { productId, sellerId, body } = {}) {
  const text = cleanBody(body);
  await connectDB();
  const me = oid(userId);

  let product = null;
  if (productId) {
    if (!isId(productId)) throw new InputError('Listing not found.', {}, 404);
    product = await Product.findOne({ _id: productId, ...PUBLIC_PRODUCT_FILTER }).select('sellerId').lean();
    if (!product) throw new InputError('Listing not found.', {}, 404);
    if (!product.sellerId) throw new InputError('This item is sold by the marketplace itself — please use the contact page.', {}, 422);
    sellerId = product.sellerId;
  }
  if (!isId(sellerId)) throw new InputError('Shop not found.', {}, 404);
  if (String(sellerId) === String(me)) throw new InputError('You can’t message your own shop.', {}, 422);

  const shop = await User.findOne({ _id: sellerId, role: 'seller', 'seller.storeName': { $type: 'string' } }).select('_id').lean();
  if (!shop) throw new InputError('Shop not found.', {}, 404);

  const key = { kind: 'direct', buyer: me, seller: shop._id };
  let conv;
  try {
    conv = await Conversation.findOneAndUpdate(key, { $setOnInsert: key }, { upsert: true, new: true }).lean();
  } catch (err) {
    if (err?.code !== 11000) throw err;
    conv = await Conversation.findOne(key).lean(); // two first messages at once: the other request created it
  }
  if (conv.buyerState?.spam) throw new InputError('You can’t message this shop right now.', {}, 403);

  const { conversation, message } = await appendMessage(conv, { side: 'buyer', senderId: me, body: text, productId: product?._id });
  await maybeAutoReply(conversation);
  return toPlain({ conversationId: String(conversation._id), message: shapeMessage(message, me) });
}

/** A reply in an existing thread. Marketplace notices are read-only. */
export async function sendMessage(userId, conversationId, body) {
  const text = cleanBody(body);
  const me = oid(userId);
  const { conv, side } = await loadOwnConversation(me, conversationId);
  if (conv.kind !== 'direct') throw new InputError('You can’t reply to marketplace notices.', {}, 422);

  const { conversation, message } = await appendMessage(conv, { side, senderId: me, body: text });
  if (side === 'buyer') await maybeAutoReply(conversation);
  return toPlain({ conversation: summarize(conversation, me), message: shapeMessage(message, me) });
}

/** A notice from the marketplace to one user ("From Sellpify"): listing approved, rejected… */
export async function sendSystemMessage(userId, body) {
  if (!isId(userId)) return;
  try {
    await connectDB();
    const key = { kind: 'system', seller: oid(userId) };
    let conv;
    try {
      conv = await Conversation.findOneAndUpdate(key, { $setOnInsert: key }, { upsert: true, new: true }).lean();
    } catch (err) {
      if (err?.code !== 11000) throw err;
      conv = await Conversation.findOne(key).lean();
    }
    await appendMessage(conv, { side: null, senderId: null, body: cleanBody(body) });
  } catch (err) {
    console.error('[messages] system message failed', err); // a notice must never fail the action behind it
  }
}

// ---------------------------------------------------------------------------
// Bulk actions (the toolbar)
// ---------------------------------------------------------------------------

const ACTIONS = {
  read: (s) => ({ $set: { [`${s}.unread`]: false } }),
  unread: (s) => ({ $set: { [`${s}.unread`]: true } }),
  star: (s) => ({ $set: { [`${s}.starred`]: true } }),
  unstar: (s) => ({ $set: { [`${s}.starred`]: false } }),
  archive: (s) => ({ $set: { [`${s}.archived`]: true } }),
  inbox: (s) => ({ $set: { [`${s}.archived`]: false, [`${s}.trashed`]: false, [`${s}.spam`]: false } }),
  trash: (s) => ({ $set: { [`${s}.trashed`]: true } }),
  notspam: (s) => ({ $set: { [`${s}.spam`]: false } }),
  report: (s) => ({ $set: { [`${s}.spam`]: true, [`${s}.reportedAt`]: new Date() } }),
  delete: (s) => ({ $set: { [`${s}.purged`]: true, [`${s}.unread`]: false } }),
};
export const MESSAGE_ACTIONS = [...Object.keys(ACTIONS), 'labels'];

/** Lets the marketplace team see what was reported (it lands in /admin/messages). */
async function fileReports(userId, ids) {
  const reporter = await User.findById(userId).select('name email').lean();
  const convs = await Conversation.find({ _id: { $in: ids }, kind: 'direct', $or: [{ buyer: userId }, { seller: userId }] })
    .populate(POPULATE)
    .lean();
  if (!reporter || !convs.length) return;
  await ContactMessage.insertMany(
    convs.map((c) => {
      const s = summarize(c, userId);
      return {
        name: reporter.name,
        email: reporter.email,
        user: userId,
        message: `[Reported conversation ${s.id}] ${reporter.name} reported their conversation with ${s.other?.name ?? 'a user'} (${s.other?.role ?? 'user'}, id ${s.other?.id ?? '—'}). Last message: “${s.lastMessage?.body ?? ''}”`.slice(0, 2000),
      };
    }),
  );
}

/**
 * Applies a toolbar action to the user's selected conversations.
 * `labels` takes { add: [names], remove: [names] }; `delete` only works on threads in Spam or the Recycling bin.
 */
export async function applyConversationAction(userId, { ids, action, add = [], remove = [] } = {}) {
  if (!MESSAGE_ACTIONS.includes(action)) throw new InputError('Unknown action.');
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter(isId);
  if (!list.length) throw new InputError('Select at least one conversation.');
  if (list.length > MAX_BULK) throw new InputError(`Select up to ${MAX_BULK} conversations at a time.`);

  await connectDB();
  const me = oid(userId);
  const objectIds = list.map(oid);
  let labelAdds = [];
  let labelRemoves = [];
  if (action === 'labels') {
    labelAdds = [...new Set((Array.isArray(add) ? add : []).map(cleanLabel))];
    labelRemoves = [...new Set((Array.isArray(remove) ? remove : []).map(cleanLabel))];
    if (labelAdds.length) await saveLabels(me, labelAdds);
  }

  let modified = 0;
  for (const side of SIDES) {
    const s = `${side}State`;
    const filter = { _id: { $in: objectIds }, [side]: me };
    if (action === 'delete') filter.$or = [{ [`${s}.trashed`]: true }, { [`${s}.spam`]: true }];

    if (action === 'labels') {
      if (labelAdds.length) modified += (await Conversation.updateMany(filter, { $addToSet: { [`${s}.labels`]: { $each: labelAdds } } })).modifiedCount;
      if (labelRemoves.length) modified += (await Conversation.updateMany(filter, { $pull: { [`${s}.labels`]: { $in: labelRemoves } } })).modifiedCount;
    } else {
      modified += (await Conversation.updateMany(filter, ACTIONS[action](s))).modifiedCount;
    }
  }
  if (action === 'report') await fileReports(me, objectIds);

  emitToUsers([me], 'inbox:changed', { action });
  pushUnread([me]);
  return { modified };
}

// ---------------------------------------------------------------------------
// Labels & reply preferences
// ---------------------------------------------------------------------------

async function saveLabels(userId, names) {
  const user = await User.findById(userId).select('messaging.labels').lean();
  const existing = user?.messaging?.labels ?? [];
  const merged = [...existing];
  for (const n of names) if (!merged.some((e) => e.toLowerCase() === n.toLowerCase())) merged.push(n);
  if (merged.length > MESSAGE_LIMITS.labels) throw new InputError(`You can have up to ${MESSAGE_LIMITS.labels} labels.`);
  if (merged.length !== existing.length) await User.updateOne({ _id: userId }, { $set: { 'messaging.labels': merged } });
  return merged;
}

export async function getMessagingSettings(userId) {
  await connectDB();
  const user = await User.findById(userId).select('role messaging').lean();
  return {
    labels: user?.messaging?.labels ?? [],
    autoReply: { enabled: Boolean(user?.messaging?.autoReply?.enabled), message: user?.messaging?.autoReply?.message ?? '' },
    isSeller: user?.role === 'seller',
  };
}

export async function createLabel(userId, name) {
  await connectDB();
  return { labels: await saveLabels(oid(userId), [cleanLabel(name)]) };
}

/** Removes a label from the user's list and from every thread it was on. */
export async function deleteLabel(userId, name) {
  const label = cleanLabel(name);
  await connectDB();
  const me = oid(userId);
  await User.updateOne({ _id: me }, { $pull: { 'messaging.labels': label } });
  for (const side of SIDES) await Conversation.updateMany({ [side]: me }, { $pull: { [`${side}State.labels`]: label } });
  emitToUsers([me], 'inbox:changed', { action: 'labels' });
  return getMessagingSettings(me);
}

export async function updateAutoReply(userId, { enabled, message } = {}) {
  const text = String(message ?? '').trim();
  if (enabled && !text) throw new InputError('Write the message buyers will receive.', { message: 'Write the message buyers will receive.' });
  if (text.length > MESSAGE_LIMITS.autoReply) {
    throw new InputError(`Keep it under ${MESSAGE_LIMITS.autoReply} characters.`, { message: `Keep it under ${MESSAGE_LIMITS.autoReply} characters.` });
  }
  await connectDB();
  await User.updateOne({ _id: oid(userId) }, { $set: { 'messaging.autoReply': { enabled: Boolean(enabled), message: text } } });
  return getMessagingSettings(userId);
}

// ---------------------------------------------------------------------------
// Real-time hooks for server.js
// ---------------------------------------------------------------------------

const peers = new Map(); // `${userId}:${conversationId}` → { peer, at } — typing events fire often

async function peerOf(userId, conversationId) {
  if (!isId(userId) || !isId(conversationId)) return null;
  const key = `${userId}:${conversationId}`;
  const hit = peers.get(key);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.peer;

  await connectDB();
  const conv = await Conversation.findOne({ _id: conversationId, kind: 'direct', $or: [{ buyer: userId }, { seller: userId }] })
    .select('buyer seller')
    .lean();
  const peer = conv ? String(String(conv.buyer) === String(userId) ? conv.seller : conv.buyer) : null;
  if (peers.size > 10_000) peers.clear();
  peers.set(key, { peer, at: Date.now() });
  return peer;
}

installRealtimeHooks({ peerOf });

/** Ticket for the browser's socket. Imported from here so the hooks above are installed before any socket connects. */
export const createSocketTicket = (userId) => issueSocketTicket(userId);
