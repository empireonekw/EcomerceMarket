'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Archive, ArrowLeft, Flag, Inbox as InboxIcon, Loader2, Mail, Send, Star, Trash2 } from 'lucide-react';
import { MESSAGE_LIMITS } from '@/lib/validation';
import { siteConfig } from '@/lib/site';
import { inboxApi } from '@/components/messages/inbox-api';
import { useMessaging, useMessagingEvents } from '@/components/messages/MessagingProvider';

const dayLabel = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
const clock = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function Initial({ name, className = 'size-10 text-sm' }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-stone-200 font-semibold uppercase text-stone-700 ${className}`}>
      {name?.charAt(0) ?? '?'}
    </span>
  );
}

function ProductChip({ product, className = '' }) {
  return (
    <Link href={`/products/${product.slug}`} target="_blank" className={`flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2 pr-4 text-sm hover:border-stone-400 ${className}`}>
      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
        {product.coverImage && <Image src={product.coverImage} alt="" fill sizes="48px" className="object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-stone-500">About this listing</span>
        <span className="line-clamp-2 font-medium">{product.title}</span>
      </span>
    </Link>
  );
}

function Bubble({ message, otherName }) {
  if (message.system) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white px-5 py-4 text-[15px] leading-relaxed">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{siteConfig.name}</p>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className="mt-2 text-xs text-stone-400">{clock(message.at)}</p>
      </div>
    );
  }
  const mine = message.fromMe;
  return (
    <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && <Initial name={message.senderName || otherName} className="size-8 text-xs" />}
      <div className={`flex max-w-[85%] flex-col gap-1.5 sm:max-w-[70%] ${mine ? 'items-end' : 'items-start'}`}>
        {message.product && <ProductChip product={message.product} />}
        <div className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${mine ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-stone-200 bg-white text-ink'}`}>
          {message.body}
        </div>
        <p className="px-1 text-xs text-stone-400">
          {message.auto && <span className="mr-1">Automatic reply ·</span>}
          {clock(message.at)}
          {message.pending && <span className="ml-1">· Sending…</span>}
          {message.failed && <span className="ml-1 text-red-600">· Not sent</span>}
        </p>
      </div>
    </div>
  );
}

/**
 * An open conversation: messages (live), composer with typing indicator, and per-thread actions.
 * `onAction(action, ids)` runs a toolbar action; `onBack()` returns to the folder.
 */
