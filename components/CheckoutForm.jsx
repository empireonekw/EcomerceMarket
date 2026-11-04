'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { chargeAmount, formatPkr, formatTaxRate } from '@/lib/pricing';
import { CreditCard, Landmark, QrCode, Smartphone } from 'lucide-react';
import { PENDING_ORDER_KEY } from '@/components/PaymentStatusHelpers';

/** A policy linked under the pay button (opens in a new tab so the buyer doesn't leave checkout). */
function PolicyLink({ href, children }) {
  return (
    <Link href={href} target="_blank" className="underline underline-offset-2 hover:text-ink">
      {children}
    </Link>
  );
}

// What PayFast's page offers (the methods enabled on the merchant account).
const METHODS = [
  { icon: CreditCard, label: 'Visa, Mastercard, UnionPay, PayPak' },
  { icon: Smartphone, label: 'JazzCash' },
  { icon: Smartphone, label: 'Easypaisa' },
  { icon: Landmark, label: 'Bank account' },
  { icon: QrCode, label: 'Raast' },
];

/** Hands the buyer to PayFast: a real form POST, so PayFast receives the fields exactly as the server signed them. */
function submitToPayFast({ action, fields }) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}

function Spinner() {
  return <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export default function CheckoutForm({ demoMode = false, paymentsEnabled = false }) {
  const router = useRouter();
  const { items, totals, currency, hydrated, clearCart, syncCart, removeFromCart } = useCart();
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | submitting | redirecting | paying
  const [error, setError] = useState(null);
  const [phoneError, setPhoneError] = useState(null);
  const money = (cents) => formatPrice(cents, currency);
  // Paid orders go through PayFast (charged in rupees) unless this is a local demo.
  const viaPayFast = paymentsEnabled && !demoMode && totals.total > 0;
  const charge = chargeAmount(totals.total, currency);

  async function onSubmit(event) {
    event.preventDefault();
    if (status !== 'idle') return; // double-submit guard
    setError(null);
    setStatus('submitting');

    setPhoneError(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.get('email'),
          phone: form.get('phone') ?? undefined,
          items: items.map((i) => ({ _id: i._id })),
          expectedTotal: totals.total,
        }),
      });
      const data = await res.json().catch(() => ({}));

      // Pending: pay on PayFast. The cart stays until the payment is confirmed (the receipt clears it).
      if (res.status === 202 && data.payment) {
        setStatus('paying');
        try {
          sessionStorage.setItem(PENDING_ORDER_KEY, data.orderId);
        } catch {}
        submitToPayFast(data.payment);
        return;
      }

      if (res.status === 201) {
        setStatus('redirecting');
        clearCart();
        router.replace(data.receiptUrl);
        return;
      }

      if (data.details?.phone) setPhoneError(data.details.phone);
      if (data.code === 'price_changed') syncCart(data.details.items);
      if (data.code === 'items_unavailable') data.details.missing.forEach(removeFromCart);
      setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Network error. Check your connection and try again.');
    }
    setStatus('idle');
  }

  if (status === 'paying') {
    return (
      <div className="grid min-h-[40vh] place-items-center text-center" role="status">
        <div>
          <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
          <p className="mt-4 font-medium">Taking you to PayFast to pay {formatPkr(charge.paisa)}…</p>
          <p className="mt-1 text-sm text-stone-500">Choose a card, JazzCash, Easypaisa, your bank or Raast there.</p>
        </div>
      </div>
    );
  }

  if (status === 'redirecting') {
    return (
      <div className="grid min-h-[40vh] place-items-center text-center" role="status">
        <div>
          <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
          <p className="mt-4 font-medium">Order confirmed, preparing your downloads…</p>
        </div>
      </div>
    );
  }

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-2xl bg-stone-200" aria-busy="true" aria-label="Loading cart" />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
        <p className="font-medium">Your cart is empty.</p>
        <Link href="/products" className="btn btn-md btn-dark mt-6">
          Browse products
        </Link>
      </div>
    );
  }

  const payLabel = totals.total === 0 ? 'Get my free downloads' : viaPayFast ? `Pay ${formatPkr(charge.paisa)}` : `Pay ${money(totals.total)}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
      {/* ---------- Details ---------- */}
      <form onSubmit={onSubmit} className="order-2 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 lg:order-1" noValidate={false}>
        <h2 className="headline text-2xl">Contact</h2>
        {user ? (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m5 12 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logged in as {user.name}. This purchase will be saved to your account.
          </p>
        ) : (
          <p className="mt-1 text-sm text-stone-500">
            Your receipt and download links are tied to this email.{' '}
            <Link href="/login?next=/checkout" className="font-medium text-ink underline-offset-2 hover:underline">
              Log in
            </Link>{' '}
            to keep purchases in your account.
          </p>
        )}

        <label htmlFor="email" className="mt-5 block text-sm font-medium">
          Email address
        </label>
        <input
          key={user?.email ?? 'guest'} // remount with the account email once auth resolves
          defaultValue={user?.email}
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          aria-describedby={error ? 'checkout-error' : undefined}
          className="mt-1.5 h-12 w-full rounded-xl border border-stone-300 px-4 focus:border-black focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />

        {viaPayFast && (
          <>
            <label htmlFor="phone" className="mt-5 block text-sm font-medium">
              Mobile number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              maxLength={16}
              autoComplete="tel"
              inputMode="tel"
              placeholder="0300 1234567"
              aria-invalid={Boolean(phoneError) || undefined}
              aria-describedby="phone-hint"
              onChange={() => setPhoneError(null)}
              className={`mt-1.5 h-12 w-full rounded-xl border px-4 focus:border-black focus:outline-none focus:ring-2 focus:ring-brand-500/20 ${phoneError ? 'border-red-400' : 'border-stone-300'}`}
            />
            <p id="phone-hint" className={`mt-1.5 text-xs ${phoneError ? 'text-red-600' : 'text-stone-500'}`}>
              {phoneError || 'For your JazzCash / Easypaisa wallet or the bank’s one-time code.'}
            </p>
          </>
        )}

        <h2 className="headline mt-10 text-2xl">Payment</h2>
        {demoMode ? (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Demo mode:</strong> no payment is taken. Orders complete instantly so you can test delivery.
          </p>
        ) : viaPayFast ? (
          <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <p className="text-sm text-stone-600">
              You’ll pay securely on <span className="font-medium text-ink">PayFast</span>, a payment gateway licensed by the State
              Bank of Pakistan. Pay with:
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {METHODS.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-stone-700 ring-1 ring-stone-200">
                  <Icon size={14} strokeWidth={1.75} aria-hidden="true" className="text-stone-500" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">
            {totals.total === 0 ? 'Nothing to pay, these items are free.' : 'Online payments are being set up. Please check back soon.'}
          </p>
        )}

        {error && (
          <p id="checkout-error" role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn btn-lg btn-primary mt-6 w-full"
        >
          {status === 'submitting' ? (
            <>
              <Spinner /> Processing…
            </>
          ) : (
            payLabel
          )}
        </button>
        <p className="mt-3 text-center text-xs text-stone-500">Instant delivery · Secure checkout · Lifetime access</p>
        {/* What payment providers look for at checkout: the policies that apply, linked before the buyer pays. */}
        <p className="mt-3 text-center text-xs leading-relaxed text-stone-500">
          By placing your order you agree to our <PolicyLink href="/terms">Terms of Service</PolicyLink> and{' '}
          <PolicyLink href="/privacy">Privacy Policy</PolicyLink>, and to our <PolicyLink href="/legal/payment-policy">Payment</PolicyLink>,{' '}
          <PolicyLink href="/legal/delivery-policy">Delivery</PolicyLink> and <PolicyLink href="/legal/refund-policy">Refund</PolicyLink> policies.
        </p>
      </form>

      {/* ---------- Summary ---------- */}
      <aside className="order-1 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 lg:sticky lg:top-24 lg:order-2" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="headline text-2xl">
          Order summary
        </h2>
        <ul className="mt-4 divide-y divide-stone-100">
          {items.map((item) => (
            <li key={item._id} className="flex items-center gap-3 py-3">
              <div className="relative aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                {item.coverImage && (
                  <Image src={item.coverImage} alt="" fill sizes="64px" placeholder="blur" blurDataURL={NEUTRAL_BLUR_DATA_URL} className="object-cover" />
                )}
              </div>
              <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">{item.title}</p>
              <span className="text-sm font-medium">{item.price === 0 ? 'Free' : money(item.price)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm">
          {/* Fee and tax lines only when they add something; otherwise the total says it all. */}
          {(totals.fee > 0 || totals.tax > 0) && (
            <>
              <div className="flex justify-between text-stone-600">
                <dt>Subtotal</dt>
                <dd className="font-medium text-ink">{money(totals.subtotal)}</dd>
              </div>
              {totals.fee > 0 && (
                <div className="flex justify-between text-stone-600">
                  <dt>Service fee</dt>
                  <dd className="font-medium text-ink">{money(totals.fee)}</dd>
                </div>
              )}
              {totals.tax > 0 && (
                <div className="flex justify-between text-stone-600">
                  <dt>Tax ({formatTaxRate()})</dt>
                  <dd className="font-medium text-ink">{money(totals.tax)}</dd>
                </div>
              )}
            </>
          )}
          <div className={`flex justify-between text-base font-medium ${totals.fee > 0 || totals.tax > 0 ? 'border-t border-stone-200 pt-3' : ''}`}>
            <dt>Total</dt>
            <dd>{money(totals.total)}</dd>
          </div>
          {viaPayFast && charge.rate !== 1 && (
            <div className="rounded-xl bg-brand-50 px-3.5 py-3">
              <div className="flex justify-between text-base font-semibold text-ink">
                <dt>You pay</dt>
                <dd>{formatPkr(charge.paisa)}</dd>
              </div>
              <p className="mt-1 text-xs text-stone-600">Charged in Pakistani rupees at $1 = Rs {charge.rate}.</p>
            </div>
          )}
        </dl>
      </aside>
    </div>
  );
}
