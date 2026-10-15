'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useAuth, NEW_ACCOUNT_EMAIL_KEY } from '@/context/AuthContext';
import { validateEmail } from '@/lib/validation';
import { AuthLabel, inputClass, FieldError, PasswordInput, SubmitButton, FormAlert } from '@/components/auth/AuthFields';

// Where each role lands after logging in. Sellers without a shop are forwarded to /seller/onboarding.
const DASHBOARD = { admin: '/admin', seller: '/seller/dashboard', customer: '/profile' };

/** `registered` = arriving straight from sign-up: email prefilled; new customers then land on `next` or the homepage. */
export default function LoginForm({ next, registered = false }) {
  const router = useRouter();
  const { login } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  // Pick up the email SignupForm left in sessionStorage (one-time) and jump straight to the password.
  useEffect(() => {
    if (!registered) return;
    let email = null;
    try {
      email = sessionStorage.getItem(NEW_ACCOUNT_EMAIL_KEY);
      sessionStorage.removeItem(NEW_ACCOUNT_EMAIL_KEY);
    } catch {}
    if (email) {
      setValues((v) => ({ ...v, email }));
      document.getElementById('password')?.focus();
    }
  }, [registered]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
  };

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const found = {
      ...(validateEmail(values.email) && { email: validateEmail(values.email) }),
      ...(!values.password && { password: 'Please enter your password.' }),
    };
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    setPending(true);
    const result = await login(values.email.trim(), values.password).catch(() => ({ ok: false, error: 'Network error — please try again.' }));
    if (!result.ok) {
      setFormError(result.error);
      setErrors(result.fields ?? {});
      setPending(false);
      return;
    }
    const { role } = result.user;
    router.replace(next || (registered && role === 'customer' ? '/' : DASHBOARD[role]) || '/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {registered && !formError && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          <Check size={16} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
          {registered === 'seller' ? 'Seller account created. Log in to set up your shop.' : 'Your account is ready. Enter your password to log in.'}
        </p>
      )}
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
          value={values.email}
          onChange={onChange}
          aria-invalid={Boolean(errors.email) || undefined}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className={inputClass(errors.email)}
        />
        <FieldError id="email-error">{errors.email}</FieldError>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <AuthLabel htmlFor="password">Password</AuthLabel>
          <Link href="/forgot-password" className="text-sm text-stone-500 hover:text-black">
            Forgot password?
          </Link>
        </div>
        <PasswordInput id="password" autoComplete="current-password" placeholder="Your password" value={values.password} onChange={onChange} error={errors.password} />
        <FieldError id="password-error">{errors.password}</FieldError>
      </div>

      <div className="pt-1">
        <SubmitButton pending={pending} pendingLabel="Logging in…">
          Log in
        </SubmitButton>
      </div>
    </form>
  );
}
