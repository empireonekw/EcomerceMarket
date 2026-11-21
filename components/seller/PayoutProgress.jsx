import { CheckCircle2, Lock, TrendingUp } from 'lucide-react';
import RequestPayoutButton from '@/components/seller/RequestPayoutButton';
import { MIN_PAYOUT, PAYOUT_FEE_LABEL, payoutFee } from '@/lib/commission';
import { formatDateTime } from '@/components/dashboard/ui';
import { formatPrice } from '@/lib/utils';

const usd = (cents) => formatPrice(cents, 'USD');
const AMBER = '#f59e0b';
const EMERALD = '#10b981';

/**
 * What still stops a payout request once the $50 minimum is reached (same order as the server's requestPayout()):
 * an open request, identity, payout details. `verification` is the status string ('pending' | 'verified' | …).
 */
export function payoutBlocker({ openRequest, verification, hasPayoutMethod }) {
  if (openRequest) {
    const { fee, net } = payoutFee(openRequest.amount);
    return `Request for ${usd(openRequest.amount)} sent ${formatDateTime(openRequest.createdAt).date}, awaiting payment. You’ll receive ${usd(net)} after the ${usd(fee)} merchant fee.`;
  }
  if (verification === 'pending') return 'We’re checking your identity. You can request a payout once it’s verified.';
  if (verification !== 'verified') return 'Verify your identity first (Payouts & Bank Details).';
  if (!hasPayoutMethod) return 'Add your bank or wallet details on Payouts & Bank Details first.';
  return null;
}

/** Small ring towards $50 with the percentage inside. */
function Ring({ percent, color }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 48 48" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * c} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums text-ink">{percent}%</span>
    </div>
  );
}

/**
 * The balance over the last 30 days against a dashed $50 line. Fills whatever height its parent gives it (the SVG
 * stretches, strokes stay 2px), so the card has no empty space when it sits next to a taller widget; the labels are
 * HTML so they never stretch with it.
 */
function Sparkline({ trend, color }) {
  const values = trend.balance;
  const max = Math.max(MIN_PAYOUT * 1.25, ...values);
  const x = (i) => (values.length > 1 ? (i / (values.length - 1)) * 100 : 0);
  const y = (v) => 8 + 88 * (1 - v / max); // 8% headroom for the end dot, 4% at the bottom
  // Smooth curve: each segment bends at its horizontal midpoint, so it never overshoots the real values.
  const pts = values.map((v, i) => [x(i), y(v)]);
  const curve = pts
    .map(([px, py], i) => {
      if (i === 0) return `M${px},${py.toFixed(2)}`;
      const [qx, qy] = pts[i - 1];
      const mx = ((qx + px) / 2).toFixed(2);
      return `C${mx},${qy.toFixed(2)} ${mx},${py.toFixed(2)} ${px},${py.toFixed(2)}`;
    })
    .join(' ');
  const target = y(MIN_PAYOUT);
  const end = y(values.at(-1));
  const id = color === EMERALD ? 'payout-spark-ok' : 'payout-spark-locked';

  return (
    <div className="absolute inset-0" role="img" aria-label={`Balance over the last ${values.length} days, now ${usd(values.at(-1))}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2="100" y1={target} y2={target} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={`${curve} L100,100 L0,100 Z`} fill={`url(#${id})`} />
        <path d={curve} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span
        aria-hidden="true"
        className="absolute left-0 -translate-y-full pb-0.5 text-[10px] leading-none text-slate-500"
        style={{ top: `${target}%` }}
      >
        {usd(MIN_PAYOUT)}
      </span>
      <span
        aria-hidden="true"
        className="absolute right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white"
        style={{ top: `${end}%`, borderColor: color }}
      />
    </div>
  );
}

/**
 * The $50 payout threshold card (lib/commission.js MIN_PAYOUT), on the seller dashboard and the Payouts page. Compact:
 * ring + balance "$X / $50" + Locked/Unlocked badge in one row, a thin progress bar, the 30-day balance sparkline
 * (it grows into any spare height, so the card fits beside taller widgets in a grid), and either how much is left or
 * the Request payout button (with what still stops it). `trend` comes from lib/data/seller-analytics.js getBalanceTrend.
 */
export default function PayoutProgress({ balance, trend, openRequest = null, verification = null, hasPayoutMethod = false, className = '' }) {
  const unlocked = balance >= MIN_PAYOUT;
  const percent = Math.min(100, Math.round((Math.max(0, balance) / MIN_PAYOUT) * 100));
  const color = unlocked ? EMERALD : AMBER;
  const blocker = unlocked ? payoutBlocker({ openRequest, verification, hasPayoutMethod }) : null;
  const gained = trend ? trend.balance.at(-1) - trend.balance[0] : 0;

  return (
    <section aria-labelledby="payout-threshold" className={`flex h-auto w-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-3">
        <Ring percent={percent} color={color} />
        <div className="min-w-0 flex-1">
          <h2 id="payout-threshold" className="text-xs font-medium text-stone-500">
            Payout threshold
          </h2>
          <p className="flex flex-wrap items-baseline gap-x-1">
            <span className="text-xl font-semibold tabular-nums tracking-tight text-ink">{usd(balance)}</span>
            <span className="text-sm tabular-nums text-stone-500">/ {usd(MIN_PAYOUT)}</span>
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
            unlocked ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'
          }`}
        >
          {unlocked ? <CheckCircle2 size={12} strokeWidth={2.25} aria-hidden="true" /> : <Lock size={11} strokeWidth={2.25} aria-hidden="true" />}
          {unlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>

      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label="Progress to the payout minimum"
        aria-valuemin={0}
        aria-valuemax={MIN_PAYOUT / 100}
        aria-valuenow={Math.min(balance, MIN_PAYOUT) / 100}
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] duration-700 ease-out ${unlocked ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {trend && (
        <>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-stone-500">Last {trend.days.length} days</span>
            {gained > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium tabular-nums text-emerald-700">
                <TrendingUp size={13} strokeWidth={2} aria-hidden="true" />+{usd(gained)}
              </span>
            ) : (
              <span className="text-stone-400">No change</span>
            )}
          </div>
          <div className="relative mt-2 min-h-14 flex-1">
            <Sparkline trend={trend} color={color} />
          </div>
        </>
      )}

      {unlocked ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          {!blocker && (
            <p className="text-xs text-stone-500">
              Your {usd(balance)} is ready to withdraw. After the {PAYOUT_FEE_LABEL} merchant fee ({usd(payoutFee(balance).fee)}) you receive{' '}
              <span className="font-semibold tabular-nums text-ink">{usd(payoutFee(balance).net)}</span>.
            </p>
          )}
          <RequestPayoutButton disabled={Boolean(blocker)} reason={blocker} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-stone-500">
          <span className="font-semibold tabular-nums text-ink">{usd(MIN_PAYOUT - Math.max(0, balance))}</span> more in sales unlocks your first
          payout.
        </p>
      )}
    </section>
  );
}
