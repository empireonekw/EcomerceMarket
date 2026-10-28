'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MessageSquare, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { MESSAGE_LIMITS } from '@/lib/validation';
import { inboxApi } from '@/components/messages/inbox-api';

const STARTERS = ['Is this still available?', 'Can I use this for commercial projects?', 'Do you offer custom versions?', 'What file formats are included?'];

/**
 * "Message seller" on a product page: a dialog that starts (or continues) the buyer's conversation with the shop.
 * Guests are sent to log in first and come back here.
 */
export default function MessageSellerButton({ product, shop, className = 'btn btn-md btn-outline w-full' }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const dialogRef = useRef(null);
  const textId = useId();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // conversation id

  if (!loading && user?.id === shop.id) {
    return (
      <Link href="/seller/messages" className={className}>
        <MessageSquare size={16} aria-hidden="true" />
        Your shop’s messages
      </Link>
    );
  }

  function open() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/products/${product.slug}`)}`);
      return;
    }
    setError('');
    setSent(null);
    dialogRef.current?.showModal();
  }

  async function send(e) {
    e.preventDefault();
    if (!body.trim()) return setError('Write a message first.');
    setBusy(true);
    const { ok, data } = await inboxApi('/api/messages', { method: 'POST', body: { productId: product.id, body } });
    setBusy(false);
    if (!ok) return setError(data.fields?.body || data.error || 'Your message wasn’t sent. Please try again.');
    setSent(data.conversationId);
    setBody('');
  }

  const inboxHref = (id) => `${user?.role === 'seller' && user?.storeName ? '/seller/messages' : '/messages'}?c=${id}`;

  return (
    <>
      <button type="button" onClick={open} disabled={loading} className={className}>
        <MessageSquare size={16} aria-hidden="true" />
        Message seller
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${textId}-title`}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={`${textId}-title`} className="text-xl font-semibold">
                Message {shop.name}
              </h2>
              <p className="mt-1 text-sm text-stone-500">Ask about this listing. Replies arrive in your Messages.</p>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-black">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-xl border border-stone-200 p-2 pr-4">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
              {product.coverImage && <Image src={product.coverImage} alt="" fill sizes="48px" className="object-cover" />}
            </span>
            <span className="line-clamp-2 text-sm font-medium">{product.title}</span>
          </div>

          {sent ? (
            <div className="mt-6 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-600" aria-hidden="true" />
              <p className="mt-3 font-semibold">Message sent!</p>
              <p className="mt-1 text-sm text-stone-500">{shop.name} will reply in your Messages — you’ll see it there as soon as it arrives.</p>
              <div className="mt-5 flex justify-center gap-2">
                <button type="button" onClick={() => dialogRef.current?.close()} className="btn btn-md btn-outline">
                  Keep browsing
                </button>
                <Link href={inboxHref(sent)} className="btn btn-md btn-dark">
                  View conversation
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={send} className="mt-5">
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => setBody((b) => (b.trim() ? `${b.trim()} ${s}` : s))} className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:border-black hover:text-black">
                    {s}
                  </button>
                ))}
              </div>
              <label htmlFor={textId} className="sr-only">
                Your message
              </label>
              <textarea
                id={textId}
                rows={5}
                value={body}
                maxLength={MESSAGE_LIMITS.max}
                onChange={(e) => {
                  setBody(e.target.value);
                  setError('');
                }}
                placeholder={`Hi ${shop.name}, I have a question about this item…`}
                className="mt-3 w-full resize-none rounded-xl border border-stone-300 p-4 text-[15px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
              />
              {error && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {error}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs tabular-nums text-stone-400">
                  {body.length}/{MESSAGE_LIMITS.max}
                </span>
                <button type="submit" disabled={busy || !body.trim()} className="btn btn-md btn-dark">
                  {busy ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
