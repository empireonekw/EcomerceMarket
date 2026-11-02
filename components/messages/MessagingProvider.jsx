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
 *
 * Connected only while someone is there: the socket closes when the tab has been hidden for HIDDEN_MS or nobody has
 * touched the page for IDLE_MS (and polling stops too), and opens again on the next mouse move, key, tap or return
 * to the tab, followed by a `resync` so open views fetch whatever arrived in between. Idle tabs hold no connection.
 */
const MessagingContext = createContext({ unread: 0, live: false, enabled: false, subscribe: () => () => {}, sendTyping: () => {}, refreshUnread: () => {} });

const POLL_MS = 20_000;
const RETRY_MS = 5_000;
const HIDDEN_MS = 2 * 60_000; // a background tab keeps its connection this long (quick tab switches don't reconnect)
const IDLE_MS = 10 * 60_000; // no mouse, keyboard, touch or scroll on a visible tab
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'focus'];

export function MessagingProvider({ enabled = true, unreadUrl = '/api/messages/unread', unreadEvent = 'inbox:unread', children }) {
  const [unread, setUnread] = useState(0);
  const [live, setLive] = useState(false);
  const [asleep, setAsleep] = useState(false); // tab hidden / user away: no socket, no polling
  const listeners = useRef(new Map()); // event → Set<fn>
  const socketRef = useRef(null);
  const sleepingRef = useRef(false); // the sleep / wake effect below; read by the socket's own retry logic

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
        autoConnect: !sleepingRef.current,
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
        if (!socket.active && !sleepingRef.current) {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => !cancelled && !sleepingRef.current && socket.connect(), RETRY_MS);
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

  // Sleep / wake: close the socket when the tab is hidden for a while or the user is away, reopen it on return.
  useEffect(() => {
    if (!enabled) return undefined;
    let lastActive = Date.now();
    let hiddenTimer;

    const sleep = () => {
      if (sleepingRef.current) return;
      sleepingRef.current = true;
      setAsleep(true);
      socketRef.current?.disconnect(); // a manual disconnect: Socket.IO won't reconnect by itself
    };
    const wake = () => {
      lastActive = Date.now();
      clearTimeout(hiddenTimer);
      if (!sleepingRef.current) return;
      sleepingRef.current = false;
      setAsleep(false);
      if (socketRef.current) socketRef.current.connect(); // 'connect' then refreshes the count and sends resync
      else {
        // No live server (polling mode): catch up straight away instead of waiting for the next tick.
        refreshUnread();
        dispatch('resync');
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake();
      else {
        clearTimeout(hiddenTimer);
        hiddenTimer = setTimeout(sleep, HIDDEN_MS);
      }
    };
    // Activity only records a time (cheap enough for pointermove); waking is the rare case.
    const onActivity = () => {
      lastActive = Date.now();
      if (sleepingRef.current && document.visibilityState === 'visible') wake();
    };
    const idleCheck = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActive > IDLE_MS) sleep();
    }, 30_000);

    document.addEventListener('visibilitychange', onVisibility);
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true, capture: true });
    if (document.visibilityState !== 'visible') hiddenTimer = setTimeout(sleep, HIDDEN_MS);
    return () => {
      clearInterval(idleCheck);
      clearTimeout(hiddenTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity, { capture: true });
    };
  }, [enabled, dispatch, refreshUnread]);

  // Polling fallback while there's no live connection (and someone is there to see it).
  useEffect(() => {
    if (!enabled || live || asleep) return undefined;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      refreshUnread();
      dispatch('poll');
    };
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, live, asleep, dispatch, refreshUnread]);

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
