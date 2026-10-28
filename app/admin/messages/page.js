import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import Pagination from '@/components/Pagination';
import MessageStatusButton from '@/components/admin/MessageStatusButton';
import SupportInbox from '@/components/admin/SupportInbox';
import { PageHeader, EmptyState, StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import { requireAdmin } from '@/lib/auth';
import { countOpenContactMessages, getContactMessages } from '@/lib/data/contact';
import { findSupportThreadForUser, getUserForSupport, listSupportThreads } from '@/lib/data/support';

export const metadata = { title: 'Messages' };

const CONTACT_FILTERS = [
  { id: '', label: 'All' },
  { id: 'new', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];

function Tabs({ active, chatsOpen, contactOpen }) {
  const tab = (key, href, label, count) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-[15px] transition-colors ${active === key ? 'border-black font-medium text-black' : 'border-transparent text-stone-500 hover:text-black'}`}
    >
      {label}
      {count > 0 && <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-white">{count}</span>}
    </Link>
  );
  return (
    <nav aria-label="Message type" className="mb-6 flex gap-7 border-b border-stone-200">
      {tab('chats', '/admin/messages', 'Chats', chatsOpen)}
      {tab('contact', '/admin/messages?view=contact', 'Contact form', contactOpen)}
    </nav>
  );
}

/**
 * Admin messages:
 *  - Chats: live support chats with buyers and sellers (reply as the team, resolve, start a new chat).
 *    Buyer ↔ seller conversations are private to them and never appear here.
 *  - Contact form: messages from /contact. Signed-in senders can be answered in a chat; guests by email.
 */
export default async function AdminMessagesPage({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;

  if (sp.view === 'contact') {
    const status = CONTACT_FILTERS.some((f) => f.id === sp.status) ? sp.status : '';
    const [{ items, open, pagination }, chats] = await Promise.all([getContactMessages({ status, page: sp.page }), listSupportThreads({ status: 'open' })]);
    return (
      <>
        <PageHeader title="Messages" description="Messages from the Contact Us page. Answer signed-in users in a chat, guests by email, then mark them resolved." />
        <Tabs active="contact" chatsOpen={chats.counts.unread} contactOpen={open} />

        <nav aria-label="Filter messages" className="mb-5 flex flex-wrap gap-2">
          {CONTACT_FILTERS.map((f) => (
            <Link
              key={f.id || 'all'}
              href={f.id ? `/admin/messages?view=contact&status=${f.id}` : '/admin/messages?view=contact'}
              aria-current={status === f.id ? 'page' : undefined}
              className={`btn btn-sm ${status === f.id ? 'btn-dark' : 'btn-outline'}`}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {items.length === 0 ? (
          <EmptyState title={status ? 'No messages here' : 'No messages yet'}>Messages from the Contact Us page appear here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {items.map((m) => {
              const { date, time } = formatDateTime(m.createdAt);
              return (
                <li key={m._id} className={`rounded-2xl border bg-white p-5 ${m.status === 'new' ? 'border-stone-300' : 'border-stone-200 opacity-80'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <StatusBadge status={m.status === 'new' ? 'pending' : 'completed'} label={m.status === 'new' ? 'Open' : 'Resolved'} />
                        {m.user && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">Signed in</span>}
                      </p>
                      <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message')}`} className="mt-0.5 block truncate text-sm text-brand-600 hover:underline">
                        {m.email}
                      </a>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                      <span className="text-xs text-stone-500">
                        {date} · {time}
                      </span>
                      {m.user && (
                        <Link href={`/admin/messages?user=${m.user}`} className="btn btn-sm btn-outline">
                          <MessageSquare size={15} strokeWidth={1.75} aria-hidden="true" />
                          Reply in chat
                        </Link>
                      )}
                      <MessageStatusButton id={m._id} status={m.status} />
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-line break-words border-t border-stone-100 pt-4 text-sm leading-relaxed text-stone-700">{m.message}</p>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/messages" params={{ view: 'contact', status }} />
      </>
    );
  }

  // Chats. ?user=<id> (from a user's page or a contact message) opens their chat, or a new message to them.
  let prefillUser = null;
  if (sp.user) {
    const threadId = await findSupportThreadForUser(sp.user);
    if (threadId) redirect(`/admin/messages?t=${threadId}`);
    prefillUser = await getUserForSupport(sp.user);
  }
  const [initialList, contactOpen] = await Promise.all([
    listSupportThreads({ status: sp.status, q: sp.q, page: sp.page }),
    countOpenContactMessages(),
  ]);

  return (
    <>
      <PageHeader
        title="Messages"
        description={`Live chats with buyers and sellers — ${initialList.counts.open} open. Replies arrive in their Messages as the Sellpify team. Conversations between buyers and sellers stay private to them.`}
      />
      <Tabs active="chats" chatsOpen={initialList.counts.unread} contactOpen={contactOpen} />
      <SupportInbox initialList={initialList} prefillUser={prefillUser} />
    </>
  );
}
