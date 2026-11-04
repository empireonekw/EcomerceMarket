'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, CheckCircle2, Clock, CreditCard, Loader2, Lock, PartyPopper, Smartphone, X } from 'lucide-react';
import ImageUpload from '@/components/seller/onboarding/ImageUpload';
import { walletIdLabel, WALLET_OPTIONS } from '@/lib/validation';
import { checkStep, COUNTRIES, countryOf, CURRENCIES, DIAL_CODES, ONBOARDING_STEPS } from '@/lib/seller-onboarding';

// Wallet provider tiles: a colored initial in each service's own color family.
const WALLET_TILE = {
  jazzcash: 'bg-red-50 text-red-700',
  easypaisa: 'bg-emerald-50 text-emerald-700',
  nayapay: 'bg-orange-50 text-orange-700',
  sadapay: 'bg-teal-50 text-teal-700',
  payoneer: 'bg-amber-50 text-amber-700',
  paypal: 'bg-sky-50 text-sky-700',
};

const inputCls = (err) =>
  `mt-1.5 h-11 w-full rounded-xl border bg-white px-3.5 text-[15px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 ${
    err ? 'border-red-400 focus:border-red-500' : 'border-stone-300 hover:border-stone-400 focus:border-ink'
  }`;

function Field({ id, label, optional, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label} {optional ? <span className="font-normal text-stone-400">(optional)</span> : <span className="text-red-600">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{hint}</p>
      )}
    </div>
  );
}

