'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { AuthLabel, inputClass, FieldError, FormAlert, SubmitButton } from '@/components/auth/AuthFields';
import { checkStep, countryOf, COUNTRIES, CURRENCIES, DIAL_CODES } from '@/lib/seller-onboarding';

/** Same rules as the shop-opening wizard's "Shop preferences" and "Billing info" steps (lib/seller-onboarding.js). */
function validate(v) {
  const prefs = checkStep('preferences', { country: v.country, currency: v.currency });
  const billing = checkStep('billing', { address: v.address, phone: v.phone });
  return { ...(prefs.ok ? {} : prefs.errors), ...(billing.ok ? {} : billing.errors) };
}

/**
 * Where the shop is based, its currency, billing address and phone (Shop settings, /seller/settings): everything
 * entered in the wizard's first and third steps. The address and phone stay private.
 */
export default function ShopContactForm({ initial }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const errors = submitted ? { ...validate(values), ...serverErrors } : serverErrors;

  const update = (key, patch, group) => {
    setValues((v) => (group ? { ...v, [group]: { ...v[group], ...patch } } : { ...v, ...patch }));
    setServerErrors(({ [key]: _, ...rest }) => rest);
    setSaved(false);
  };

  const aria = (key) => ({
    id: key,
    'aria-invalid': Boolean(errors[key]) || undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  const addressField = (field, label, props = {}) => {
    const key = `address.${field}`;
    return (
      <div className={props.wide ? 'sm:col-span-2' : undefined}>
        <AuthLabel htmlFor={key}>{label}</AuthLabel>
        <input
          {...aria(key)}
          value={values.address[field] ?? ''}
          onChange={(e) => update(key, { [field]: e.target.value }, 'address')}
          autoComplete={props.autoComplete}
          maxLength={props.maxLength}
          className={inputClass(errors[key])}
        />
        <FieldError id={`${key}-error`}>{errors[key]}</FieldError>
      </div>
    );
  };

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
        body: JSON.stringify({ contact: values }),
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <AuthLabel htmlFor="country">Shop country</AuthLabel>
          <select
            {...aria('country')}
            value={values.country}
            onChange={(e) => {
              const c = countryOf(e.target.value);
              update('country', { country: e.target.value });
              // Like the wizard: a new country suggests its currency and, while no phone is entered, its dialling code.
              if (CURRENCIES.some((x) => x.value === c?.currency)) update('currency', { currency: c.currency });
              if (!values.phone.number && c) update('phone.dial', { dial: c.dial }, 'phone');
            }}
            className={inputClass(errors.country)}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError id="country-error">{errors.country}</FieldError>
        </div>
        <div>
          <AuthLabel htmlFor="currency">Shop currency</AuthLabel>
          <select
            {...aria('currency')}
            value={values.currency}
            onChange={(e) => update('currency', { currency: e.target.value })}
            className={inputClass(errors.currency)}
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <FieldError id="currency-error">{errors.currency}</FieldError>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {addressField('line1', 'Street address', { wide: true, autoComplete: 'address-line1', maxLength: 120 })}
        {addressField('line2', 'Apartment, suite, area (optional)', { wide: true, autoComplete: 'address-line2', maxLength: 120 })}
        {addressField('city', 'City', { autoComplete: 'address-level2', maxLength: 60 })}
        {addressField('state', 'State / province', { autoComplete: 'address-level1', maxLength: 60 })}
        {addressField('postalCode', 'Postal code', { autoComplete: 'postal-code', maxLength: 10 })}
        <div>
          <AuthLabel htmlFor="phone.number">Phone number</AuthLabel>
          <div className="flex">
            <label htmlFor="phone.dial" className="sr-only">
              Country code
            </label>
            <select
              id="phone.dial"
              value={values.phone.dial}
              onChange={(e) => update('phone.dial', { dial: e.target.value }, 'phone')}
              className="mt-2 h-11 rounded-l-xl border border-r-0 border-stone-300 bg-stone-50 px-3 text-base focus:border-ink focus:outline-none"
            >
              {DIAL_CODES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              {...aria('phone.number')}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              maxLength={18}
              placeholder="300 1234567"
              value={values.phone.number}
              onChange={(e) => update('phone.number', { number: e.target.value }, 'phone')}
              className={`${inputClass(errors['phone.number'])} rounded-l-none`}
            />
          </div>
          <FieldError id="phone.number-error">{errors['phone.number'] ?? errors['phone.dial']}</FieldError>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="w-full max-w-xs">
          <SubmitButton pending={pending} pendingLabel="Saving…">
            Save location & contact
          </SubmitButton>
        </div>
        {saved && (
          <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}
