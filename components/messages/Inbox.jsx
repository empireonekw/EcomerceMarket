'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search, Star, Tag } from 'lucide-react';
import { FOLDERS, actionsFor, inboxTime } from '@/lib/messaging';
import { siteConfig } from '@/lib/site';
import EmptyInbox from '@/components/messages/EmptyInbox';
import LabelMenu from '@/components/messages/LabelMenu';
import ReplyPreferences from '@/components/messages/ReplyPreferences';
import ThreadView, { Initial } from '@/components/messages/ThreadView';
import { inboxApi } from '@/components/messages/inbox-api';
import { useMessaging, useMessagingEvents } from '@/components/messages/MessagingProvider';

/** The inbox view as encoded in the URL: ?folder=…|label=… &q=… &page=… &c=<open conversation>. */
function readView(sp) {
  return {
    folder: sp.get('label') ? null : FOLDERS.some((f) => f.key === sp.get('folder')) ? sp.get('folder') : 'inbox',
    label: sp.get('label') || null,
    q: sp.get('q') || '',
    page: Math.max(1, Number.parseInt(sp.get('page'), 10) || 1),
    c: sp.get('c') || null,
  };
}

function toQuery(view) {
  const qs = new URLSearchParams();
  if (view.label) qs.set('label', view.label);
  else if (view.folder && view.folder !== 'inbox') qs.set('folder', view.folder);
  if (view.q) qs.set('q', view.q);
  if (view.page > 1) qs.set('page', String(view.page));
  if (view.c) qs.set('c', view.c);
  return qs.toString();
}

const listKey = (v) => JSON.stringify([v.folder, v.label, v.q, v.page]);

