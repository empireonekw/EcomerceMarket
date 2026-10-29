'use client';

import { useId, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { MESSAGE_LIMITS } from '@/lib/validation';
import { useDropdown } from '@/components/messages/LabelMenu';
import { inboxApi } from '@/components/messages/inbox-api';

/**
 * "Reply preferences ▾": the shop's automatic away reply (sellers) and the user's labels.
 * `onChange(settings)` receives the saved settings.
 */
export default function ReplyPreferences({ settings, onChange }) {
  const { open, setOpen, rootRef } = useDropdown();
  const [enabled, setEnabled] = useState(settings.autoReply.enabled);
  const [message, setMessage] = useState(settings.autoReply.message);
  const [status, setStatus] = useState(null); // { type: 'ok' | 'error', text }
  const [busy, setBusy] = useState(false);
  const id = useId();

  function toggle() {
    if (!open) {
      setEnabled(settings.autoReply.enabled);
      setMessage(settings.autoReply.message);
      setStatus(null);
    }
    setOpen(!open);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const { ok, data } = await inboxApi('/api/messages/settings', { method: 'PUT', body: { autoReply: { enabled, message } } });
    setBusy(false);
    if (!ok) return setStatus({ type: 'error', text: data.fields?.message || data.error || 'Couldn’t save.' });
    onChange(data);
    setStatus({ type: 'ok', text: enabled ? 'Away reply is on.' : 'Saved.' });
  }

  async function removeLabel(label) {
    const { ok, data } = await inboxApi(`/api/messages/settings?label=${encodeURIComponent(label)}`, { method: 'DELETE' });
    if (ok) onChange(data);
    else setStatus({ type: 'error', text: data.error || 'Couldn’t remove the label.' });
  }

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-semibold hover:bg-stone-200/60">
        Reply preferences
        <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>

      {open && (
        <div role="dialog" aria-label="Reply preferences" className="absolute right-0 top-full z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white p-5 shadow-lift">
          {settings.isSeller && (
            <form onSubmit={save}>
              <p className="text-[15px] font-semibold">Away message</p>
              <p className="mt-1 text-sm text-stone-500">Sent automatically when a buyer writes to your shop (at most once a day per conversation).</p>
              <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
                Send an automatic reply
                <input type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="peer sr-only" />
                <span
                  aria-hidden="true"
                  className="relative h-6 w-11 shrink-0 rounded-full bg-stone-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-black peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-brand-700"
                />
              </label>
              <label htmlFor={id} className="sr-only">
                Away message
              </label>
              <textarea
                id={id}
                rows={4}
                value={message}
                maxLength={MESSAGE_LIMITS.autoReply}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Thanks for your message! I’m away until Monday and will reply as soon as I’m back."
                className="mt-3 w-full resize-none rounded-lg border border-stone-300 p-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/40"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs tabular-nums text-stone-400">
                  {message.length}/{MESSAGE_LIMITS.autoReply}
                </span>
                <button type="submit" disabled={busy} className="btn btn-sm btn-dark">
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}

          <div className={settings.isSeller ? 'mt-5 border-t border-stone-200 pt-4' : ''}>
            <p className="text-[15px] font-semibold">Your labels</p>
            {settings.labels.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {settings.labels.map((l) => (
                  <li key={l} className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm">
                    {l}
                    <button type="button" onClick={() => removeLabel(l)} aria-label={`Delete label ${l}`} className="grid size-6 place-items-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-black">
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-stone-500">Create labels from the Label menu to sort your conversations.</p>
            )}
          </div>

          {status && (
            <p role="status" className={`mt-3 text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
              {status.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
