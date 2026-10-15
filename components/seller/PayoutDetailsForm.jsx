'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, Smartphone } from 'lucide-react';
import { validateBankDetails, WALLET_OPTIONS } from '@/lib/validation';
import { inputClass, FieldError, FormAlert, SubmitButton } from '@/components/auth/AuthFields';

const validate = (v) => validateBankDetails(v);

/**
 * Payout destination on the seller dashboard: a bank account and/or a mobile wallet (at least one).
 * Kept out of shop setup — the dashboard shows an alert until it's filled in.
 */
export default function PayoutDetailsForm({ initial = {} }) {
  const router = useRouter();
  const [values, setValues] = useState({
    bankName: initial.bankName ?? '',
    accountTitle: initial.accountTitle ?? '',
    accountNumber: initial.accountNumber ?? '',
    walletProvider: initial.walletProvider ?? '',
    walletNumber: initial.walletNumber ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pending, setPending] = useState(false);

  const errors = submitted ? { ...validate(values), ...serverErrors } : serverErrors;

  const bind = (name) => ({
    id: name,
    name,
    value: values[name],
    onChange: (e) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setServerErrors(({ [name]: _, payoutMethod: __, ...rest }) => rest);
      setSuccess(null);
    },
    'aria-invalid': Boolean(errors[name]) || undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: inputClass(errors[name]),
  });

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    setSuccess(null);
    const found = validate(values);
    if (Object.keys(found).length) {
      document.getElementById(Object.keys(found).find((k) => k !== 'payoutMethod') ?? 'bankName')?.focus();
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/seller/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankDetails: values }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return router.push('/login?next=/seller/dashboard');
      if (!res.ok) {
        setServerErrors(data.fields ?? {});
        setFormError(data.error ?? 'Something went wrong.');
        return;
      }
      setSuccess('Payout details saved.');
      router.refresh();
    } catch {
      setFormError('Network error — please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert>{formError}</FormAlert>
      {success && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
          {success}
        </p>
      )}

      <fieldset className="rounded-2xl border border-stone-200 p-4 sm:p-5">
        <legend className="flex items-center gap-2 px-1 text-sm font-medium">
          <Building2 size={16} strokeWidth={1.75} aria-hidden="true" />
          Bank account
        </legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bankName" className="text-sm font-medium">
              Bank name
            </label>
            <input {...bind('bankName')} maxLength={80} placeholder="e.g. Meezan Bank" />
            <FieldError id="bankName-error">{errors.bankName}</FieldError>
          </div>
          <div>
            <label htmlFor="accountTitle" className="text-sm font-medium">
              Account title
            </label>
            <input {...bind('accountTitle')} maxLength={80} autoComplete="name" placeholder="Name on the account" />
            <FieldError id="accountTitle-error">{errors.accountTitle}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="accountNumber" className="text-sm font-medium">
              IBAN / account number
            </label>
            <input {...bind('accountNumber')} maxLength={40} autoComplete="off" spellCheck={false} placeholder="PK36SCBL0000001123456702" />
            <FieldError id="accountNumber-error">{errors.accountNumber}</FieldError>
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-stone-200 p-4 sm:p-5">
        <legend className="flex items-center gap-2 px-1 text-sm font-medium">
          <Smartphone size={16} strokeWidth={1.75} aria-hidden="true" />
          Mobile wallet
        </legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="walletProvider" className="text-sm font-medium">
              Provider
            </label>
            <select {...bind('walletProvider')}>
              <option value="">None</option>
              {WALLET_OPTIONS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
            <FieldError id="walletProvider-error">{errors.walletProvider}</FieldError>
          </div>
          <div>
            <label htmlFor="walletNumber" className="text-sm font-medium">
              Wallet number
            </label>
            <input {...bind('walletNumber')} inputMode="tel" autoComplete="tel" maxLength={15} placeholder="03001234567" />
            <FieldError id="walletNumber-error">{errors.walletNumber}</FieldError>
          </div>
        </div>
      </fieldset>

      {errors.payoutMethod && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {errors.payoutMethod}
        </p>
      )}
      <p className="text-xs text-stone-500">Add a bank account, a mobile wallet, or both. Payouts are sent manually by our team.</p>

      <div className="max-w-xs">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save payout details
        </SubmitButton>
      </div>
    </form>
  );
}
