import Link from 'next/link';
import Pagination from '@/components/Pagination';
import MessageStatusButton from '@/components/admin/MessageStatusButton';
import { PageHeader, EmptyState, StatusBadge, formatDateTime } from '@/components/dashboard/ui';
import { getContactMessages } from '@/lib/data/contact';

export const metadata = { title: 'Messages' };

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'new', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];

/** Messages sent through /contact. Open ones first; reply by email, then mark them resolved. */
export default async function AdminMessagesPage({ searchParams }) {
  const sp = await searchParams;
  const status = FILTERS.some((f) => f.id === sp.status) ? sp.status : '';
  const { items, open, pagination } = await getContactMessages({ status, page: sp.page });

  return (
    <>
      <PageHeader
        title="Messages"
        description={`${open} open message${open === 1 ? '' : 's'} · from the Contact Us page. Reply by email, then mark them resolved.`}
      />

      <nav aria-label="Filter messages" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id || 'all'}
            href={f.id ? `/admin/messages?status=${f.id}` : '/admin/messages'}
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
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message')}`}
                      className="mt-0.5 block truncate text-sm text-brand-600 hover:underline"
                    >
                      {m.email}
                    </a>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-stone-500">
                      {date} · {time}
                    </span>
                    <MessageStatusButton id={m._id} status={m.status} />
                  </div>
                </div>
                <p className="mt-4 whitespace-pre-line break-words border-t border-stone-100 pt-4 text-sm leading-relaxed text-stone-700">{m.message}</p>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination page={pagination.page} totalPages={pagination.totalPages} basePath="/admin/messages" params={{ status }} />
    </>
  );
}
