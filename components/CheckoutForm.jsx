'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice, NEUTRAL_BLUR_DATA_URL } from '@/lib/utils';
import { formatTaxRate } from '@/lib/pricing';

function Spinner() {
  return <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export default function CheckoutForm({ demoMode = false }) {
  const router = useRouter();
  const { items, totals, currency, hydrated, clearCart, syncCart, removeFromCart } = useCart();
  const { user } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | submitting | redirecting
  const [error, setError] = useState(null);
  const money = (cents) => formatPrice(cents, currency);

  async function onSubmit(event) {
    event.preventDefault();
    if (status !== 'idle') return; // double-submit guard
    setError(null);
    setStatus('submitting');

    const email = new FormData(event.currentTarget).get('email');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, items: items.map((i) => ({ _id: i._id })), expectedTotal: totals.total }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 201) {
        setStatus('redirecting');
        clearCart();
        router.replace(data.receiptUrl);
        return;
      }

      if (data.code === 'price_changed') syncCart(data.details.items);
      if (data.code === 'items_unavailable') data.details.missing.forEach(removeFromCart);
      setError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setError('Network error — check your connection and try again.');
    }
    setStatus('idle');
  }

  if (status === 'redirecting') {
    return (
      <div className="grid min-h-[40vh] place-items-center text-center" role="status">
        <div>
          <span className="mx-auto block size-10 animate-spin rounded-full border-4 border-stone-200 border-t-brand-600" />
          <p className="mt-4 font-medium">Order confirmed — preparing your downloads…</p>
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

  const payLabel = totals.total === 0 ? 'Get my free downloads' : `Pay ${money(totals.total)}`;

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
            Logged in as {user.name} — this purchase will be saved to your account.
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

        <h2 className="headline mt-10 text-2xl">Payment</h2>
        {demoMode ? (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Demo mode:</strong> no payment is taken. Orders complete instantly so you can test delivery.
          </p>
        ) : (
          <p className="mt-2 text-sm text-stone-500">
            {totals.total === 0 ? 'Nothing to pay — these items are free.' : 'Card payments are coming soon.'}
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
        </dl>
      </aside>
    </div>
  );
}
