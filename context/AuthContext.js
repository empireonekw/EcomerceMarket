'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Global auth state for the storefront: { user, isLoggedIn, loading, login(), signup(), logout(), refresh() }.
 *
 * The session itself is an httpOnly JWT cookie that JS can't read. To keep pages static (no per-request
 * cookie reads on the server) the user is resolved client-side via /api/auth/me — but only when the
 * non-secret `apex_auth` hint cookie exists, so logged-out visitors never make that request.
 */
const AuthContext = createContext(null);

const hasAuthHint = () => typeof document !== 'undefined' && /(?:^|;\s*)apex_auth=1/.test(document.cookie);

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hasAuthHint()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await fetch('/api/auth/me', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setUser(res.ok ? data.user : null);
      return res.ok ? data.user : null;
    } catch {
      setUser(null); // network error: treat as signed out for UI purposes; the server still decides access
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Re-sync when the tab regains focus (e.g. logged out in another tab).
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  /** @returns {{ ok: true, user } | { ok: false, error: string, fields?: object }} */
  const login = useCallback(async (email, password) => {
    const { ok, data } = await postJson('/api/auth/login', { email, password });
    if (!ok) return { ok: false, error: data.error || 'Sign-in failed.', fields: data.fields };
    setUser(data.user);
    return { ok: true, user: data.user };
  }, []);

  const signup = useCallback(async ({ name, email, password, acceptTerms }) => {
    const { ok, data } = await postJson('/api/auth/signup', { name, email, password, acceptTerms });
    if (!ok) return { ok: false, error: data.error || 'Sign-up failed.', fields: data.fields };
    setUser(data.user);
    return { ok: true, user: data.user };
  }, []);

  const logout = useCallback(async ({ everywhere = false } = {}) => {
    await postJson(`/api/auth/logout${everywhere ? '?all=1' : ''}`).catch(() => {});
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoggedIn: Boolean(user), loading, login, signup, logout, refresh, setUser }),
    [user, loading, login, signup, logout, refresh],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
