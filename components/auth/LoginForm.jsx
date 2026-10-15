'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { validateEmail } from '@/lib/validation';
import { AuthLabel, inputClass, FieldError, PasswordInput, SubmitButton, FormAlert } from '@/components/auth/AuthFields';

const DASHBOARD = { admin: '/admin', seller: '/seller/dashboard', customer: '/profile' };

export default function LoginForm({ next }) {
  const router = useRouter();
  const { login } = useAuth();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

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
    router.replace(next || DASHBOARD[result.user.role] || '/profile');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
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
