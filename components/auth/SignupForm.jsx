'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { validateName, validateEmail, validatePassword } from '@/lib/validation';
import { AuthLabel, inputClass, FieldError, PasswordInput, PasswordChecklist, SubmitButton, FormAlert } from '@/components/auth/AuthFields';

function validate(v) {
  const e = {
    name: validateName(v.name),
    email: validateEmail(v.email),
    password: validatePassword(v.password, { email: v.email }),
    confirm: !v.confirm ? 'Please repeat your password.' : v.confirm !== v.password ? 'Passwords don’t match.' : null,
    acceptTerms: v.acceptTerms ? null : 'Please accept the Terms of Service and Privacy Policy.',
  };
  return Object.fromEntries(Object.entries(e).filter(([, msg]) => msg));
}

export default function SignupForm({ next }) {
  const router = useRouter();
  const { signup } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '', acceptTerms: false });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);

  const errors = { ...validate(values), ...serverErrors };
  const show = (k) => (touched[k] || submitted ? errors[k] : undefined);

  const bind = (name) => ({
    id: name,
    name,
    value: values[name],
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      if (serverErrors[name]) setServerErrors(({ [name]: _, ...rest }) => rest);
    },
    onBlur: () => setTouched((t) => ({ ...t, [name]: true })),
  });

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    const found = validate(values);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found)[0])?.focus();
      return;
    }

    setPending(true);
    const result = await signup({
      name: values.name.trim(),
      email: values.email.trim(),
      password: values.password,
      acceptTerms: values.acceptTerms,
    }).catch(() => ({ ok: false, error: 'Network error — please try again.' }));
    if (!result.ok) {
      setServerErrors(result.fields ?? {});
      setFormError(result.error);
      setPending(false);
      return;
    }
    router.replace(next || '/profile');
    router.refresh();
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert>{formError}</FormAlert>

      {/* Two columns from `sm`: name | email, then password | confirm. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <AuthLabel htmlFor="name">Full name</AuthLabel>
          <input {...bind('name')} autoComplete="name" maxLength={80} placeholder="Jane Smith" aria-invalid={Boolean(show('name')) || undefined} aria-describedby={show('name') ? 'name-error' : undefined} className={inputClass(show('name'))} />
          <FieldError id="name-error">{show('name')}</FieldError>
        </div>

        <div>
          <AuthLabel htmlFor="email">Email</AuthLabel>
          <input {...bind('email')} type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" aria-invalid={Boolean(show('email')) || undefined} aria-describedby={show('email') ? 'email-error' : undefined} className={inputClass(show('email'))} />
          <FieldError id="email-error">
            {show('email') && (
              <>
                {show('email')}
                {serverErrors.email && (
                  <>
                    {' '}
                    <Link href={loginHref} className="underline">
                      Log in
                    </Link>
                  </>
                )}
              </>
            )}
          </FieldError>
        </div>
      </div>

      <div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <AuthLabel htmlFor="password">Password</AuthLabel>
            <PasswordInput {...bind('password')} autoComplete="new-password" placeholder="Create a strong password" error={show('password')} />
            {submitted && <FieldError id="password-error">{show('password')}</FieldError>}
          </div>

          <div>
            <AuthLabel htmlFor="confirm">Confirm password</AuthLabel>
            <PasswordInput {...bind('confirm')} autoComplete="new-password" placeholder="Repeat password" error={show('confirm')} />
            <FieldError id="confirm-error">{show('confirm')}</FieldError>
          </div>
        </div>
        <PasswordChecklist password={values.password} />
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-stone-600">
          <input
            id="acceptTerms"
            type="checkbox"
            checked={values.acceptTerms}
            onChange={(e) => setValues((v) => ({ ...v, acceptTerms: e.target.checked }))}
            aria-invalid={Boolean(show('acceptTerms')) || undefined}
            className="mt-0.5 size-4 shrink-0 rounded border-stone-300 accent-brand-600"
          />
          <span>
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="font-medium text-black underline-offset-2 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank" className="font-medium text-black underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>
        <FieldError id="acceptTerms-error">{show('acceptTerms')}</FieldError>
      </div>

      <div className="pt-1">
        <SubmitButton pending={pending} pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </div>
    </form>
  );
}
