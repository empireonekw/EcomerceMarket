'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { FieldError } from '@/components/auth/AuthFields';

async function call(method, body) {
  const res = await fetch('/api/auth/verify-email', {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * "Verify your email": sends a 6-digit code to the account's email (lib/data/email-verification.js), then takes it
 * here. A new code can be sent once the 60-second timer runs out. Shown in Account settings, at checkout and before
 * opening a shop; once verified the page refreshes so whatever it was waiting for appears. `title`/`text` set the
 * reason shown above the button.
 */
export default function EmailVerification({ email, title = 'Verify your email', text, className = '' }) {
  const router = useRouter();
  const { refresh } = useAuth();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [verified, setVerified] = useState(false);

  // The resend timer counts down once a second while it's running.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function send() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { ok, status, data } = await call('POST').catch(() => ({ ok: false, data: { error: 'Network error. Try again.' } }));
    setBusy(false);
    if (status === 401) return router.push('/login?next=/profile');
    if (data.verified) return done();
    if (!ok) {
      if (data.fields?.resendIn) setResendIn(data.fields.resendIn);
      return setError(data.error ?? 'Could not send the code. Try again.');
    }
    setSent(true);
    setCode('');
    setResendIn(data.resendIn ?? 60);
    setNotice(`We sent a 6-digit code to ${email}. It can take a minute; check your spam folder too.`);
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const { ok, data } = await call('PUT', { code: value }).catch(() => ({ ok: false, data: { error: 'Network error. Try again.' } }));
    setBusy(false);
    if (!ok) return setError(data.fields?.code ?? data.error ?? 'Could not check the code.');
    done();
  }

  function done() {
    setVerified(true);
    refresh(); // the header and checkout read the account from the auth context
    router.refresh(); // server pages (shop opening, account) show what was waiting for this
  }

  const card = `rounded-2xl border border-brand-200 bg-brand-50 p-5 sm:p-6 ${className}`;

  if (verified) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        <CheckCircle2 size={22} strokeWidth={2} aria-hidden="true" className="shrink-0" />
        <p className="font-medium">Your email is verified. Thank you!</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="verify-email-title" className={card}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-brand-700 ring-1 ring-brand-200">
          <MailCheck size={20} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="verify-email-title" className="headline text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-stone-600">
            {text ?? 'Verify your email to shop and to open your own shop.'} We’ll send a code to{' '}
            <span className="font-medium break-all text-ink">{email}</span>.
          </p>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-white px-3.5 py-2.5 text-sm text-stone-700 ring-1 ring-brand-200">
          {notice}
        </p>
      )}

      {sent ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          noValidate
          className="mt-4"
        >
          <label htmlFor="verify-email-code" className="text-sm font-medium">
            6-digit code
          </label>
          <div className="mt-1.5 flex flex-wrap items-start gap-2">
            <input
              id="verify-email-code"
              value={code}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(next);
                setError(null);
                if (next.length === 6) verify(next); // pasting or typing the last digit checks it straight away
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={6}
              autoFocus
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? 'verify-email-error' : undefined}
              className={`h-12 w-44 rounded-xl border bg-white px-4 text-center font-mono text-2xl tracking-[0.4em] placeholder:text-stone-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
                error ? 'border-red-400' : 'border-stone-300 focus:border-brand-600'
              }`}
            />
            <button type="submit" disabled={busy || code.length !== 6} className="btn btn-md btn-dark h-12">
              {busy && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              Verify
            </button>
          </div>
          <FieldError id="verify-email-error">{error}</FieldError>
          <p className="mt-3 text-sm text-stone-600">
            Didn’t get it?{' '}
            {resendIn > 0 ? (
              <span className="text-stone-500">
                Send a new code in <span className="font-medium tabular-nums text-ink">{mmss(resendIn)}</span>
              </span>
            ) : (
              <button type="button" onClick={send} disabled={busy} className="font-medium text-ink underline underline-offset-2 hover:text-brand-700">
                Send a new code
              </button>
            )}
          </p>
        </form>
      ) : (
        <div className="mt-4">
          <button type="button" onClick={send} disabled={busy || resendIn > 0} className="btn btn-md btn-dark">
            {busy && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {resendIn > 0 ? `Send code in ${mmss(resendIn)}` : 'Send code'}
          </button>
          <FieldError id="verify-email-error">{error}</FieldError>
        </div>
      )}
    </section>
  );
}
