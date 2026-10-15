'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Lightweight toast system. Lives in the admin layout, which persists across admin navigations,
 * so a toast fired right before router.push() is still visible on the next page.
 */
const ToastContext = createContext(null);
const DURATION_MS = 4500;

const STYLES = {
  success: { ring: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', d: 'm5 12 4.5 4.5L19 7' },
  error: { ring: 'border-red-200', icon: 'bg-red-100 text-red-600', d: 'M12 8v5m0 3.5v.01M12 3 2 20h20L12 3Z' },
  info: { ring: 'border-stone-200', icon: 'bg-stone-100 text-stone-600', d: 'M12 11v6m0-9.5v.01' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message, description) => {
      const id = ++nextId.current;
      setToasts((t) => [...t.slice(-3), { id, type, message, description }]); // keep at most 4
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (m, d) => push('success', m, d),
      error: (m, d) => push('error', m, d),
      info: (m, d) => push('info', m, d),
    }),
    [push],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      >
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-white p-3.5 shadow-lg transition-all duration-300 starting:translate-y-2 starting:opacity-0 sm:w-96 ${s.ring}`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-full ${s.icon}`}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.d} />
                </svg>
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-sm font-medium">{t.message}</p>
                {t.description && <p className="mt-0.5 text-sm text-stone-500">{t.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-ink"
                aria-label="Dismiss notification"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>.');
  return ctx;
}