export default function ThreadView({ conversationId, backLabel, onBack, onAction, onSeen }) {
  const { sendTyping } = useMessaging();
  const [state, setState] = useState({ loading: true, error: '', conversation: null, messages: [], hasMore: false });
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const typingTimer = useRef(null);
  const typingSent = useRef(false);
  const textareaRef = useRef(null);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setState((s) => ({ ...s, loading: true, error: '' }));
      const { ok, data, aborted } = await inboxApi(`/api/messages/${conversationId}`);
      if (aborted) return;
      if (!ok) return setState((s) => ({ ...s, loading: false, error: data.error || 'Couldn’t open this conversation.' }));
      setState((s) => {
        // Keep optimistic messages that the server hasn't confirmed yet.
        const pending = s.messages.filter((m) => m.pending || m.failed);
        return { loading: false, error: '', conversation: data.conversation, messages: [...data.messages, ...pending], hasMore: data.hasMore };
      });
      onSeen?.(conversationId);
    },
    [conversationId, onSeen],
  );

  useEffect(() => {
    stickToBottom.current = true;
    setState({ loading: true, error: '', conversation: null, messages: [], hasMore: false });
    setDraft('');
    setPeerTyping(false);
    load();
  }, [conversationId, load]);

  // Follow new messages while the reader is at the bottom.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [state.messages, peerTyping]);

  function onScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useMessagingEvents(['message:new', 'typing', 'resync', 'poll'], (event, payload) => {
    if (event === 'resync' || event === 'poll') return load({ quiet: true });
    if (payload?.conversation?.id !== conversationId && payload?.conversationId !== conversationId) return;
    if (event === 'typing') {
      setPeerTyping(payload.typing);
      clearTimeout(typingTimer.current);
      if (payload.typing) typingTimer.current = setTimeout(() => setPeerTyping(false), 6000);
      return;
    }
    // message:new
    const { message, conversation } = payload;
    if (!message.fromMe) setPeerTyping(false);
    setState((s) => {
      if (s.messages.some((m) => m.id === message.id)) return { ...s, conversation };
      return { ...s, conversation, messages: [...s.messages, message] };
    });
    if (!message.fromMe && document.visibilityState === 'visible') onAction('read', [conversationId], { silent: true });
  });

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  function onDraftChange(e) {
    setDraft(e.target.value);
    setSendError('');
    const typing = e.target.value.trim().length > 0;
    if (typing !== typingSent.current || typing) sendTyping(conversationId, typing);
    typingSent.current = typing;
  }

  async function send(e) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const tempId = `tmp-${Date.now()}`;
    stickToBottom.current = true;
    setState((s) => ({ ...s, messages: [...s.messages, { id: tempId, body, at: new Date().toISOString(), fromMe: true, pending: true }] }));
    setDraft('');
    sendTyping(conversationId, false);
    typingSent.current = false;

    const { ok, data } = await inboxApi(`/api/messages/${conversationId}`, { method: 'POST', body: { body } });
    setState((s) => {
      if (!ok) return { ...s, messages: s.messages.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)) };
      const already = s.messages.some((m) => m.id === data.message.id); // the socket may have delivered it first
      return {
        ...s,
        conversation: data.conversation,
        messages: already ? s.messages.filter((m) => m.id !== tempId) : s.messages.map((m) => (m.id === tempId ? data.message : m)),
      };
    });
    if (!ok) {
      setSendError(data.error || 'Your message wasn’t sent. Please try again.');
      setDraft(body);
    }
    textareaRef.current?.focus();
  }

  async function loadEarlier() {
    const first = state.messages.find((m) => !m.pending && !m.failed);
    if (!first) return;
    const el = scrollRef.current;
    const fromBottom = el.scrollHeight - el.scrollTop;
    setLoadingEarlier(true);
    stickToBottom.current = false;
    const { ok, data } = await inboxApi(`/api/messages/${conversationId}?before=${first.id}`);
    setLoadingEarlier(false);
    if (!ok) return;
    setState((s) => ({ ...s, messages: [...data.messages, ...s.messages], hasMore: data.hasMore }));
    requestAnimationFrame(() => (el.scrollTop = el.scrollHeight - fromBottom));
  }

  async function act(action) {
    const result = await onAction(action, [conversationId]);
    if (result?.ok === false) return;
    if (['archive', 'trash', 'report', 'unread', 'delete'].includes(action)) onBack();
    else load({ quiet: true });
  }

  const conv = state.conversation;
  const name = conv?.kind === 'system' ? siteConfig.name : conv?.other?.name ?? '';
  const canReply = conv?.kind === 'direct' && !conv?.spam;

  const iconBtn = 'grid size-10 place-items-center rounded-full text-stone-700 hover:bg-stone-200/60 hover:text-black';
  let lastDay = null;

  return (
    // Below lg the inbox isn't height-capped, so the thread gets its own: messages scroll inside it, composer stays in view.
    <div className="flex h-full min-h-0 flex-col max-lg:h-[calc(100dvh-4rem)] max-lg:min-h-[28rem]">
      {/* Header */}
      <div className="flex min-h-16 flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2 sm:px-5">
        <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-full px-3 py-2 text-[15px] font-semibold hover:bg-stone-200/60">
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
        {conv && (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Initial name={name} className="size-9 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{name}</p>
                <p className="truncate text-xs text-stone-500">
                  {conv.kind === 'system'
                    ? 'Marketplace notices'
                    : conv.side === 'seller'
                      ? conv.buyerIsCustomer
                        ? 'Customer · has bought from your shop'
                        : 'Potential buyer'
                      : 'Shop'}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <button type="button" onClick={() => act(conv.starred ? 'unstar' : 'star')} aria-pressed={conv.starred} aria-label={conv.starred ? 'Unstar' : 'Star'} title={conv.starred ? 'Unstar' : 'Star'} className={iconBtn}>
                <Star size={18} aria-hidden="true" className={conv.starred ? 'fill-amber-400 text-amber-500' : ''} />
              </button>
              {conv.archived || conv.trashed || conv.spam ? (
                <button type="button" onClick={() => act('inbox')} aria-label="Move to Inbox" title="Move to Inbox" className={iconBtn}>
                  <InboxIcon size={18} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" onClick={() => act('archive')} aria-label="Archive" title="Archive" className={iconBtn}>
                  <Archive size={18} aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={() => act('unread')} aria-label="Mark unread" title="Mark unread" className={iconBtn}>
                <Mail size={18} aria-hidden="true" />
              </button>
              {!conv.trashed && (
                <button type="button" onClick={() => act('trash')} aria-label="Move to Recycling bin" title="Recycling bin" className={iconBtn}>
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
              {conv.kind === 'direct' && !conv.spam && (
                <button type="button" onClick={() => act('report')} aria-label="Report" title="Report" className={iconBtn}>
                  <Flag size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {state.loading ? (
        <div className="grid flex-1 place-items-center py-24 text-stone-400">
          <Loader2 className="animate-spin" size={28} aria-label="Loading conversation" />
        </div>
      ) : state.error ? (
        <div className="grid flex-1 place-items-center px-6 py-24 text-center">
          <div>
            <p className="font-semibold">{state.error}</p>
            <button type="button" onClick={onBack} className="btn btn-sm btn-outline mt-4">
              Back to {backLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Messages */}
            <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-8" aria-live="polite">
              {state.hasMore && (
                <div className="text-center">
                  <button type="button" onClick={loadEarlier} disabled={loadingEarlier} className="btn btn-sm btn-outline">
                    {loadingEarlier ? 'Loading…' : 'Load earlier messages'}
                  </button>
                </div>
              )}
              {state.messages.map((m) => {
                const day = dayLabel(m.at);
                const showDay = day !== lastDay;
                lastDay = day;
                return (
                  <div key={m.id}>
                    {showDay && (
                      <p className="my-4 flex items-center gap-3 text-xs font-medium text-stone-500 before:h-px before:flex-1 before:bg-stone-200 after:h-px after:flex-1 after:bg-stone-200">{day}</p>
                    )}
                    <Bubble message={m} otherName={name} />
                  </div>
                );
              })}
              {peerTyping && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <Initial name={name} className="size-8 text-xs" />
                  <span className="flex gap-1 rounded-2xl border border-stone-200 bg-white px-4 py-3" aria-label={`${name} is typing`}>
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Composer */}
            {canReply ? (
              <form onSubmit={send} className="border-t border-stone-200 bg-white px-3 py-3 sm:px-6">
                {sendError && (
                  <p role="alert" className="mb-2 text-sm text-red-600">
                    {sendError}
                  </p>
                )}
                <div className="flex items-end gap-2">
                  <label htmlFor="inbox-reply" className="sr-only">
                    Reply to {name}
                  </label>
                  <textarea
                    id="inbox-reply"
                    ref={textareaRef}
                    rows={1}
                    value={draft}
                    maxLength={MESSAGE_LIMITS.max}
                    onChange={onDraftChange}
                    onBlur={() => typingSent.current && (sendTyping(conversationId, false), (typingSent.current = false))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
                    }}
                    placeholder={`Message ${name}`}
                    className="field-sizing-content max-h-40 min-h-12 flex-1 resize-none rounded-3xl border border-stone-300 px-5 py-3 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
                  />
                  <button type="submit" disabled={!draft.trim()} aria-label="Send" className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-stone-800 disabled:bg-stone-300">
                    <Send size={18} aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-1.5 hidden px-2 text-xs text-stone-400 sm:block">Enter to send · Shift + Enter for a new line</p>
              </form>
            ) : (
              conv && (
                <p className="border-t border-stone-200 bg-white px-6 py-4 text-center text-sm text-stone-500">
                  {conv.kind === 'system' ? 'Notices from the marketplace can’t be replied to.' : 'This conversation is in Spam. Move it to your Inbox to reply.'}
                </p>
              )
            )}
          </div>

          {/* Details */}
          {conv?.kind === 'direct' && (
            <aside className="hidden w-72 shrink-0 space-y-5 overflow-y-auto border-l border-stone-200 p-5 xl:block">
              <div className="flex items-center gap-3">
                <Initial name={name} className="size-12 text-base" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{name}</p>
                  <p className="text-sm text-stone-500">{conv.side === 'seller' ? (conv.buyerIsCustomer ? 'Customer' : 'Potential buyer') : 'Seller'}</p>
                </div>
              </div>
              {conv.product && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Listing</p>
                  <ProductChip product={conv.product} />
                </div>
              )}
              {conv.labels.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Labels</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {conv.labels.map((l) => (
                      <li key={l} className="rounded-full bg-stone-200/70 px-2.5 py-0.5 text-xs font-medium">
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs leading-relaxed text-stone-500">Keep conversations on {siteConfig.name}. Never share passwords or payment details in messages.</p>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
