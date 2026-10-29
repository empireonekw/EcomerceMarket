'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { AuthLabel, FieldError, FormAlert, SubmitButton, inputClass } from '@/components/auth/AuthFields';
import { CONTACT_LIMITS, validateContactMessage } from '@/lib/validation';

const EMPTY = { name: '', email: '', message: '', website: '' };

/** /contact form: Name, Email, Message → POST /api/contact. Prefills name and email for signed-in users. */
export default function ContactForm({ defaultName = '', defaultEmail = '' }) {
  const [values, setValues] = useState({ ...EMPTY, name: defaultName, email: defaultEmail });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
  };

  async function onSubmit(e) {
    e.preventDefault();
    setFormError(null);
    const found = validateContactMessage(values);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`contact-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, name: values.name.trim(), email: values.email.trim(), message: values.message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? 'Could not send your message.');
        return;
      }
      setSent(true);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center px-4 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="headline mt-5 text-2xl">Message sent</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-600">
          Thanks, {values.name.trim().split(' ')[0]}. We’ll reply to <span className="font-medium text-black">{values.email.trim()}</span> within one to two
          business days.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues((v) => ({ ...v, message: '' }));
            setSent(false);
          }}
          className="btn btn-md btn-outline mt-6"
        >
          Send another message
        </button>
      </div>
    );
  }

  const count = values.message.trim().length;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert>{formError}</FormAlert>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <AuthLabel htmlFor="contact-name">Name</AuthLabel>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            placeholder="Your full name"
            value={values.name}
            onChange={onChange}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={errors.name ? 'contact-name-error' : undefined}
            className={inputClass(errors.name)}
          />
          <FieldError id="contact-name-error">{errors.name}</FieldError>
        </div>
        <div>
          <AuthLabel htmlFor="contact-email">Email</AuthLabel>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={values.email}
            onChange={onChange}
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? 'contact-email-error' : undefined}
            className={inputClass(errors.email)}
          />
          <FieldError id="contact-email-error">{errors.email}</FieldError>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <AuthLabel htmlFor="contact-message">Message</AuthLabel>
          <span className="text-xs tabular-nums text-stone-400">
            {count}/{CONTACT_LIMITS.max}
          </span>
        </div>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          maxLength={CONTACT_LIMITS.max}
          placeholder="How can we help? Include your order number if it’s about a purchase."
          value={values.message}
          onChange={onChange}
          aria-invalid={Boolean(errors.message) || undefined}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          className={`${inputClass(errors.message)} h-auto resize-y py-3 leading-relaxed`}
        />
        <FieldError id="contact-message-error">{errors.message}</FieldError>
      </div>

      {/* Honeypot for bots — hidden from people and assistive tech. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={onChange} />
      </div>

      <div className="pt-1">
        <SubmitButton pending={pending} pendingLabel="Sending…">
          Send message
        </SubmitButton>
      </div>
    </form>
  );
}
