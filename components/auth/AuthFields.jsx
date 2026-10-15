'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { PASSWORD_RULES } from '@/lib/validation';

// Shared form primitives (auth pages, account settings, seller forms).
export const inputClass = (error) =>
  `mt-1.5 h-11 w-full rounded-xl border bg-white px-3.5 text-sm placeholder:text-stone-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${
    error ? 'border-red-400 focus:border-red-500' : 'border-stone-300 hover:border-stone-400 focus:border-brand-600'
  }`;

export function AuthLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-stone-800">
      {children}
    </label>
  );
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-red-600">
      {children}
    </p>
  );
}

/** Password input with an eye toggle. */
export function PasswordInput({ id, error, ...props }) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={visible ? 'text' : 'password'}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass(error)} pr-11`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1.5 top-1/2 mt-0.75 grid size-8 -translate-y-1/2 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-ink"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Live checklist of PASSWORD_RULES (the same rules the server enforces). */
export function PasswordChecklist({ password }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={`flex items-center gap-2 transition-colors ${met ? 'text-emerald-700' : 'text-stone-500'}`}>
            <span
              aria-hidden="true"
              className={`grid size-4 shrink-0 place-items-center rounded-full transition-colors ${met ? 'bg-emerald-500 text-white' : 'bg-stone-200'}`}
            >
              {met && <Check size={11} strokeWidth={3} />}
            </span>
            {rule.label}
            <span className="sr-only">{met ? '(met)' : '(not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function SubmitButton({ pending, children, pendingLabel }) {
  return (
    <button type="submit" disabled={pending} className="btn btn-md btn-primary w-full">
      {pending && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormAlert({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {children}
    </p>
  );
}
