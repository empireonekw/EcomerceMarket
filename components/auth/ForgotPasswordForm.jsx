'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { NEW_ACCOUNT_EMAIL_KEY } from '@/context/AuthContext';
import { validateEmail, validatePassword } from '@/lib/validation';
import { AuthLabel, inputClass, FieldError, PasswordInput, PasswordChecklist, SubmitButton, FormAlert } from '@/components/auth/AuthFields';
import Recaptcha, { recaptchaEnabled } from '@/components/auth/Recaptcha';

async function call(method, body) {
  const res = await fetch('/api/auth/password-reset', {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * /forgot-password: 1) the account's email (+ "I'm not a robot") → a 6-digit code is emailed;
 * 2) the code + a new password → back to /login to sign in with it. A new code can be sent once the 60-second
 * timer runs out (lib/data/password-reset.js).
 */
export default function ForgotPasswordForm() {
  const router = useRouter();
  const captchaRef = useRef(null);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);
  const [captcha, setCaptcha] = useState(null); // reCAPTCHA token (single-use)
  const [resendIn, setResendIn] = useState(0);

  // The resend timer counts down once a second while it's running.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function sendCode(e) {
    e?.preventDefault();
    setFormError(null);
    const emailError = validateEmail(email);
    if (emailError) return setErrors({ email: emailError });
    if (recaptchaEnabled && !captcha) return setErrors({ captcha: 'Please confirm you’re not a robot.' });
    setErrors({});
    setPending(true);
    const { ok, data } = await call('POST', { email: email.trim(), captchaToken: captcha }).catch(() => ({
      ok: false,
      data: { error: 'Network error. Try again.' },
    }));
    setPending(false);
    captchaRef.current?.reset(); // each token works once
    setCaptcha(null);
    if (!ok) {
      if (data.fields?.captcha) return setErrors({ captcha: data.fields.captcha });
      return setFormError(data.error ?? 'Could not send the code. Try again.');
    }
    setStep('code');
    setCode('');
    setResendIn(data.resendIn ?? 60);
  }

  async function reset(e) {
    e.preventDefault();
    setFormError(null);
    const found = {
      ...(code.length !== 6 && { code: 'Enter the 6-digit code from the email.' }),
      ...(validatePassword(password, { email }) && { password: validatePassword(password, { email }) }),
    };
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    const { ok, data } = await call('PUT', { email: email.trim(), code, password }).catch(() => ({
      ok: false,
      data: { error: 'Network error. Try again.' },
    }));
    if (!ok) {
      setPending(false);
      if (data.fields?.code || data.fields?.password) return setErrors(data.fields);
      return setFormError(data.error ?? 'Could not reset the password. Try again.');
    }
    try {
      sessionStorage.setItem(NEW_ACCOUNT_EMAIL_KEY, email.trim()); // the login form fills it in (one-time)
    } catch {}
    router.replace('/login?reset=1');
  }

  if (step === 'email') {
    return (
      <form onSubmit={sendCode} noValidate className="space-y-4">
        <FormAlert>{formError}</FormAlert>
        <div>
          <AuthLabel htmlFor="email">Email</AuthLabel>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors({});
            }}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className={inputClass(errors.email)}
          />
          <FieldError id="email-error">{errors.email}</FieldError>
        </div>
        <Recaptcha
          ref={captchaRef}
          error={errors.captcha}
          onChange={(token) => {
            setCaptcha(token);
            if (token) setErrors(({ captcha: _, ...rest }) => rest);
          }}
        />
        <div className="pt-1">
          <SubmitButton pending={pending} pendingLabel="Sending…">
            Send code
          </SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={reset} noValidate className="space-y-4">
      <p role="status" className="flex gap-2.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-stone-700">
        <MailCheck size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-700" />
        <span>
          If <span className="font-medium break-all text-ink">{email.trim()}</span> has an account, a 6-digit code is on its way. It can take a
          minute; check your spam folder too.
        </span>
      </p>
      <FormAlert>{formError}</FormAlert>
      <div>
        <AuthLabel htmlFor="code">6-digit code</AuthLabel>
        <input
          id="code"
          name="code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
            setErrors(({ code: _, ...rest }) => rest);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          maxLength={6}
          autoFocus
          aria-invalid={Boolean(errors.code) || undefined}
          aria-describedby={errors.code ? 'code-error' : undefined}
          className={`${inputClass(errors.code)} text-center font-mono text-xl tracking-[0.4em]`}
        />
        <FieldError id="code-error">{errors.code}</FieldError>
      </div>
      <div>
        <AuthLabel htmlFor="password">New password</AuthLabel>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="Choose a new password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors(({ password: _, ...rest }) => rest);
          }}
          error={errors.password}
        />
        <FieldError id="password-error">{errors.password}</FieldError>
        <PasswordChecklist password={password} />
      </div>
      <div className="pt-1">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Reset password
        </SubmitButton>
      </div>

      <div className="space-y-3 border-t border-stone-100 pt-4 text-sm text-stone-600">
        {resendIn > 0 ? (
          <p>
            Didn’t get it? Send a new code in <span className="font-medium tabular-nums text-ink">{mmss(resendIn)}</span>
          </p>
        ) : (
          <>
            <Recaptcha
              ref={captchaRef}
              error={errors.captcha}
              onChange={(token) => {
                setCaptcha(token);
                if (token) setErrors(({ captcha: _, ...rest }) => rest);
              }}
            />
            <p>
              Didn’t get it?{' '}
              <button
                type="button"
                onClick={sendCode}
                disabled={pending}
                className="font-medium text-ink underline underline-offset-2 hover:text-brand-700"
              >
                Send a new code
              </button>
            </p>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setStep('email');
            setFormError(null);
            setErrors({});
          }}
          className="text-stone-500 underline-offset-2 hover:text-ink hover:underline"
        >
          Use a different email
        </button>
      </div>
    </form>
  );
}