function ConversationRow({ conv, checked, onCheck, onOpen, onStar }) {
  const name = conv.kind === 'system' ? siteConfig.name : conv.other?.name ?? 'Deleted account';
  const snippet = conv.lastMessage ? `${conv.lastMessage.fromMe ? 'You: ' : ''}${conv.lastMessage.body}` : '';
  return (
    <li className={`group flex items-center gap-1 border-b border-stone-200 pl-3 pr-4 transition-colors sm:pl-5 ${checked ? 'bg-brand-50/70' : conv.unread ? 'bg-white' : ''} hover:bg-stone-100/80`}>
      <label className="grid size-10 shrink-0 cursor-pointer place-items-center">
        <span className="sr-only">Select conversation with {name}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} className="size-5 rounded border-stone-400 accent-black" />
      </label>
      <button type="button" onClick={onStar} aria-pressed={conv.starred} aria-label={conv.starred ? `Unstar ${name}` : `Star ${name}`} className="grid size-9 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-stone-200/70 hover:text-stone-700">
        <Star size={18} aria-hidden="true" className={conv.starred ? 'fill-amber-400 text-amber-500' : ''} />
      </button>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-1 text-left">
        <Initial name={name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            {conv.unread && <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-brand-600" />}
            <span className={`truncate text-[15px] ${conv.unread ? 'font-bold text-ink' : 'font-medium text-stone-800'}`}>{name}</span>
            {conv.side === 'seller' && conv.kind === 'direct' && (
              <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline ${conv.buyerIsCustomer ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200/70 text-stone-600'}`}>
                {conv.buyerIsCustomer ? 'Customer' : 'Potential buyer'}
              </span>
            )}
            {conv.labels.map((l) => (
              <span key={l} className="hidden shrink-0 items-center gap-1 rounded-full border border-stone-300 px-2 py-0.5 text-[11px] font-medium text-stone-600 md:inline-flex">
                <Tag size={10} aria-hidden="true" />
                {l}
              </span>
            ))}
          </span>
          <span className={`mt-0.5 block truncate text-sm ${conv.unread ? 'font-medium text-stone-800' : 'text-stone-500'}`}>
            {conv.product && <span className="text-stone-500">{conv.product.title} — </span>}
            {snippet}
          </span>
        </span>
        {conv.product?.coverImage && (
          <span className="relative hidden size-11 shrink-0 overflow-hidden rounded-lg bg-stone-100 sm:block">
            <Image src={conv.product.coverImage} alt="" fill sizes="44px" className="object-cover" />
          </span>
        )}
        <span className={`w-16 shrink-0 text-right text-xs tabular-nums ${conv.unread ? 'font-semibold text-ink' : 'text-stone-500'}`}>{conv.lastMessage ? inboxTime(conv.lastMessage.at) : ''}</span>
      </button>
    </li>
  );
}

function RowsSkeleton() {
  return (
    <ul aria-label="Loading conversations" className="animate-pulse">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex items-center gap-4 border-b border-stone-200 px-5 py-4">
          <span className="size-5 rounded bg-stone-200" />
          <span className="size-10 rounded-full bg-stone-200" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-40 rounded-full bg-stone-200" />
            <span className="block h-3 w-3/4 rounded-full bg-stone-200/80" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Etsy-style messages inbox, used by the seller dashboard (/seller/messages) and the storefront (/messages).
 * Folder, label, search, page and the open conversation live in the URL (history API, no server round trip).
 */
export default function Inbox({ initialList, initialSettings, fullBleed = false }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = useMemo(() => readView(searchParams), [searchParams]);
  const { refreshUnread } = useMessaging();
  const searchId = useId();

  const [list, setList] = useState(initialList);
  const [loadedKey, setLoadedKey] = useState(() => listKey(readView(searchParams)));
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [selected, setSelected] = useState(() => new Set());
  const [notice, setNotice] = useState(null); // { type, text }
  const [query, setQuery] = useState(view.q);
  const abortRef = useRef(null);
  const noticeTimer = useRef(null);

  const folders = FOLDERS.filter((f) => !f.sellerOnly || settings.isSeller);
  const currentLabel = view.label ? view.label : folders.find((f) => f.key === view.folder)?.label ?? 'Inbox';

  const go = useCallback(
    (patch, { replace = false } = {}) => {
      const next = { ...view, ...patch };
      const qs = toQuery(next);
      window.history[replace ? 'replaceState' : 'pushState'](null, '', qs ? `${pathname}?${qs}` : pathname);
    },
    [view, pathname],
  );

  const flash = useCallback((type, text) => {
    clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const fetchList = useCallback(
    async ({ quiet = false } = {}) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!quiet) setLoading(true);
      const qs = new URLSearchParams();
      if (view.label) qs.set('label', view.label);
      else qs.set('folder', view.folder);
      if (view.q) qs.set('q', view.q);
      qs.set('page', String(view.page));
      const { ok, data, aborted } = await inboxApi(`/api/messages?${qs}`, { signal: controller.signal });
      if (aborted) return;
      setLoading(false);
      if (!ok) return flash('error', data.error || 'Couldn’t load your messages.');
      setList(data);
      setLoadedKey(listKey(view));
      setSelected((s) => new Set([...s].filter((id) => data.items.some((c) => c.id === id))));
    },
    [view, flash],
  );

  // Folder / label / search / page changed → load that list.
  useEffect(() => {
    if (listKey(view) !== loadedKey) {
      setSelected(new Set());
      fetchList();
    }
    setQuery(view.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.folder, view.label, view.q, view.page]);

  const refreshTimer = useRef(null);
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => fetchList({ quiet: true }), 250);
  }, [fetchList]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  const reloadSettings = useCallback(async () => {
    const { ok, data } = await inboxApi('/api/messages/settings');
    if (ok) setSettings(data);
  }, []);

  useMessagingEvents(['message:new', 'inbox:changed', 'resync', 'poll'], (event) => {
    if (event === 'inbox:changed' || event === 'resync') reloadSettings();
    if (!view.c || event !== 'poll') scheduleRefresh();
  });

  /** Runs a toolbar action on conversation ids. */
  const runAction = useCallback(
    async (action, ids, { add, remove, silent = false } = {}) => {
      if (!ids.length) {
        flash('error', 'Select at least one conversation first.');
        return { ok: false };
      }
      const { ok, data } = await inboxApi('/api/messages', { method: 'PATCH', body: { ids, action, add, remove } });
      if (!ok) {
        if (!silent) flash('error', data.error || 'Something went wrong.');
        return { ok: false, error: data.error };
      }
      if (!silent) {
        const n = ids.length === 1 ? 'Conversation' : `${ids.length} conversations`;
        const done = {
          trash: `${n} moved to the Recycling bin.`,
          delete: `${n} deleted.`,
          archive: `${n} archived.`,
          inbox: `${n} moved to your Inbox.`,
          report: `${n} reported and moved to Spam. Thanks — our team will take a look.`,
          notspam: `${n} marked as not spam.`,
          read: `${n} marked as read.`,
          unread: `${n} marked as unread.`,
          labels: 'Labels updated.',
        }[action];
        if (done) flash('ok', done);
      }
      setSelected(new Set());
      if (action === 'labels') reloadSettings();
      refreshUnread();
      fetchList({ quiet: true });
      return { ok: true };
    },
    [flash, fetchList, refreshUnread, reloadSettings],
  );

  async function applyLabels({ add, remove }) {
    const ids = [...selected];
    if (!ids.length) {
      // No selection: just create the label(s).
      for (const label of add) {
        const { ok, data } = await inboxApi('/api/messages/settings', { method: 'POST', body: { label } });
        if (!ok) return { error: data.error };
        setSettings((s) => ({ ...s, labels: data.labels }));
      }
      if (add.length) flash('ok', `Label “${add.at(-1)}” created.`);
      return {};
    }
    const result = await runAction('labels', ids, { add, remove });
    return result.ok ? {} : { error: result.error };
  }

  const items = list?.items ?? [];
  const allChecked = items.length > 0 && items.every((c) => selected.has(c.id));
  const someChecked = items.some((c) => selected.has(c.id));
  const selectedConvs = items.filter((c) => selected.has(c.id));
  const { page, totalPages, total, limit } = list?.pagination ?? { page: 1, totalPages: 1, total: 0, limit: 20 };
  const showSkeleton = loading || listKey(view) !== loadedKey;

  function onSearch(e) {
    e.preventDefault();
    go({ q: query.trim(), page: 1, c: null });
  }

  const onSeen = useCallback(
    (id) => {
      setList((l) => (l ? { ...l, items: l.items.map((c) => (c.id === id ? { ...c, unread: false } : c)) } : l));
      refreshUnread();
    },
    [refreshUnread],
  );

  const navItem = (active) =>
    `flex w-full items-center justify-between gap-2 rounded-xl px-5 py-3 text-left text-base transition-colors ${active ? 'bg-stone-200/70 font-semibold text-ink' : 'text-stone-700 hover:bg-stone-200/40 hover:text-ink'}`;

  return (
    <div className={`flex flex-col bg-[#faf9f7] ${fullBleed ? '-mx-4 -my-6 min-h-dvh sm:-mx-6 lg:-mx-10 lg:-my-10 lg:h-dvh' : 'min-h-[42rem] overflow-hidden rounded-2xl border border-stone-200 lg:h-[calc(100dvh-10rem)]'}`}>
      {/* Header */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-stone-200 px-4 py-4 sm:px-8">
        <h1 className="mr-auto text-2xl font-semibold tracking-tight sm:text-[1.75rem]">Messages</h1>
        <form onSubmit={onSearch} role="search" className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-xl">
          <label htmlFor={searchId} className="sr-only">
            Search your messages
          </label>
          <div className="relative">
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your messages"
              className="h-12 w-full rounded-full border border-stone-400 bg-transparent pl-6 pr-14 text-base outline-none placeholder:text-stone-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
            />
            <button type="submit" aria-label="Search" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink hover:bg-stone-200/70">
              <Search size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </form>
        <ReplyPreferences settings={settings} onChange={setSettings} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Folders */}
        <nav aria-label="Message folders" className="shrink-0 border-stone-200 md:w-64 md:overflow-y-auto md:border-r md:px-4 md:py-5 lg:w-72">
          <ul className="flex gap-1 overflow-x-auto px-3 py-2 md:block md:space-y-1 md:overflow-visible md:p-0">
            {folders.map((f) => {
              const active = !view.label && view.folder === f.key;
              return (
                <li key={f.key} className="shrink-0">
                  <button type="button" aria-current={active ? 'page' : undefined} onClick={() => go({ folder: f.key, label: null, page: 1, c: null })} className={`${navItem(active)} max-md:rounded-full max-md:px-4 max-md:py-2 max-md:text-sm`}>
                    <span className="truncate">{f.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {settings.labels.length > 0 && (
            <div className="border-t border-stone-200 px-3 py-2 md:mt-4 md:px-0 md:pt-4">
              <p className="hidden px-5 pb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 md:block">Labels</p>
              <ul className="flex gap-1 overflow-x-auto md:block md:space-y-1">
                {settings.labels.map((l) => {
                  const active = view.label === l;
                  return (
                    <li key={l} className="shrink-0">
                      <button type="button" aria-current={active ? 'page' : undefined} onClick={() => go({ label: l, folder: null, page: 1, c: null })} className={`${navItem(active)} justify-start max-md:rounded-full max-md:px-4 max-md:py-2 max-md:text-sm`}>
                        <Tag size={15} aria-hidden="true" className="shrink-0" />
                        <span className="truncate">{l}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>

        {/* List or open conversation */}
        <section aria-label={currentLabel} className="relative flex min-h-[30rem] min-w-0 flex-1 flex-col border-t border-stone-200 md:border-t-0">
          {view.c ? (
            <ThreadView conversationId={view.c} backLabel={currentLabel} onBack={() => go({ c: null })} onAction={runAction} onSeen={onSeen} />
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex min-h-16 items-center gap-1 border-b border-stone-200 px-3 sm:px-5">
                <label className="grid size-10 shrink-0 cursor-pointer place-items-center">
                  <span className="sr-only">Select all conversations on this page</span>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => el && (el.indeterminate = someChecked && !allChecked)}
                    onChange={(e) => setSelected(e.target.checked ? new Set(items.map((c) => c.id)) : new Set())}
                    className="size-5 rounded border-stone-400 accent-black"
                  />
                </label>
                {/* Actions scroll sideways on narrow screens; the Label menu sits outside so its panel isn't clipped. */}
                <div className="ml-2 flex min-w-0 items-center gap-1 overflow-x-auto sm:ml-6 sm:gap-3">
                  {actionsFor(view.label ? 'inbox' : view.folder).map(({ action, label }) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => runAction(action, [...selected])}
                      className="whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-semibold text-ink transition-colors hover:bg-stone-200/60"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="shrink-0 sm:ml-2">
                  <LabelMenu labels={settings.labels} selected={selectedConvs} onApply={applyLabels} />
                </div>
              </div>

              {/* Rows */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {showSkeleton ? (
                  <RowsSkeleton />
                ) : items.length ? (
                  <ul>
                    {items.map((conv) => (
                      <ConversationRow
                        key={conv.id}
                        conv={conv}
                        checked={selected.has(conv.id)}
                        onCheck={(on) =>
                          setSelected((s) => {
                            const next = new Set(s);
                            if (on) next.add(conv.id);
                            else next.delete(conv.id);
                            return next;
                          })
                        }
                        onOpen={() => go({ c: conv.id })}
                        onStar={() => runAction(conv.starred ? 'unstar' : 'star', [conv.id], { silent: true })}
                      />
                    ))}
                  </ul>
                ) : (
                  <EmptyInbox title={view.q ? 'No conversations match your search.' : 'No conversations to see here!'}>
                    {view.q && (
                      <button type="button" onClick={() => go({ q: '', page: 1 })} className="btn btn-sm btn-outline mt-4">
                        Clear search
                      </button>
                    )}
                  </EmptyInbox>
                )}
              </div>

              {/* Pagination */}
              {!showSkeleton && total > limit && (
                <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-5 py-3 text-sm text-stone-600">
                  <span className="tabular-nums">
                    {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
                  </span>
                  <button type="button" disabled={page <= 1} onClick={() => go({ page: page - 1 })} aria-label="Previous page" className="grid size-9 place-items-center rounded-full hover:bg-stone-200/60 disabled:opacity-40">
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                  <button type="button" disabled={page >= totalPages} onClick={() => go({ page: page + 1 })} aria-label="Next page" className="grid size-9 place-items-center rounded-full hover:bg-stone-200/60 disabled:opacity-40">
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
            </>
          )}

          {notice && (
            <div role="status" className={`pointer-events-none absolute inset-x-0 bottom-5 z-20 mx-auto w-fit max-w-[90%] rounded-full px-5 py-2.5 text-sm font-medium shadow-lift ${notice.type === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-white'}`}>
              {notice.text}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
