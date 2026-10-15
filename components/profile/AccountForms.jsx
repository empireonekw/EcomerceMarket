'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { validateName, validatePassword } from '@/lib/validation';
import { inputClass, FieldError, PasswordInput, PasswordChecklist, FormAlert } from '@/components/auth/AuthFields';

async function patchMe(body) {
  const res = await fetch('/api/auth/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

function SaveButton({ pending, children, disabled }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn btn-md btn-dark"
    >
      {pending && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  );
}

function Success({ children }) {
  if (!children) return null;
  return (
    <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
      {children}
    </p>
  );
}

const card = 'rounded-2xl border border-stone-200 bg-white p-5 sm:p-6';

export function NameForm({ initialName }) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setSuccess(null);
    const err = validateName(name);
    setError(err);
    if (err) return;
    setPending(true);
    const { ok, status, data } = await patchMe({ name: name.trim() });
    setPending(false);
    if (status === 401) return router.push('/login?next=/profile');
    if (!ok) return setError(data.fields?.name ?? data.error ?? 'Could not save.');
    setSaved(data.user.name);
    setUser((u) => (u ? { ...u, name: data.user.name } : u)); // header avatar/name update instantly
    setSuccess('Your name was updated.');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className={card}>
      <h2 className="headline text-2xl">Profile name</h2>
      <p className="mt-0.5 text-sm text-stone-500">Shown in your account and on receipts.</p>
      <div className="mt-4 space-y-3">
        <Success>{success}</Success>
        <div>
          <label htmlFor="profile-name" className="text-sm font-medium">
            Full name
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            maxLength={80}
            autoComplete="name"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'profile-name-error' : undefined}
            className={inputClass(error)}
          />
          <FieldError id="profile-name-error">{error}</FieldError>
        </div>
        <SaveButton pending={pending} disabled={name.trim() === saved}>
          {pending ? 'Saving…' : 'Save name'}
        </SaveButton>
      </div>
    </form>
  );
}

export function PasswordForm({ email }) {
  const router = useRouter();
  const empty = { currentPassword: '', newPassword: '', confirm: '' };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    setErrors(({ [name]: _, ...rest }) => rest);
    setSuccess(null);
  };

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);
    const found = Object.fromEntries(
      Object.entries({
        currentPassword: values.currentPassword ? null : 'Enter your current password.',
        newPassword: validatePassword(values.newPassword, { email }),
        confirm: values.confirm !== values.newPassword ? 'Passwords don’t match.' : null,
      }).filter(([, v]) => v),
    );
    setErrors(found);
    if (Object.keys(found).length) return;

    setPending(true);
    const { ok, status, data } = await patchMe({ currentPassword: values.currentPassword, newPassword: values.newPassword });
    setPending(false);
    if (status === 401) return router.push('/login?next=/profile');
    if (!ok) {
      setErrors(data.fields ?? {});
      if (!data.fields) setFormError(data.error ?? 'Could not change password.');
      return;
    }
    setValues(empty);
    setSuccess('Password changed. You’ve been signed out on all other devices.');
  }

  return (
    <form onSubmit={onSubmit} noValidate className={card}>
      <h2 className="headline text-2xl">Change password</h2>
      <p className="mt-0.5 text-sm text-stone-500">Changing it signs you out everywhere else.</p>
      <div className="mt-4 space-y-3">
        <Success>{success}</Success>
        <FormAlert>{formError}</FormAlert>
        {/* Hidden username field helps password managers update the right entry. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div>
          <label htmlFor="currentPassword" className="text-sm font-medium">
            Current password
          </label>
          <PasswordInput id="currentPassword" autoComplete="current-password" value={values.currentPassword} onChange={onChange} error={errors.currentPassword} />
          <FieldError id="currentPassword-error">{errors.currentPassword}</FieldError>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="newPassword" className="text-sm font-medium">
              New password
            </label>
            <PasswordInput id="newPassword" autoComplete="new-password" value={values.newPassword} onChange={onChange} error={errors.newPassword} />
            <FieldError id="newPassword-error">{errors.newPassword}</FieldError>
          </div>
          <div>
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirm new password
            </label>
            <PasswordInput id="confirm" autoComplete="new-password" value={values.confirm} onChange={onChange} error={errors.confirm} />
            <FieldError id="confirm-error">{errors.confirm}</FieldError>
          </div>
        </div>
        <PasswordChecklist password={values.newPassword} />
        <SaveButton pending={pending}>{pending ? 'Updating…' : 'Update password'}</SaveButton>
      </div>
    </form>
  );
}

export function SessionControls({ expiresAt }) {
  const { logout } = useAuth();
  const [pending, setPending] = useState(null);

  function signOut(everywhere) {
    setPending(everywhere ? 'all' : 'this');
    logout({ everywhere });
  }

  return (
    <section className={card}>
      <h2 className="headline text-2xl">Sessions</h2>
      <p className="mt-0.5 text-sm text-stone-500">
        This session stays active until{' '}
        <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</time>.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => signOut(false)}
          disabled={Boolean(pending)}
          className="btn btn-md btn-outline"
        >
          {pending === 'this' ? 'Signing out…' : 'Log out'}
        </button>
        <button
          type="button"
          onClick={() => signOut(true)}
          disabled={Boolean(pending)}
          className="h-10 rounded-full px-4 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {pending === 'all' ? 'Signing out…' : 'Log out of all devices'}
        </button>
      </div>
    </section>
  );
}
