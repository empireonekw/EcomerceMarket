'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import ImageUpload from '@/components/seller/onboarding/ImageUpload';
import { validateStoreName, validateStoreDescription, STORE_DESCRIPTION_LIMITS } from '@/lib/validation';
import { AuthLabel, inputClass, FieldError, FormAlert, SubmitButton } from '@/components/auth/AuthFields';

// The description is optional (shops opened through /sell-on-sellpify may not have one yet); when given, the usual rules.
const validate = (v) =>
  Object.fromEntries(
    Object.entries({
      storeName: validateStoreName(v.storeName),
      storeDescription: v.storeDescription.trim() ? validateStoreDescription(v.storeDescription) : null,
    }).filter(([, m]) => m),
  );

/**
 * The shop's public profile (Shop settings, /seller/settings): name, description, profile picture and banner.
 * `uploads` = the upload driver ('blob' | 'local' | null), from lib/uploads.js uploadDriver().
 */
export default function ShopDetailsForm({ initial = {}, uploads }) {
  const router = useRouter();
  const [values, setValues] = useState({
    storeName: initial.storeName ?? '',
    storeDescription: initial.storeDescription ?? '',
    logo: initial.logo ?? '',
    banner: initial.banner ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const errors = submitted ? { ...validate(values), ...serverErrors } : serverErrors;
  const descriptionLength = values.storeDescription.trim().length;

  const change = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setServerErrors(({ [name]: _, ...rest }) => rest);
    setSaved(false);
  };

  const bind = (name) => ({
    id: name,
    name,
    value: values[name],
    onChange: (e) => change(name, e.target.value),
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
      const res = await fetch('/api/seller/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: values.storeName.trim(),
          storeDescription: values.storeDescription.trim(),
          logo: values.logo,
          banner: values.banner,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return router.push('/login?next=/seller/settings');
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
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert>{formError}</FormAlert>

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

      <ImageUpload
        id="logo"
        label="Shop profile picture"
        hint="Your shop’s logo or a photo of you. Square, at least 500 × 500 px."
        kind="photo"
        shape="logo"
        value={values.logo}
        onChange={(v) => change('logo', v)}
        driver={uploads}
        error={errors.logo}
      />
      <ImageUpload
        id="banner"
        label="Shop banner"
        hint="The wide cover across the top of your shop page. About 3360 × 840 px (4:1)."
        kind="photo"
        shape="banner"
        value={values.banner}
        onChange={(v) => change('banner', v)}
        driver={uploads}
        error={errors.banner}
      />

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-full max-w-xs">
          <SubmitButton pending={pending} pendingLabel="Saving…">
            Save shop profile
          </SubmitButton>
        </div>
        {saved && (
          <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
            Saved. Your shop page is updated.
          </p>
        )}
      </div>
    </form>
  );
}
