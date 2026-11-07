'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { validateStoreName, validateStoreDescription, STORE_DESCRIPTION_LIMITS } from '@/lib/validation';
import { AuthLabel, inputClass, FieldError, FormAlert, SubmitButton } from '@/components/auth/AuthFields';

const config = { url: '/api/seller/profile', method: 'PUT', submit: 'Save shop details', pending: 'Saving…' };

// The description is optional (shops opened through /sell-on-sellpify may not have one yet); when given, the usual rules.
const validate = (v) =>
  Object.fromEntries(
    Object.entries({
      storeName: validateStoreName(v.storeName),
      storeDescription: v.storeDescription.trim() ? validateStoreDescription(v.storeDescription) : null,
    }).filter(([, m]) => m),
  );

/** Shop name + description (dashboard → Shop settings). Shops are opened with the wizard at /sell-on-sellpify. */
export default function ShopDetailsForm({ initial = {} }) {
  const router = useRouter();
  const [values, setValues] = useState({ storeName: initial.storeName ?? '', storeDescription: initial.storeDescription ?? '' });
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const errors = submitted ? { ...validate(values), ...serverErrors } : serverErrors;
  const descriptionLength = values.storeDescription.trim().length;

  const bind = (name) => ({
    id: name,
    name,
    value: values[name],
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setServerErrors(({ [name]: _, ...rest }) => rest);
      setSaved(false);
    },
    'aria-invalid': Boolean(errors[name]) || undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
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
    try {
      const res = await fetch(config.url, {
        method: config.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: values.storeName.trim(), storeDescription: values.storeDescription.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return router.push('/login?next=/seller/dashboard');
      if (!res.ok) {
        setServerErrors(data.fields ?? {});
        setFormError(data.error ?? 'Something went wrong.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert>{formError}</FormAlert>
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
          Shop details saved.
        </p>
      )}

      <div>
        <AuthLabel htmlFor="storeName">Shop name</AuthLabel>
        <input {...bind('storeName')} maxLength={60} autoComplete="organization" placeholder="e.g. Pixel Foundry" className={inputClass(errors.storeName)} />
        <FieldError id="storeName-error">{errors.storeName}</FieldError>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <AuthLabel htmlFor="storeDescription">Shop description</AuthLabel>
          <span className={`text-xs tabular-nums ${descriptionLength > STORE_DESCRIPTION_LIMITS.max ? 'text-red-600' : 'text-stone-400'}`}>
            {descriptionLength}/{STORE_DESCRIPTION_LIMITS.max}
          </span>
        </div>
        <textarea
          {...bind('storeDescription')}
          rows={4}
          maxLength={STORE_DESCRIPTION_LIMITS.max + 50}
          placeholder="What do you make, and who is it for? e.g. Clean, conversion-focused Notion and Figma templates for freelancers."
          className={`${inputClass(errors.storeDescription)} h-auto! resize-none py-3 leading-relaxed`}
        />
        <FieldError id="storeDescription-error">{errors.storeDescription}</FieldError>
      </div>

      <div className="max-w-xs">
        <SubmitButton pending={pending} pendingLabel={config.pending}>
          {config.submit}
        </SubmitButton>
      </div>
    </form>
  );
}
