import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { escapeRegex, toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { appendMessage, cleanBody, countSupportUnread, systemThreadFor } from '@/lib/data/messages';
import { emitToRoom } from '@/lib/realtime';
import Conversation from '@/models/Conversation';
import Message from '@/models/Message';
import User from '@/models/User';

// ---------------------------------------------------------------------------
// Admin support inbox (/admin/messages → Chats).
//
// Each user has one thread with the marketplace (Conversation kind 'system'). Admins answer as the team: their
// messages have no `sender` (the user sees "Sellpify") and record the admin in `staff`. The team shares one
// read/resolved state per chat (Conversation.supportState). Callers authorize the admin (authorizeAdminRequest).
// ---------------------------------------------------------------------------

export const SUPPORT_PAGE_SIZE = 25;
const THREAD_PAGE_SIZE = 60;
const STATUSES = ['open', 'resolved'];
const BASE = { kind: 'system', support: true };

const isId = (v) => mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(String(v));
const USER_FIELDS = 'name email role seller.storeName';

const personOf = (u) => u && { id: String(u._id), name: u.name, email: u.email, role: u.role, storeName: u.seller?.storeName ?? null };

function shapeThread(c) {
  return {
    id: String(c._id),
    user: personOf(c.seller),
    status: c.supportState?.status ?? 'open',
    unread: Boolean(c.supportState?.unread),
    lastMessage: c.lastMessage?.at ? { body: c.lastMessage.body, at: c.lastMessage.at, fromTeam: !c.lastMessage.sender } : null,
  };
}

function shapeMessage(m, userName) {
  return {
    id: String(m._id),
    body: m.body,
    at: m.createdAt,
    fromTeam: !m.sender, // an admin reply or an automatic notice
    notice: !m.sender && !m.team,
    staffName: m.staff?.name ?? null,
    senderName: m.sender ? userName : null,
  };
}

/** Chats, newest activity first; `status` = open | resolved, `q` matches the user's name, email or shop. */
export async function listSupportThreads({ status, q, page } = {}) {
  await connectDB();
  const filter = { ...BASE };
  if (STATUSES.includes(status)) filter['supportState.status'] = status;
  const query = String(q ?? '').trim().slice(0, 80);
  if (query) {
    const rx = new RegExp(escapeRegex(query), 'i');
    const users = await User.find({ $or: [{ name: rx }, { email: rx }, { 'seller.storeName': rx }] }).select('_id').limit(200).lean();
    filter.seller = { $in: users.map((u) => u._id) };
  }

  const [total, open, unread] = await Promise.all([
    Conversation.countDocuments(filter),
    Conversation.countDocuments({ ...BASE, 'supportState.status': 'open' }),
    countSupportUnread(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / SUPPORT_PAGE_SIZE));
  const current = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), totalPages);
  const items = await Conversation.find(filter)
    .sort({ 'lastMessage.at': -1, _id: -1 })
    .skip((current - 1) * SUPPORT_PAGE_SIZE)
    .limit(SUPPORT_PAGE_SIZE)
    .populate('seller', USER_FIELDS)
    .lean();

  return toPlain({ items: items.map(shapeThread), counts: { open, unread }, pagination: { page: current, limit: SUPPORT_PAGE_SIZE, total, totalPages } });
}

async function loadThread(id) {
  if (!isId(id)) throw new InputError('Chat not found.', {}, 404);
  await connectDB();
  const conv = await Conversation.findOne({ _id: id, kind: 'system' }).populate('seller', USER_FIELDS).lean();
  if (!conv) throw new InputError('Chat not found.', {}, 404);
  return conv;
}

