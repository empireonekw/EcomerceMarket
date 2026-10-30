'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import SignOutScreen from '@/components/SignOutScreen';

/**
 * Global auth state for the storefront: { user, isLoggedIn, loading, login(), signup(), logout(), refresh() }.
 *
 * Sign-up creates the account only; SignupForm hands the email to the login page through sessionStorage
 * (NEW_ACCOUNT_EMAIL_KEY) so it never appears in a URL. logout() shows <SignOutScreen /> and lands on the homepage.
 *
 * The session itself is an httpOnly JWT cookie that JS can't read. To keep pages static (no per-request
 * cookie reads on the server) the user is resolved client-side via /api/auth/me — but only when the
 * non-secret `apex_auth` hint cookie exists, so logged-out visitors never make that request.
 */
const AuthContext = createContext(null);

export const NEW_ACCOUNT_EMAIL_KEY = 'new-account-email';

export const hasAuthHint = () => typeof document !== 'undefined' && /(?:^|;\s*)apex_auth=1/.test(document.cookie);

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
  const [signingOut, setSigningOut] = useState(false);

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
  const login = useCallback(async (email, password, captchaToken) => {
    const { ok, data } = await postJson('/api/auth/login', { email, password, captchaToken });
    if (!ok) return { ok: false, error: data.error || 'Sign-in failed.', fields: data.fields };
    setUser(data.user);
    return { ok: true, user: data.user };
  }, []);

  const signup = useCallback(async ({ name, email, password, acceptTerms, accountType = 'customer', captchaToken }) => {
    const { ok, data } = await postJson('/api/auth/signup', { name, email, password, acceptTerms, accountType, captchaToken });
    if (!ok) return { ok: false, error: data.error || 'Sign-up failed.', fields: data.fields };
    return { ok: true, user: data.user };
  }, []);

  /** Clears the session, then does a full navigation (home by default) so every page re-renders signed out. */
  const logout = useCallback(async ({ everywhere = false, redirectTo = '/' } = {}) => {
    setSigningOut(true);
    await postJson(`/api/auth/logout${everywhere ? '?all=1' : ''}`).catch(() => {});
    window.location.replace(redirectTo); // the overlay stays up until the next page paints
  }, []);

  const value = useMemo(
    () => ({ user, isLoggedIn: Boolean(user), loading, login, signup, logout, refresh, setUser }),
    [user, loading, login, signup, logout, refresh],
  );

  return (
    <AuthContext value={value}>
      {children}
      {signingOut && <SignOutScreen />}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