const aria = (id, error) => ({ id, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': error ? `${id}-error` : undefined });

/** Etsy-style progress line: done steps get a check, the current one is filled. Phones get "Step 2 of 5" and a bar. */
function Timeline({ current, furthest, onJump }) {
  return (
    <nav aria-label="Shop setup progress">
      <ol className="hidden grid-cols-5 sm:grid">
        {ONBOARDING_STEPS.map((s, i) => {
          const done = i < furthest && i !== current;
          const reachable = i <= furthest;
          return (
            <li key={s.id} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2 ${i <= furthest ? 'bg-ink' : 'bg-stone-200'}`}
                />
              )}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(i)}
                aria-current={i === current ? 'step' : undefined}
                className="relative z-10 flex flex-col items-center gap-2 disabled:cursor-default"
              >
                <span
                  className={`grid size-6 place-items-center rounded-full border-2 transition-colors ${
                    i === current ? 'border-ink bg-ink' : done ? 'border-ink bg-white text-ink' : 'border-stone-300 bg-white'
                  }`}
                >
                  {done && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                </span>
                <span className={`text-xs ${i === current ? 'font-medium text-ink' : 'text-stone-500'}`}>
                  {s.label}
                  {done && <span className="sr-only"> (done)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="sm:hidden">
        <p className="text-sm">
          <span className="font-medium text-ink">
            Step {current + 1} of {ONBOARDING_STEPS.length}
          </span>{' '}
          <span className="text-stone-500">· {ONBOARDING_STEPS[current].label}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${((current + 1) / ONBOARDING_STEPS.length) * 100}%` }} />
        </div>
      </div>
    </nav>
  );
}

/** A row of the Shop preferences step: the field on the left, what it means on the right (like Etsy). */
function PrefRow({ id, label, value, onChange, options, help, error }) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b border-stone-100 py-5 last:border-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
      <Field id={id} label={label} error={error}>
        <select {...aria(id, error)} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls(error)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <p className="text-xs leading-relaxed text-stone-500 md:pt-7">{help}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="text-center">
      <h1 className="font-serif text-3xl tracking-[-0.02em] text-ink sm:text-4xl">{title}</h1>
      {subtitle && <p className="mx-auto mt-2 max-w-xl text-stone-600">{subtitle}</p>}
    </div>
  );
}

/**
 * The shop-opening wizard (/sell-on-sellpify): Shop preferences → Name your shop → Billing & ID → How you’ll get paid
 * → Review & submit. Each "Save and continue" checks the step (lib/seller-onboarding.js, same rules as the server)
 * and saves it, so the seller can leave and come back to the same place. Adding products comes after, in the dashboard.
 * @param {{ initial: { step: number, data: object }, uploads: 'blob' | 'local' | null, agreement: object, firstName: string }} props
 */
export default function OnboardingWizard({ initial, uploads, agreement, firstName }) {
  const [data, setData] = useState(initial.data);
  const [current, setCurrent] = useState(initial.step);
  const [furthest, setFurthest] = useState(initial.step);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(null);
  const [name, setName] = useState({ state: 'idle' }); // live shop name check: idle | checking | ok | taken
  const termsRef = useRef(null);
  const topRef = useRef(null);
  const step = ONBOARDING_STEPS[current].id;

  const set = (stepId, patch) => {
    setData((d) => ({ ...d, [stepId]: { ...d[stepId], ...patch } }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !Object.keys(patch).some((p) => k === p || k.startsWith(`${p}.`)))));
  };
  const setNested = (stepId, key, patch) => set(stepId, { [key]: { ...data[stepId][key], ...patch } });

  // Shop name: checked as you type (after a short pause) against every other shop.
  const storeName = data.identity.storeName.trim();
  useEffect(() => {
    if (step !== 'identity' || storeName.length < 3) return setName({ state: 'idle' });
    setName({ state: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/seller/onboarding/store-name?name=${encodeURIComponent(storeName)}`, { signal: controller.signal });
        const body = await res.json();
        setName(body.available ? { state: 'ok' } : { state: 'taken', error: body.error });
      } catch {
        if (!controller.signal.aborted) setName({ state: 'idle' });
      }
    }, 400);
    return () => (clearTimeout(timer), controller.abort());
  }, [storeName, step]);

  function go(index) {
    setCurrent(index);
    setErrors({});
    setFormError(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveAndContinue() {
    setFormError(null);
    const check = checkStep(step, data[step]);
    const found = check.ok ? {} : check.errors;
    if (step === 'identity' && name.state === 'taken') found.storeName = name.error;
    if (Object.keys(found).length) {
      setErrors(found);
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/seller/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data: data[step] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(body.fields ?? {});
        setFormError(body.error ?? 'Could not save. Please try again.');
        return;
      }
      setData(body.data);
      setFurthest(Math.max(furthest, body.step));
      go(Math.min(current + 1, ONBOARDING_STEPS.length - 1));
    } catch {
      setFormError('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setFormError(null);
    if (!agree) return setErrors({ agreeTerms: 'Please agree to the Seller Terms to open your shop.' });
    setSaving(true);
    try {
      const res = await fetch('/api/seller/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreeTerms: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A step that's no longer valid (e.g. the name was just taken): take the seller back to it.
        if (Number.isInteger(body.fields?.step)) {
          go(body.fields.step);
          setErrors(body.fields);
        }
        setFormError(body.error ?? 'Could not open your shop. Please try again.');
        return;
      }
      setDone(body);
    } catch {
      setFormError('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-100 text-brand-700">
          <PartyPopper size={30} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-serif text-4xl tracking-[-0.02em] text-ink">{done.storeName} is open!</h1>
        <p className="mt-3 text-stone-600">
          Add your first listing now. After your first sale we’ll ask you to verify your identity so we can pay you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {/* Full page loads: the header and menus pick up the new seller account. */}
          <a href="/seller/listings/new" className="btn btn-lg btn-primary">
            Add your first listing
          </a>
          <a href="/seller/dashboard" className="btn btn-lg btn-outline">
            Go to your dashboard
          </a>
        </div>
      </div>
    );
  }

  const p = data.preferences;
  const id = data.identity;
  const b = data.billing;
  const pay = data.payout;
  const wallet = WALLET_OPTIONS.find((w) => w.value === pay.walletProvider);

  return (
    <div ref={topRef} className="scroll-mt-6 pb-28">
      <Timeline current={current} furthest={furthest} onJump={(i) => i <= furthest && go(i)} />

      <div className="mt-10">
        {/* ---------- 1. Shop preferences ---------- */}
        {step === 'preferences' && (
          <>
            <SectionTitle
              title="Shop preferences"
              subtitle={`Let’s get started${firstName ? `, ${firstName}` : ''}! Tell us about you and your shop.`}
            />
            <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-stone-200 bg-white px-5 sm:px-8">
              <PrefRow
                id="country"
                label="Shop country"
                value={p.country}
                onChange={(v) => {
                  const c = countryOf(v);
                  set('preferences', { country: v, currency: CURRENCIES.some((x) => x.value === c?.currency) ? c.currency : p.currency });
                  if (!b.phone.number) setNested('billing', 'phone', { dial: c?.dial ?? b.phone.dial });
                }}
                options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
                error={errors.country}
                help="Where your shop is based. Don’t see your country? We may not be available there yet, but stay tuned."
              />
              <PrefRow
                id="currency"
                label="Shop currency"
                value={p.currency}
                onChange={(v) => set('preferences', { currency: v })}
                options={CURRENCIES}
                error={errors.currency}
                help="The currency for your shop. Listings on Sellpify are priced in US dollars for now; this is the currency we’ll use for you as more arrive."
              />
            </div>
          </>
        )}

        {/* ---------- 2. Name your shop ---------- */}
        {step === 'identity' && (
          <>
            <SectionTitle
              title="Name your shop"
              subtitle="Draw inspiration from what you sell, your style, pretty much anything goes. You can change it later."
            />
            <div className="mx-auto mt-8 max-w-2xl space-y-8">
              <div>
                <label htmlFor="storeName" className="sr-only">
                  Shop name
                </label>
                <div className="relative">
                  <input
                    {...aria('storeName', errors.storeName)}
                    value={id.storeName}
                    maxLength={60}
                    autoComplete="organization"
                    placeholder="Enter your shop name"
                    onChange={(e) => set('identity', { storeName: e.target.value })}
                    className={`${inputCls(errors.storeName || name.state === 'taken')} h-14 pr-12 text-lg`}
                  />
                  <span className="absolute right-4 top-[calc(50%+3px)] -translate-y-1/2">
                    {name.state === 'checking' && <Loader2 size={18} className="animate-spin text-stone-400" aria-hidden="true" />}
                    {name.state === 'ok' && <CheckCircle2 size={20} className="text-emerald-600" aria-hidden="true" />}
                    {name.state === 'taken' && <X size={20} className="text-red-600" aria-hidden="true" />}
                  </span>
                </div>
                <p
                  id="storeName-error"
                  className={`mt-2 text-sm ${errors.storeName || name.state === 'taken' ? 'font-medium text-red-600' : 'text-stone-500'}`}
                  aria-live="polite"
                >
                  {errors.storeName ??
                    (name.state === 'taken'
                      ? name.error
                      : name.state === 'ok'
                        ? `“${storeName}” is available.`
                        : "3–60 characters: letters, numbers, spaces and . & ' - only.")}
                </p>
              </div>

              <Field
                id="storeDescription"
                label="About your shop"
                optional
                error={errors.storeDescription}
                hint="A line or two buyers see on your shop. At least 20 characters if you add it now."
              >
                <textarea
                  {...aria('storeDescription', errors.storeDescription)}
                  rows={3}
                  maxLength={500}
                  value={id.storeDescription}
                  onChange={(e) => set('identity', { storeDescription: e.target.value })}
                  placeholder="Hand-drawn planners and printable wall art, made in Lahore."
                  className={`${inputCls(errors.storeDescription)} h-auto resize-y py-2.5 leading-relaxed`}
                />
              </Field>

              <div className="space-y-6 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                <p className="font-medium text-ink">Branding</p>
                <ImageUpload
                  id="logo"
                  label="Shop profile picture"
                  hint="Your shop’s logo or a photo of you. Square, at least 500 × 500 px."
                  kind="photo"
                  shape="logo"
                  value={id.logo}
                  onChange={(v) => set('identity', { logo: v })}
                  driver={uploads}
                  error={errors.logo}
                />
                <ImageUpload
                  id="banner"
                  label="Shop banner"
                  hint="The wide cover across the top of your shop. About 3360 × 840 px (4:1)."
                  kind="photo"
                  shape="banner"
                  value={id.banner}
                  onChange={(v) => set('identity', { banner: v })}
                  driver={uploads}
                  error={errors.banner}
                />
              </div>
            </div>
          </>
        )}

        {/* ---------- 3. Billing info ---------- */}
        {step === 'billing' && (
          <>
            <SectionTitle
              title="Share your billing info"
              subtitle="Your address and phone stay private. After your first sale we’ll also ask you to verify your identity (ID card and a quick selfie)."
            />
            <div className="mx-auto mt-8 max-w-3xl space-y-6">
              <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6" aria-labelledby="address-heading">
                <h2 id="address-heading" className="font-medium text-ink">
                  Address &amp; contact
                </h2>
                <p className="mt-0.5 text-sm text-stone-500">Country: {countryOf(p.country)?.name} (from your shop preferences)</p>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field id="address.line1" label="Street address" error={errors['address.line1']}>
                      <input
                        {...aria('address.line1', errors['address.line1'])}
                        autoComplete="address-line1"
                        maxLength={120}
                        value={b.address.line1}
                        onChange={(e) => setNested('billing', 'address', { line1: e.target.value })}
                        className={inputCls(errors['address.line1'])}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field id="address.line2" label="Apartment, suite, area" optional error={errors['address.line2']}>
                      <input
                        {...aria('address.line2', errors['address.line2'])}
                        autoComplete="address-line2"
                        maxLength={120}
                        value={b.address.line2}
                        onChange={(e) => setNested('billing', 'address', { line2: e.target.value })}
                        className={inputCls(errors['address.line2'])}
                      />
                    </Field>
                  </div>
                  <Field id="address.city" label="City" error={errors['address.city']}>
                    <input
                      {...aria('address.city', errors['address.city'])}
                      autoComplete="address-level2"
                      maxLength={60}
                      value={b.address.city}
                      onChange={(e) => setNested('billing', 'address', { city: e.target.value })}
                      className={inputCls(errors['address.city'])}
                    />
                  </Field>
                  <Field id="address.state" label="State / province" error={errors['address.state']}>
                    <input
                      {...aria('address.state', errors['address.state'])}
                      autoComplete="address-level1"
                      maxLength={60}
                      value={b.address.state}
                      onChange={(e) => setNested('billing', 'address', { state: e.target.value })}
                      className={inputCls(errors['address.state'])}
                    />
                  </Field>
                  <Field id="address.postalCode" label="Postal code" error={errors['address.postalCode']}>
                    <input
                      {...aria('address.postalCode', errors['address.postalCode'])}
                      autoComplete="postal-code"
                      maxLength={10}
                      value={b.address.postalCode}
                      onChange={(e) => setNested('billing', 'address', { postalCode: e.target.value })}
                      className={inputCls(errors['address.postalCode'])}
                    />
                  </Field>
                  <Field id="phone.number" label="Phone number" error={errors['phone.number'] ?? errors['phone.dial']}>
                    <div className="mt-1.5 flex">
                      <label htmlFor="phone.dial" className="sr-only">
                        Country code
                      </label>
                      <select
                        id="phone.dial"
                        value={b.phone.dial}
                        onChange={(e) => setNested('billing', 'phone', { dial: e.target.value })}
                        className="h-11 rounded-l-xl border border-r-0 border-stone-300 bg-stone-50 px-2.5 text-[15px] focus:border-ink focus:outline-none"
                      >
                        {DIAL_CODES.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <input
                        {...aria('phone.number', errors['phone.number'])}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        maxLength={18}
                        placeholder="300 1234567"
                        value={b.phone.number}
                        onChange={(e) => setNested('billing', 'phone', { number: e.target.value })}
                        className={`${inputCls(errors['phone.number'])} mt-0! rounded-l-none`}
                      />
                    </div>
                  </Field>
                </div>
              </section>

              {/* Shown for familiarity only: these inputs have no names, are never part of the form and never sent. */}
              <section
                className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
                aria-labelledby="card-heading"
                aria-describedby="card-free"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="card-heading" className="flex items-center gap-2 font-medium text-ink">
                    <CreditCard size={18} strokeWidth={1.75} aria-hidden="true" />
                    Credit card
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                    <Lock size={12} strokeWidth={2} aria-hidden="true" />
                    Not needed
                  </span>
                </div>
                <p id="card-free" className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  Sellpify is currently 100% free for sellers! No payment information required at this stage.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4 opacity-70 sm:grid-cols-2" aria-hidden="true">
                  {[
                    ['Card number', '•••• •••• •••• ••••', 'sm:col-span-2'],
                    ['Name on card', 'As shown on the card', 'sm:col-span-2'],
                    ['Expiry', 'MM / YY', ''],
                    ['CVC', '•••', ''],
                  ].map(([label, placeholder, span]) => (
                    <div key={label} className={span}>
                      <span className="text-sm font-medium text-stone-500">{label}</span>
                      <input disabled readOnly tabIndex={-1} placeholder={placeholder} className={inputCls()} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}

        {/* ---------- 4. How you'll get paid ---------- */}
        {step === 'payout' && (
          <>
            <SectionTitle
              title="How you’ll get paid"
              subtitle="Where we send your earnings. Optional for now: you can add or change it any time from Payouts & Bank Details."
            />
            <div className="mx-auto mt-8 max-w-3xl space-y-5">
              <fieldset>
                <legend className="sr-only">Payout method</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {[
                    { value: 'bank', label: 'Bank account', text: 'Straight to any bank in Pakistan, by IBAN or account number.', tags: ['IBAN', 'Account no.'], icon: Building2 },
                    { value: 'wallet', label: 'Mobile wallet or online service', text: 'Paid to the wallet or service you already use.', tags: WALLET_OPTIONS.map((w) => w.label), icon: Smartphone },
                    { value: 'later', label: 'Add it later', text: 'Open your shop now and add payout details before your first payout.', tags: ['Optional'], icon: Clock },
                  ].map(({ value, label, text, tags, icon: Icon }) => {
                    const on = pay.method === value;
                    return (
                      <label
                        key={value}
                        className={`relative flex min-h-44 cursor-pointer flex-col rounded-2xl border-2 bg-white p-5 transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40 sm:p-6 ${
                          on ? 'border-ink shadow-[0_10px_30px_-16px_rgba(20,20,20,0.45)]' : errors.method ? 'border-red-300' : 'border-stone-200 hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md'
                        }`}
                      >
                        <input type="radio" name="method" value={value} checked={on} onChange={() => set('payout', { method: value })} className="sr-only" />
                        <span className="flex items-start justify-between">
                          <span className={`grid size-12 place-items-center rounded-xl transition-colors ${on ? 'bg-ink text-white' : 'bg-brand-50 text-brand-700'}`}>
                            <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                          </span>
                          <span aria-hidden="true" className={`grid size-6 place-items-center rounded-full border-2 transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-stone-300'}`}>
                            {on && <Check size={14} strokeWidth={3} />}
                          </span>
                        </span>
                        <span className="mt-4 text-lg font-medium text-ink">{label}</span>
                        <span className="mt-1 text-sm text-stone-500">{text}</span>
                        <span className="mt-auto flex flex-wrap gap-1.5 pt-4">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                              {t}
                            </span>
                          ))}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errors.method && <p className="mt-2 text-sm font-medium text-red-600">{errors.method}</p>}
              </fieldset>

              {pay.method === 'bank' && (
                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
                  <h3 className="font-medium text-ink sm:col-span-2">Bank details</h3>
                  <div className="sm:col-span-2">
                    <Field id="accountTitle" label="Account holder name" error={errors.accountTitle} hint="Exactly as it appears on your bank account.">
                      <input
                        {...aria('accountTitle', errors.accountTitle)}
                        autoComplete="name"
                        maxLength={80}
                        value={pay.accountTitle}
                        onChange={(e) => set('payout', { accountTitle: e.target.value })}
                        className={inputCls(errors.accountTitle)}
                      />
                    </Field>
                  </div>
                  <Field id="bankName" label="Bank name" error={errors.bankName}>
                    <input
                      {...aria('bankName', errors.bankName)}
                      maxLength={80}
                      placeholder="e.g. HBL, Meezan Bank"
                      value={pay.bankName}
                      onChange={(e) => set('payout', { bankName: e.target.value })}
                      className={inputCls(errors.bankName)}
                    />
                  </Field>
                  <Field id="accountNumber" label="Account number / IBAN" error={errors.accountNumber}>
                    <input
                      {...aria('accountNumber', errors.accountNumber)}
                      maxLength={40}
                      placeholder="PK36SCBL0000001123456702"
                      value={pay.accountNumber}
                      onChange={(e) => set('payout', { accountNumber: e.target.value })}
                      className={`${inputCls(errors.accountNumber)} font-mono`}
                    />
                  </Field>
                </div>
              )}

              {pay.method === 'wallet' && (
                <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                  <fieldset id="walletProvider" aria-invalid={Boolean(errors.walletProvider) || undefined} aria-describedby={errors.walletProvider ? 'walletProvider-error' : undefined} tabIndex={-1} className="focus:outline-none">
                    <legend className="font-medium text-ink">Choose your provider</legend>
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {WALLET_OPTIONS.map((w) => {
                        const on = pay.walletProvider === w.value;
                        return (
                          <label
                            key={w.value}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500/40 ${
                              on ? 'border-ink bg-stone-50 shadow-sm' : errors.walletProvider ? 'border-red-300' : 'border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            <input
                              type="radio"
                              name="walletProvider"
                              value={w.value}
                              checked={on}
                              onChange={() => set('payout', { walletProvider: w.value, walletNumber: pay.walletProvider && wallet?.id === w.id ? pay.walletNumber : '' })}
                              className="sr-only"
                            />
                            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold ${WALLET_TILE[w.value] ?? 'bg-stone-100 text-stone-700'}`}>
                              {w.label.charAt(0)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">{w.label}</span>
                              <span className="block text-xs text-stone-500">{w.id === 'email' ? 'By email' : 'By mobile no.'}</span>
                            </span>
                            {on && (
                              <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-white">
                                <Check size={12} strokeWidth={3} />
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {errors.walletProvider && (
                      <p id="walletProvider-error" className="mt-2 text-sm font-medium text-red-600">
                        {errors.walletProvider}
                      </p>
                    )}
                  </fieldset>
                  {wallet && (
                    <Field id="walletNumber" label={`${wallet.label} ${walletIdLabel(pay.walletProvider).toLowerCase()}`} error={errors.walletNumber}>
                      <input
                        {...aria('walletNumber', errors.walletNumber)}
                        type={wallet.id === 'email' ? 'email' : 'tel'}
                        inputMode={wallet.id === 'email' ? 'email' : 'tel'}
                        maxLength={wallet.id === 'email' ? 254 : 15}
                        placeholder={wallet.id === 'email' ? 'you@example.com' : '03001234567'}
                        value={pay.walletNumber}
                        onChange={(e) => set('payout', { walletNumber: e.target.value })}
                        className={`${inputCls(errors.walletNumber)} block sm:max-w-sm`}
                      />
                    </Field>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ---------- 5. Review & submit ---------- */}
        {step === 'review' && (
          <>
            <SectionTitle
              title="Review & open your shop"
              subtitle="Check everything once more. You’ll add your first listing from your dashboard right after."
            />
            <div className="mx-auto mt-8 max-w-2xl space-y-3">
              {[
                ['Shop preferences', 0, [countryOf(p.country)?.name, p.currency].join(' · ')],
                ['Shop', 1, `${id.storeName}${id.logo ? ' · profile picture' : ''}${id.banner ? ' · banner' : ''}`],
                ['Billing info', 2, `${[b.address.city, countryOf(p.country)?.name].filter(Boolean).join(', ')} · ${b.phone.dial} ${b.phone.number}`],
                [
                  'Payouts',
                  3,
                  pay.method === 'later'
                    ? 'Not added yet: add it from Payouts & Bank Details before your first payout'
                    : pay.method === 'bank'
                    ? `${pay.bankName} · ending ${String(pay.accountNumber).slice(-4)}`
                    : `${wallet?.label ?? 'Wallet'} · ${wallet?.id === 'email' ? pay.walletNumber : `ending ${String(pay.walletNumber).slice(-4)}`}`,
                ],
              ].map(([title, index, summary]) => (
                <div key={title} className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{title}</p>
                    <p className="truncate text-sm text-stone-500">{summary}</p>
                  </div>
                  <button type="button" onClick={() => go(index)} className="btn btn-sm btn-outline shrink-0">
                    Edit
                  </button>
                </div>
              ))}

              <label
                className={`mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 ${errors.agreeTerms ? 'border-red-300' : 'border-stone-200'}`}
              >
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => (setAgree(e.target.checked), setErrors({}))}
                  aria-invalid={Boolean(errors.agreeTerms) || undefined}
                  className="mt-0.5 size-4 accent-ink"
                />
                <span className="text-sm text-stone-700">
                  I agree to Sellpify’s{' '}
                  <button
                    type="button"
                    onClick={(e) => (e.preventDefault(), termsRef.current?.showModal())}
                    className="font-medium text-ink underline underline-offset-2"
                  >
                    Seller Terms &amp; Conditions
                  </button>
                  .
                </span>
              </label>
              {errors.agreeTerms && <p className="text-sm font-medium text-red-600">{errors.agreeTerms}</p>}
            </div>
          </>
        )}
      </div>

      {formError && (
        <p role="alert" className="mx-auto mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      {/* ---------- Footer: Back · Save and continue ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          {current > 0 ? (
            <button type="button" onClick={() => go(current - 1)} disabled={saving} className="btn btn-md btn-outline">
              Back
            </button>
          ) : (
            <Link href="/" className="btn btn-md text-stone-600 hover:bg-stone-100">
              Exit
            </Link>
          )}
          <button type="button" onClick={step === 'review' ? submit : saveAndContinue} disabled={saving} className="btn btn-md btn-dark">
            {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : step === 'review' ? 'Open my shop' : 'Save and continue'}
          </button>
        </div>
      </div>

      {/* ---------- Seller Terms drawer ---------- */}
      <dialog
        ref={termsRef}
        aria-labelledby="terms-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-xl bg-white p-0 text-ink backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
            <h2 id="terms-title" className="font-serif text-2xl">
              {agreement.title}
            </h2>
            <button
              type="button"
              onClick={() => termsRef.current?.close()}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full hover:bg-stone-100"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-stone-700">
            {agreement.intro && <p>{agreement.intro}</p>}
            {agreement.sections.map((s) => (
              <section key={s.id} className="mt-5">
                <h3 className="font-medium text-ink">{s.heading}</h3>
                {s.body.map((part, i) =>
                  Array.isArray(part) ? (
                    <ul key={i} className="mt-2 list-disc space-y-1 pl-5">
                      {part.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i} className="mt-2">
                      {part}
                    </p>
                  ),
                )}
              </section>
            ))}
            <p className="mt-6">
              <Link href="/legal/seller-agreement" target="_blank" className="font-medium text-ink underline underline-offset-2">
                Open the full agreement in a new tab
              </Link>
            </p>
          </div>
          <div className="border-t border-stone-200 px-6 py-4">
            <button type="button" onClick={() => (setAgree(true), setErrors({}), termsRef.current?.close())} className="btn btn-md btn-dark w-full">
              I agree
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
