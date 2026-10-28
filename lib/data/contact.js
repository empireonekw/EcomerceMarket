import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { toPlain } from '@/lib/utils';
import { InputError } from '@/lib/data/product-writes';
import { normalizeEmail, validateContactMessage } from '@/lib/validation';
import ContactMessage from '@/models/ContactMessage';

export const MESSAGES_PAGE_SIZE = 20;
const STATUSES = ['new', 'resolved'];

const toInt = (v, d) => (Number.parseInt(v, 10) > 0 ? Number.parseInt(v, 10) : d);

/** Saves a /contact submission. `userId` links it to the signed-in sender, if any. */
export async function createContactMessage(input, { userId } = {}) {
  const fields = validateContactMessage(input);
  if (Object.keys(fields).length) throw new InputError('Please fix the highlighted fields.', fields);

  await connectDB();
  const doc = await ContactMessage.create({
    name: String(input.name).trim(),
    email: normalizeEmail(input.email),
    message: String(input.message).trim(),
    ...(mongoose.isValidObjectId(userId) && { user: userId }),
  });
  return { id: String(doc._id) };
}

/** Admin inbox: open messages first, newest first, paginated. `status` filters to one state. */
export async function getContactMessages({ status, page } = {}) {
  await requireAdmin();
  await connectDB();

  const filter = STATUSES.includes(status) ? { status } : {};
  const limit = MESSAGES_PAGE_SIZE;
  const [total, open] = await Promise.all([ContactMessage.countDocuments(filter), ContactMessage.countDocuments({ status: 'new' })]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const current = Math.min(toInt(page, 1), totalPages);

  const items = await ContactMessage.find(filter)
    .select('name email message status user createdAt')
    .sort(filter.status ? { createdAt: -1 } : { status: 1, createdAt: -1 }) // 'new' sorts before 'resolved'
    .skip((current - 1) * limit)
    .limit(limit)
    .lean();

  return toPlain({ items, open, pagination: { page: current, limit, total, totalPages } });
}

/** Open (unanswered) contact-form messages, for the admin Messages tabs. */
export async function countOpenContactMessages() {
  await requireAdmin();
  await connectDB();
  return ContactMessage.countDocuments({ status: 'new' });
}

/** Marks a message new/resolved. Callers authorize (PATCH /api/admin/messages/[id]). */
export async function setContactMessageStatus(id, status) {
  if (!mongoose.isValidObjectId(id)) throw new InputError('Message not found.', {}, 404);
  if (!STATUSES.includes(status)) throw new InputError('Invalid status.');
  await connectDB();
  const doc = await ContactMessage.findByIdAndUpdate(id, { status }, { new: true }).select('status').lean();
  if (!doc) throw new InputError('Message not found.', {}, 404);
  return { id, status: doc.status };
}
