import { siteConfig } from './site.js';

// Inbox folders and toolbar actions, shared by the server (lib/data/messages.js) and the inbox UI.

/** Sidebar folders, in order. `sellerOnly` ones are hidden for accounts without a shop. */
export const FOLDERS = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'starred', label: 'Starred' },
  { key: 'buyers', label: 'From potential buyers', sellerOnly: true },
  { key: 'site', label: `From ${siteConfig.name}` },
  { key: 'sent', label: 'Sent' },
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'spam', label: 'Spam' },
  { key: 'trash', label: 'Recycling bin' },
];
export const FOLDER_KEYS = FOLDERS.map((f) => f.key);

const ACTION_LABELS = {
  trash: 'Recycling bin',
  delete: 'Delete',
  unread: 'Mark Unread',
  read: 'Mark Read',
  report: 'Report',
  archive: 'Archive',
  notspam: 'Not Spam',
};

const DEFAULT_ACTIONS = ['trash', 'unread', 'read', 'report', 'archive'];
const FOLDER_ACTIONS = {
  all: ['trash', 'unread', 'read', ['inbox', 'Add to Inbox'], 'report'],
  unread: ['trash', 'read', 'report', 'archive'],
  spam: ['delete', 'unread', 'read', 'notspam'],
  trash: ['delete', 'unread', 'read', ['inbox', 'Move to Inbox'], 'report'],
};

/** Toolbar buttons for a folder (a label view uses the inbox set): [{ action, label }]. "Label" is always added by the UI. */
export function actionsFor(folder) {
  return (FOLDER_ACTIONS[folder] ?? DEFAULT_ACTIONS).map((a) => (Array.isArray(a) ? { action: a[0], label: a[1] } : { action: a, label: ACTION_LABELS[a] }));
}

/** "Just now", "5m", "3:42 PM", "Mon", "Mar 4", "Mar 4, 2024" — compact inbox timestamps. */
export function inboxTime(value, now = new Date()) {
  const d = new Date(value);
  const diff = now - d;
  if (diff < 60_000) return 'Just now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diff < 6 * 24 * 60 * 60_000) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
