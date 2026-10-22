'use client';

import { useId, useRef, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
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

const DELETE_EFFECTS = {
  customer: [
    'Your profile, sign-in and saved details are removed.',
    'My Purchases goes away with the account — download anything you want to keep first.',
    'Your product reviews are removed.',
  ],
  seller: [
    'Your profile, shop and payout details are removed.',
    'Products that never sold are deleted; sold ones are taken off sale so their buyers keep their downloads.',
    'Any balance must be paid out before you can delete the account.',
  ],
};

/** "Delete account permanently": explains what happens, then asks for the password in a dialog (DELETE /api/auth/me). */
export function DeleteAccount({ role }) {
  const dialogRef = useRef(null);
  const id = useId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const effects = DELETE_EFFECTS[role] ?? DELETE_EFFECTS.customer;

  function open() {
    setPassword('');
    setError(null);
    setFormError(null);
    dialogRef.current?.showModal();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!password) return setError('Enter your password to confirm.');
    setPending(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.fields?.password ?? null);
        setFormError(data.fields?.password ? null : (data.error ?? 'Could not delete your account.'));
        setPending(false);
        return;
      }
      setDeleted(true);
      window.location.replace('/'); // full navigation so every page renders signed out
    } catch {
      setFormError('Network error — please try again.');
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5 sm:p-6">
      <h2 className="headline text-2xl">Delete account</h2>
      <p className="mt-0.5 text-sm text-stone-500">Permanently delete your account and personal data. This can’t be undone.</p>
      <button type="button" onClick={open} className="btn btn-md mt-4 border border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50">
        <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
        Delete account permanently
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.target === e.currentTarget && !pending && e.currentTarget.close()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-left text-ink shadow-2xl backdrop:bg-black/40"
      >
        <form onSubmit={onSubmit} noValidate className="space-y-5 p-6">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h2 id={`${id}-title`} className="headline text-2xl">
                Delete your account?
              </h2>
              <p className="mt-1 text-sm text-stone-600">This is permanent and can’t be undone.</p>
            </div>
          </div>
          <ul className="list-disc space-y-1.5 rounded-xl bg-stone-50 py-3 pl-8 pr-4 text-sm text-stone-600 marker:text-stone-400">
            {effects.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <FormAlert>{formError}</FormAlert>
          <div>
            <label htmlFor={`${id}-password`} className="text-sm font-medium text-stone-800">
              Enter your password to confirm
            </label>
            <PasswordInput
              id={`${id}-password`}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              error={error}
            />
            <FieldError id={`${id}-password-error`}>{error}</FieldError>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className="btn btn-md btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn btn-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
              {pending && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {deleted ? 'Account deleted' : pending ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
