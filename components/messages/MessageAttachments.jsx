'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

/*
 * Images in messages and support chats, shared by the inbox (ThreadView) and the admin support inbox (SupportInbox).
 * Files upload as soon as they're picked (PUT /api/messages/attachments, checked and kept private on the server), so
 * pressing Send only sends their locations. Up to MAX images per message, 5 MB each.
 */

export const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

/** Pending images for the composer: { items, add(files), remove(id), reset(), locations, uploading, error }. */
export function useImageAttachments() {
  const [items, setItems] = useState([]); // { id, name, preview, location?, status: 'uploading' | 'done' | 'error' }
  const [error, setError] = useState('');
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  const add = useCallback(async (fileList) => {
    setError('');
    const room = MAX_IMAGES - itemsRef.current.length;
    const files = [...fileList].slice(0, Math.max(0, room));
    if (fileList.length > room) setError(`You can attach up to ${MAX_IMAGES} images.`);
    for (const file of files) {
      if (!ACCEPT.split(',').includes(file.type)) {
        setError(`${file.name} isn’t a JPG, PNG, WebP or GIF image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} is over 5 MB.`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setItems((list) => [...list, { id, name: file.name, preview: URL.createObjectURL(file), status: 'uploading' }]);
      fetch(`/api/messages/attachments?name=${encodeURIComponent(file.name)}`, { method: 'PUT', body: file })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Upload failed.');
          setItems((list) => list.map((i) => (i.id === id ? { ...i, status: 'done', location: data.url } : i)));
        })
        .catch((err) => {
          setError(err.message || 'Upload failed.');
          setItems((list) => list.map((i) => (i.id === id ? { ...i, status: 'error' } : i)));
        });
    }
  }, []);

  const remove = useCallback((id) => {
    setItems((list) => {
      const gone = list.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((i) => i.id !== id);
    });
  }, []);

  const reset = useCallback(() => {
    itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
    setItems([]);
    setError('');
  }, []);

  return {
    items,
    add,
    remove,
    reset,
    error,
    uploading: items.some((i) => i.status === 'uploading'),
    locations: items.filter((i) => i.status === 'done').map((i) => i.location),
    previews: items.filter((i) => i.status === 'done').map((i) => i.preview),
  };
}

/** The paperclip-style button next to the message box. */
export function AttachButton({ onFiles, disabled, className = '' }) {
  const inputRef = useRef(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label="Attach images"
        title="Attach images (up to 4)"
        className={`grid size-12 shrink-0 place-items-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink disabled:opacity-40 ${className}`}
      >
        <ImagePlus size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </>
  );
}

/** Thumbnails of the images about to be sent, each removable. */
export function AttachmentTray({ attachments }) {
  if (!attachments.items.length && !attachments.error) return null;
  return (
    <div className="mb-2">
      {attachments.items.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {attachments.items.map((i) => (
            <li key={i.id} className="relative size-16 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL), not a served image */}
              <img src={i.preview} alt={i.name} className={`size-full object-cover ${i.status === 'done' ? '' : 'opacity-50'}`} />
              {i.status === 'uploading' && (
                <span aria-label="Uploading" className="absolute inset-0 m-auto size-5 animate-spin rounded-full border-2 border-white/60 border-t-ink" />
              )}
              {i.status === 'error' && <span className="absolute inset-x-0 bottom-0 bg-red-600 py-0.5 text-center text-[10px] font-medium text-white">Failed</span>}
              <button
                type="button"
                onClick={() => attachments.remove(i.id)}
                aria-label={`Remove ${i.name}`}
                className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-ink/80 text-white hover:bg-ink"
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {attachments.error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {attachments.error}
        </p>
      )}
    </div>
  );
}

/** Images inside a message bubble: one large, or a 2-column grid. Each opens full size in a new tab. */
export function MessageImages({ images, align = 'start' }) {
  if (!images?.length) return null;
  const single = images.length === 1;
  return (
    <div className={`grid gap-1.5 ${single ? 'w-64 max-w-full' : 'w-72 max-w-full grid-cols-2'} ${align === 'end' ? 'justify-self-end' : ''}`}>
      {images.map((src, i) => (
        <a
          key={src}
          href={src}
          target="_blank"
          rel="noopener"
          className={`block overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-black/5 ${single ? 'aspect-[4/3]' : 'aspect-square'}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private, per-chat images: never through the public image optimizer */}
          <img src={src} alt={`Image ${i + 1} of ${images.length}`} loading="lazy" className="size-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
        </a>
      ))}
    </div>
  );
}

/** The words of a message bubble, or the "deleted" placeholder; `edited` messages say so in their footer. */
export function MessageText({ message, className = '' }) {
  if (message.deleted) return <p className={`italic text-stone-400 ${className}`}>This message was deleted</p>;
  if (!message.body) return null;
  return <div className={`whitespace-pre-wrap break-words ${className}`}>{message.body}</div>;
}