/** A chat with its latest messages (or those before `before`). Opening it marks it read for the team. */
export async function getSupportThread(id, { before } = {}) {
  const conv = await loadThread(id);
  const filter = { conversation: conv._id };
  if (isId(before)) filter._id = { $lt: new mongoose.Types.ObjectId(String(before)) };
  const batch = await Message.find(filter).sort({ _id: -1 }).limit(THREAD_PAGE_SIZE + 1).populate('staff', 'name').lean();
  const hasMore = batch.length > THREAD_PAGE_SIZE;

  if (conv.supportState?.unread) {
    await Conversation.updateOne({ _id: conv._id }, { $set: { 'supportState.unread': false } });
    conv.supportState.unread = false;
    emitToRoom('admins', 'support:unread', { count: await countSupportUnread() });
  }
  return toPlain({
    thread: shapeThread(conv),
    messages: batch.slice(0, THREAD_PAGE_SIZE).reverse().map((m) => shapeMessage(m, conv.seller?.name)),
    hasMore,
  });
}

async function postAsTeam(conv, adminId, body) {
  const { conversation, message } = await appendMessage(conv, { side: null, senderId: null, team: true, staffId: isId(adminId) ? adminId : null, body });
  const staff = isId(adminId) ? await User.findById(adminId).select('name').lean() : null;
  return toPlain({ thread: shapeThread({ ...conversation, seller: conv.seller }), message: shapeMessage({ ...message, staff }, conv.seller?.name) });
}

/** An admin's reply in a chat. */
export async function replyAsTeam(adminId, threadId, body) {
  const text = cleanBody(body);
  return postAsTeam(await loadThread(threadId), adminId, text);
}

/** An admin starts (or continues) a chat with any user, by id or email. */
export async function messageUser(adminId, { userId, email, body } = {}) {
  const text = cleanBody(body);
  await connectDB();
  const user = isId(userId)
    ? await User.findById(userId).select('_id').lean()
    : email
      ? await User.findOne({ email: String(email).trim().toLowerCase() }).select('_id').lean()
      : null;
  if (!user) throw new InputError('User not found.', { user: 'Pick a user to message.' }, 404);
  const conv = await systemThreadFor(user._id);
  const populated = await Conversation.findById(conv._id).populate('seller', USER_FIELDS).lean();
  return postAsTeam(populated, adminId, text);
}

/** Resolve / reopen a chat. A new message from the user reopens it automatically. */
export async function setSupportStatus(id, status) {
  if (!STATUSES.includes(status)) throw new InputError('Invalid status.');
  const conv = await loadThread(id);
  await Conversation.updateOne({ _id: conv._id }, { $set: { 'supportState.status': status, ...(status === 'resolved' && { 'supportState.unread': false }) } });
  emitToRoom('admins', 'support:new', { threadId: String(conv._id) });
  emitToRoom('admins', 'support:unread', { count: await countSupportUnread() });
  return { id: String(conv._id), status };
}

/** The user's chat id, if they have one with any messages from people (for /admin/messages?user=…). */
export async function findSupportThreadForUser(userId) {
  if (!isId(userId)) return null;
  await connectDB();
  const conv = await Conversation.findOne({ kind: 'system', seller: userId }).select('_id').lean();
  return conv ? String(conv._id) : null;
}

/** "New message" picker: users by name, email or shop name. */
export async function searchUsers(q) {
  const query = String(q ?? '').trim().slice(0, 80);
  await connectDB();
  const filter = query
    ? { $or: [{ name: new RegExp(escapeRegex(query), 'i') }, { email: new RegExp(escapeRegex(query), 'i') }, { 'seller.storeName': new RegExp(escapeRegex(query), 'i') }] }
    : {};
  const users = await User.find(filter).select(USER_FIELDS).sort({ createdAt: -1 }).limit(8).lean();
  return toPlain(users.map(personOf));
}

/** One user for a prefilled "New message" (from a user's admin page). */
export async function getUserForSupport(userId) {
  if (!isId(userId)) return null;
  await connectDB();
  const u = await User.findById(userId).select(USER_FIELDS).lean();
  return u ? toPlain(personOf(u)) : null;
}
