import { Check } from 'lucide-react';

const STEPS = ['Account', 'Shop details'];

/** Two-step progress for becoming a seller: 1 · Account (/sell/signup) → 2 · Shop details (/seller/onboarding). */
export default function SellerSteps({ current }) {
  return (
    <ol aria-label="Seller setup progress" className="flex items-center gap-3 text-sm">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden="true" className={`h-px w-8 ${done || active ? 'bg-brand-500' : 'bg-stone-300'}`} />}
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`grid size-6 place-items-center rounded-full text-xs font-medium ${
                  done ? 'bg-brand-500 text-ink' : active ? 'bg-black text-white' : 'bg-stone-200 text-stone-500'
                }`}
              >
                {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={active ? 'font-medium text-black' : 'text-stone-500'}>
                {label}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
