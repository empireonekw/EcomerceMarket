'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Live inbox state for a signed-in user: { unread, live, subscribe(event, fn), sendTyping(id, typing), refreshUnread() }.
 *
 * Connects to the Socket.IO server in server.js with a one-time ticket from POST /api/messages/ticket. When the app
 * runs without it (plain `next dev`, Vercel) or the socket drops, it polls instead, and subscribers get a
 * synthetic `poll` event so open views can refetch.
 *
 * Events: message:new { conversation, message } · inbox:changed · inbox:unread { count } · typing { conversationId, typing }
 * · support:new { threadId } (admins) plus local ones: resync (socket reconnected — refetch everything) and poll (fallback tick).
 *
 * The admin portal counts its support inbox instead: unreadUrl="/api/admin/support/unread" unreadEvent="support:unread".
 */
const MessagingContext = createContext({ unread: 0, live: false, enabled: false, subscribe: () => () => {}, sendTyping: () => {}, refreshUnread: () => {} });

const POLL_MS = 20_000;
const RETRY_MS = 5_000;

export function MessagingProvider({ enabled = true, unreadUrl = '/api/messages/unread', unreadEvent = 'inbox:unread', children }) {
  const [unread, setUnread] = useState(0);
  const [live, setLive] = useState(false);
  const listeners = useRef(new Map()); // event → Set<fn>
  const socketRef = useRef(null);

  const dispatch = useCallback((event, payload) => {
    for (const fn of listeners.current.get(event) ?? []) fn(payload);
  }, []);

  const subscribe = useCallback((event, fn) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event).add(fn);
    return () => listeners.current.get(event)?.delete(fn);
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch(unreadUrl, { cache: 'no-store' });
      if (res.ok) setUnread((await res.json()).count ?? 0);
    } catch {
      // offline: keep the last count
    }
  }, [unreadUrl]);

  // Socket connection (skipped entirely when the server has no live messaging).
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let retryTimer;
    refreshUnread();

    (async () => {
      const probe = await fetch('/api/messages/ticket', { method: 'POST' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (cancelled || !probe?.live) return;

      const { io } = await import('socket.io-client');
      if (cancelled) return;
      let firstTicket = probe.ticket;
      const socket = io({
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        // A fresh one-time ticket for every (re)connection attempt.
        auth: (cb) => {
          if (firstTicket) {
            cb({ ticket: firstTicket });
            firstTicket = null;
            return;
          }
          fetch('/api/messages/ticket', { method: 'POST' })
            .then((r) => (r.ok ? r.json() : {}))
            .then((d) => cb({ ticket: d.ticket }))
            .catch(() => cb({}));
        },
      });
      socketRef.current = socket;

      let connectedBefore = false;
      socket.on('connect', () => {
        setLive(true);
        if (connectedBefore) {
          refreshUnread();
          dispatch('resync');
        }
        connectedBefore = true;
      });
      socket.on('disconnect', () => setLive(false));
      // Rejected by the server's auth (e.g. expired ticket): Socket.IO won't retry on its own.
      socket.on('connect_error', () => {
        setLive(false);
        if (!socket.active) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => !cancelled && socket.connect(), RETRY_MS);
        }
      });
      socket.on(unreadEvent, ({ count }) => setUnread(count ?? 0));
      for (const event of ['message:new', 'inbox:changed', 'typing', 'support:new']) socket.on(event, (p) => dispatch(event, p));
    })();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      socketRef.current?.disconnect();
      socketRef.current = null;
      setLive(false);
    };
  }, [enabled, unreadEvent, dispatch, refreshUnread]);

  // Polling fallback while there's no live connection.
  useEffect(() => {
    if (!enabled || live) return undefined;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      refreshUnread();
      dispatch('poll');
    };
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, live, dispatch, refreshUnread]);

  const sendTyping = useCallback((conversationId, typing) => {
    socketRef.current?.connected && socketRef.current.emit('typing', { conversationId, typing });
  }, []);

  const value = useMemo(
    () => ({ unread: enabled ? unread : 0, live, enabled, subscribe, sendTyping, refreshUnread, setUnread }),
    [enabled, unread, live, subscribe, sendTyping, refreshUnread],
  );
  return <MessagingContext value={value}>{children}</MessagingContext>;
}

export const useMessaging = () => useContext(MessagingContext);

/** Runs `handler` for each of `events` while mounted (the latest handler, without resubscribing). */
export function useMessagingEvents(events, handler) {
  const { subscribe } = useMessaging();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  const key = events.join('|');
  useEffect(() => {
    const offs = key.split('|').map((event) => subscribe(event, (payload) => ref.current(event, payload)));
    return () => offs.forEach((off) => off());
  }, [key, subscribe]);
}
