'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, PenSquare, RotateCcw, Search, Send, X } from 'lucide-react';
import { inboxTime } from '@/lib/messaging';
import { MESSAGE_LIMITS } from '@/lib/validation';
import { siteConfig } from '@/lib/site';
import EmptyInbox from '@/components/messages/EmptyInbox';
import { Initial } from '@/components/messages/ThreadView';
import { inboxApi } from '@/components/messages/inbox-api';
import { useMessaging, useMessagingEvents } from '@/components/messages/MessagingProvider';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
];
const ROLE = { customer: 'Buyer', seller: 'Seller', admin: 'Admin' };
const clock = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function readView(sp) {
  return { status: ['open', 'resolved'].includes(sp.get('status')) ? sp.get('status') : '', q: sp.get('q') || '', page: Math.max(1, Number(sp.get('page')) || 1), t: sp.get('t') || null };
}

function StatusPill({ status }) {
  return status === 'resolved' ? (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Resolved</span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Open</span>
  );
}

/** "New message": pick any user and write to them as the Sellpify team. */
function NewMessageDialog({ dialogRef, prefillUser, onSent }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [user, setUser] = useState(prefillUser ?? null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();

  useEffect(() => setUser(prefillUser ?? null), [prefillUser]);
  useEffect(() => {
    if (user) return undefined;
    const timer = setTimeout(async () => {
      const { ok, data } = await inboxApi(`/api/admin/support/users?q=${encodeURIComponent(q)}`);
      if (ok) setResults(data.users);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, user]);

  async function send(e) {
    e.preventDefault();
    if (!user) return setError('Pick who to message.');
    setBusy(true);
    const { ok, data } = await inboxApi('/api/admin/support', { method: 'POST', body: { userId: user.id, body } });
    setBusy(false);
    if (!ok) return setError(data.fields?.body || data.error || 'Not sent.');
    setBody('');
    setError('');
    setQ('');
    dialogRef.current?.close();
    onSent(data.thread.id);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-t`}
      onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40"
    >
      <form onSubmit={send} className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={`${id}-t`} className="text-xl font-semibold">
              New message
            </h2>
            <p className="mt-1 text-sm text-stone-500">Arrives in their Messages as a chat with the {siteConfig.name} team.</p>
          </div>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-black">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-5 text-sm font-medium">To</p>
        {user ? (
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-stone-200 p-3">
            <Initial name={user.name} className="size-9 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user.name} <span className="font-normal text-stone-500">· {ROLE[user.role] ?? user.role}</span>
              </p>
              <p className="truncate text-xs text-stone-500">{user.email}</p>
            </div>
            <button type="button" onClick={() => setUser(null)} className="text-sm font-medium text-brand-600 hover:underline">
              Change
            </button>
          </div>
        ) : (
          <div className="mt-2">
            <label htmlFor={`${id}-q`} className="sr-only">
              Search users
            </label>
            <input
              id={`${id}-q`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email or shop"
              className="h-11 w-full rounded-xl border border-stone-300 px-4 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
            />
            <ul className="mt-2 max-h-56 overflow-y-auto">
              {results.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => setUser(u)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-100">
                    <Initial name={u.name} className="size-8 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {u.name}
                        {u.storeName && <span className="font-normal text-stone-500"> · {u.storeName}</span>}
                      </span>
                      <span className="block truncate text-xs text-stone-500">{u.email}</span>
                    </span>
                    <span className="text-xs text-stone-500">{ROLE[u.role] ?? u.role}</span>
                  </button>
                </li>
              ))}
              {!results.length && <li className="px-2 py-3 text-sm text-stone-500">No users found.</li>}
            </ul>
          </div>
        )}

        <label htmlFor={`${id}-b`} className="mt-4 block text-sm font-medium">
          Message
        </label>
        <textarea
          id={`${id}-b`}
          rows={5}
          value={body}
          maxLength={MESSAGE_LIMITS.max}
          onChange={(e) => {
            setBody(e.target.value);
            setError('');
          }}
          placeholder="Hi! I’m from the Sellpify team…"
          className="mt-2 w-full resize-none rounded-xl border border-stone-300 p-4 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={busy || !body.trim() || !user} className="btn btn-md btn-dark">
            {busy ? 'Sending…' : 'Send message'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** An open chat: the user's messages on the left, the team's on the right, live. */
function SupportThread({ threadId, onBack, onChanged }) {
  const [state, setState] = useState({ loading: true, error: '', thread: null, messages: [], hasMore: false });
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const stick = useRef(true);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setState((s) => ({ ...s, loading: true, error: '' }));
      const { ok, data } = await inboxApi(`/api/admin/support/${threadId}`);
      if (!ok) return setState((s) => ({ ...s, loading: false, error: data.error || 'Couldn’t open this chat.' }));
      setState({ loading: false, error: '', thread: data.thread, messages: data.messages, hasMore: data.hasMore });
    },
    [threadId],
  );

  useEffect(() => {
    stick.current = true;
    setDraft('');
    load();
  }, [load]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [state.messages]);

  useMessagingEvents(['support:new', 'resync', 'poll'], (event, payload) => {
    if (event !== 'support:new' || payload?.threadId === threadId) load({ quiet: true });
  });

  async function send(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    stick.current = true;
    const { ok, data } = await inboxApi(`/api/admin/support/${threadId}`, { method: 'POST', body: { body } });
    setBusy(false);
    if (!ok) return setSendError(data.error || 'Not sent. Please try again.');
    setDraft('');
    setSendError('');
    setState((s) => (s.messages.some((m) => m.id === data.message.id) ? s : { ...s, messages: [...s.messages, data.message] }));
    onChanged();
  }

  async function setStatus(status) {
    const { ok } = await inboxApi(`/api/admin/support/${threadId}`, { method: 'PATCH', body: { status } });
    if (ok) {
      setState((s) => ({ ...s, thread: { ...s.thread, status } }));
      onChanged();
    }
  }

  const { thread } = state;
  const user = thread?.user;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-16 flex-wrap items-center gap-3 border-b border-stone-200 px-3 py-2 sm:px-5">
        <button type="button" onClick={onBack} aria-label="Back to chats" className="grid size-10 place-items-center rounded-full hover:bg-stone-100 lg:hidden">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        {user && (
          <>
            <Initial name={user.name} className="size-10 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-semibold">
                {user.name}
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">{ROLE[user.role] ?? user.role}</span>
                <StatusPill status={thread.status} />
              </p>
              <p className="truncate text-xs text-stone-500">
                {user.email}
                {user.storeName && ` · ${user.storeName}`} ·{' '}
                <Link href={`/admin/users/${user.id}`} className="text-brand-600 hover:underline">
                  View user
                </Link>
              </p>
            </div>
            {thread.status === 'resolved' ? (
              <button type="button" onClick={() => setStatus('open')} className="btn btn-sm btn-outline">
                <RotateCcw size={15} aria-hidden="true" />
                Reopen
              </button>
            ) : (
              <button type="button" onClick={() => setStatus('resolved')} className="btn btn-sm btn-dark">
                <CheckCircle2 size={15} aria-hidden="true" />
                Mark resolved
              </button>
            )}
          </>
        )}
      </div>

      {state.loading ? (
        <div className="grid flex-1 place-items-center py-24 text-stone-400">
          <Loader2 className="animate-spin" size={28} aria-label="Loading chat" />
        </div>
      ) : state.error ? (
        <p className="grid flex-1 place-items-center p-10 text-center font-medium">{state.error}</p>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={(e) => (stick.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 80)}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-stone-50/60 px-4 py-6 sm:px-8"
          >
            {!state.messages.length && <p className="text-center text-sm text-stone-500">No messages yet. Say hello below.</p>}
            {state.messages.map((m) =>
              m.notice ? (
                <div key={m.id} className="mx-auto max-w-lg rounded-xl border border-dashed border-stone-300 bg-white px-4 py-3 text-center text-sm text-stone-600">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Automatic notice · {clock(m.at)}</p>
                  {m.body}
                </div>
              ) : (
                <div key={m.id} className={`flex items-end gap-2 ${m.fromTeam ? 'justify-end' : 'justify-start'}`}>
                  {!m.fromTeam && <Initial name={user?.name} className="size-8 text-xs" />}
                  <div className={`flex max-w-[80%] flex-col gap-1 sm:max-w-[65%] ${m.fromTeam ? 'items-end' : 'items-start'}`}>
                    <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.fromTeam ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-stone-200 bg-white'}`}>
                      {m.body}
                    </div>
                    <p className="px-1 text-xs text-stone-400">
                      {m.fromTeam ? `${m.staffName ?? `${siteConfig.name} team`} · ` : ''}
                      {clock(m.at)}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
          <form onSubmit={send} className="border-t border-stone-200 bg-white px-3 py-3 sm:px-5">
            {sendError && (
              <p role="alert" className="mb-2 text-sm text-red-600">
                {sendError}
              </p>
            )}
            <div className="flex items-end gap-2">
              <label htmlFor="support-reply" className="sr-only">
                Reply to {user?.name}
              </label>
              <textarea
                id="support-reply"
                rows={1}
                value={draft}
                maxLength={MESSAGE_LIMITS.max}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && send(e)}
                placeholder={`Reply to ${user?.name ?? 'user'} as the ${siteConfig.name} team`}
                className="field-sizing-content max-h-40 min-h-12 flex-1 resize-none rounded-3xl border border-stone-300 px-5 py-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
              />
              <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white hover:bg-stone-800 disabled:bg-stone-300">
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

/**
 * Admin → Messages → Chats: every user's chat with the Sellpify team, live. Reply, resolve / reopen, or start a
 * chat with any user. Filter, search and the open chat live in the URL (?status=&q=&t=).
 */
export default function SupportInbox({ initialList, prefillUser = null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useMemo(() => readView(searchParams), [searchParams]);
  const { refreshUnread } = useMessaging();
  const [list, setList] = useState(initialList);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(view.q);
  const dialogRef = useRef(null);
  const first = useRef(true);

  const go = useCallback(
    (patch) => {
      const next = { ...view, ...patch };
      const qs = new URLSearchParams();
      if (next.status) qs.set('status', next.status);
      if (next.q) qs.set('q', next.q);
      if (next.page > 1) qs.set('page', String(next.page));
      if (next.t) qs.set('t', next.t);
      window.history.pushState(null, '', qs.size ? `${pathname}?${qs}` : pathname);
    },
    [view, pathname],
  );

  const fetchList = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      const qs = new URLSearchParams({ page: String(view.page) });
      if (view.status) qs.set('status', view.status);
      if (view.q) qs.set('q', view.q);
      const { ok, data } = await inboxApi(`/api/admin/support?${qs}`);
      setLoading(false);
      if (ok) setList(data);
    },
    [view.status, view.q, view.page],
  );

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setQuery(view.q);
    fetchList();
  }, [fetchList, view.q]);

  // From a user's page (?user=…) with no chat yet: open "New message" addressed to them.
  useEffect(() => {
    if (prefillUser) dialogRef.current?.showModal();
  }, [prefillUser]);

  const refreshTimer = useRef(null);
  useMessagingEvents(['support:new', 'resync', 'poll'], () => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => fetchList({ quiet: true }), 250);
  });
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  // Opening a chat marks it read on the server: reflect it in the list and badge.
  useEffect(() => {
    if (!view.t) return;
    setList((l) => ({ ...l, items: l.items.map((c) => (c.id === view.t ? { ...c, unread: false } : c)) }));
    const timer = setTimeout(refreshUnread, 800);
    return () => clearTimeout(timer);
  }, [view.t, refreshUnread]);

  const onChanged = useCallback(() => {
    fetchList({ quiet: true });
    refreshUnread();
  }, [fetchList, refreshUnread]);

  const { items, pagination, counts } = list;

  return (
    <div className="flex min-h-[36rem] overflow-hidden rounded-2xl border border-stone-200 bg-white lg:h-[calc(100dvh-15rem)]">
      {/* Chat list */}
      <div className={`flex w-full min-w-0 flex-col border-stone-200 lg:w-[23rem] lg:shrink-0 lg:border-r ${view.t ? 'max-lg:hidden' : ''}`}>
        <div className="space-y-3 border-b border-stone-200 p-4">
          <div className="flex items-center gap-2">
            <form
              role="search"
              className="relative flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                go({ q: query.trim(), page: 1 });
              }}
            >
              <label htmlFor="support-search" className="sr-only">
                Search chats
              </label>
              <input
                id="support-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email or shop"
                className="h-10 w-full rounded-full border border-stone-300 pl-4 pr-10 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
              />
              <button type="submit" aria-label="Search" className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full hover:bg-stone-100">
                <Search size={16} aria-hidden="true" />
              </button>
            </form>
            <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn btn-sm btn-dark shrink-0" title="Message any user">
              <PenSquare size={15} aria-hidden="true" />
              New
            </button>
          </div>
          <nav aria-label="Filter chats" className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key || 'all'}
                type="button"
                onClick={() => go({ status: f.key, page: 1 })}
                aria-current={view.status === f.key ? 'page' : undefined}
                className={`btn btn-sm ${view.status === f.key ? 'btn-dark' : 'btn-outline'}`}
              >
                {f.label}
                {f.key === 'open' && counts.open > 0 && <span className="tabular-nums opacity-70">{counts.open}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid place-items-center py-16 text-stone-400">
              <Loader2 className="animate-spin" size={24} aria-label="Loading chats" />
            </div>
          ) : items.length ? (
            <ul>
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => go({ t: c.id })}
                    aria-current={view.t === c.id ? 'true' : undefined}
                    className={`flex w-full items-start gap-3 border-b border-stone-100 px-4 py-3.5 text-left transition-colors ${view.t === c.id ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
                  >
                    <Initial name={c.user?.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {c.unread && <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-brand-600" />}
                        <span className={`truncate text-sm ${c.unread ? 'font-bold' : 'font-medium'}`}>{c.user?.name ?? 'Deleted user'}</span>
                        <span className="shrink-0 text-[11px] text-stone-500">{ROLE[c.user?.role] ?? ''}</span>
                        <span className="ml-auto shrink-0 text-xs tabular-nums text-stone-500">{c.lastMessage ? inboxTime(c.lastMessage.at) : ''}</span>
                      </span>
                      <span className={`mt-0.5 block truncate text-sm ${c.unread ? 'text-stone-800' : 'text-stone-500'}`}>
                        {c.lastMessage?.fromTeam ? 'You: ' : ''}
                        {c.lastMessage?.body}
                      </span>
                      <span className="mt-1.5 block">
                        <StatusPill status={c.status} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyInbox title={view.q ? 'No chats match your search.' : 'No chats here yet.'}>
              <p className="mt-2 max-w-xs text-sm text-stone-500">When a user writes to the team, or you message them, the chat shows up here.</p>
            </EmptyInbox>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2 text-sm">
            <button type="button" disabled={pagination.page <= 1} onClick={() => go({ page: pagination.page - 1 })} className="btn btn-sm btn-outline">
              Newer
            </button>
            <span className="tabular-nums text-stone-500">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => go({ page: pagination.page + 1 })} className="btn btn-sm btn-outline">
              Older
            </button>
          </div>
        )}
      </div>

      {/* Open chat */}
      <section aria-label="Chat" className={`min-w-0 flex-1 ${view.t ? '' : 'max-lg:hidden'}`}>
        {view.t ? (
          <SupportThread key={view.t} threadId={view.t} onBack={() => go({ t: null })} onChanged={onChanged} />
        ) : (
          <div className="grid h-full place-items-center p-10 text-center">
            <div>
              <p className="font-semibold">Pick a chat to read and reply</p>
              <p className="mt-1 text-sm text-stone-500">or start a new one with any buyer or seller.</p>
              <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn btn-md btn-dark mt-5">
                <PenSquare size={16} aria-hidden="true" />
                New message
              </button>
            </div>
          </div>
        )}
      </section>

      <NewMessageDialog dialogRef={dialogRef} prefillUser={prefillUser} onSent={(id) => (go({ t: id, status: '', q: '' }), fetchList({ quiet: true }))} />
    </div>
  );
}
