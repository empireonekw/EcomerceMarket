import { CheckCircle2, Lock, TrendingUp } from 'lucide-react';
import RequestPayoutButton from '@/components/seller/RequestPayoutButton';
import { MIN_PAYOUT } from '@/lib/commission';
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
  if (openRequest) return `Request for ${usd(openRequest.amount)} sent ${formatDateTime(openRequest.createdAt).date}, awaiting payment.`;
  if (verification === 'pending') return 'We’re checking your identity. You can request a payout once it’s verified.';
  if (verification !== 'verified') return 'Verify your identity first (Payouts & Bank Details).';
  if (!hasPayoutMethod) return 'Add your bank or wallet details on Payouts & Bank Details first.';
  return null;
}

/** Ring gauge: how far the balance is towards $50, the percentage in the middle. */
function Gauge({ percent, color, balance }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * c} ${c}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{percent}%</p>
        <p className="text-xs text-stone-500">of {usd(MIN_PAYOUT)}</p>
      </div>
    </div>
  );
}

/** Area chart of the balance over the last 30 days with a dashed $50 target line. */
function TrendChart({ trend, color }) {
  const W = 320;
  const H = 120;
  const pad = { top: 14, bottom: 18, left: 2, right: 2 };
  const values = trend.balance;
  const max = Math.max(MIN_PAYOUT * 1.25, ...values);
  const x = (i) => pad.left + (values.length > 1 ? (i / (values.length - 1)) * (W - pad.left - pad.right) : 0);
  const y = (v) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);
  // Smooth curve: each segment bends at its horizontal midpoint, so it never overshoots the real values.
  const pts = values.map((v, i) => [x(i), y(v)]);
  const curve = pts
    .map(([px, py], i) => {
      if (i === 0) return `M${px.toFixed(1)},${py.toFixed(1)}`;
      const [qx, qy] = pts[i - 1];
      const mx = ((qx + px) / 2).toFixed(1);
      return `C${mx},${qy.toFixed(1)} ${mx},${py.toFixed(1)} ${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(' ');
  const base = H - pad.bottom;
  const target = y(MIN_PAYOUT);
  const short = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const id = color === EMERALD ? 'payout-fill-ok' : 'payout-fill-locked';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Balance over the last ${values.length} days, now ${usd(values.at(-1))}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* $50 target */}
      <line x1={pad.left} x2={W - pad.right} y1={target} y2={target} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
      <text x={pad.left} y={target - 5} fontSize="10" fill="#64748b">
        {usd(MIN_PAYOUT)} target
      </text>
      <path d={`${curve} L${x(values.length - 1)},${base} L${x(0)},${base} Z`} fill={`url(#${id})`} />
      <path d={curve} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1))} r="3.5" fill="white" stroke={color} strokeWidth="2" />
      <text x={pad.left} y={H - 4} fontSize="10" fill="#94a3b8">
        {short(trend.days[0])}
      </text>
      <text x={W - pad.right} y={H - 4} textAnchor="end" fontSize="10" fill="#94a3b8">
        Today
      </text>
    </svg>
  );
}

/**
 * The $50 payout threshold card (lib/commission.js MIN_PAYOUT), on the seller dashboard and the Payouts page: a ring
 * gauge towards $50, the balance's last-30-days chart against the $50 target line, and the status. Locked (under $50):
 * amber, "$X / $50 to unlock your first payout" and how much is left. Unlocked: emerald, "Threshold unlocked!" and the
 * Request payout button (or what still stops it). `trend` comes from lib/data/seller-analytics.js getBalanceTrend.
 */
export default function PayoutProgress({ balance, trend, openRequest = null, verification = null, hasPayoutMethod = false, className = '' }) {
  const unlocked = balance >= MIN_PAYOUT;
  const percent = Math.min(100, Math.round((Math.max(0, balance) / MIN_PAYOUT) * 100));
  const color = unlocked ? EMERALD : AMBER;
  const blocker = unlocked ? payoutBlocker({ openRequest, verification, hasPayoutMethod }) : null;
  const gained = trend ? trend.balance.at(-1) - trend.balance[0] : 0;

  return (
    <section aria-labelledby="payout-threshold" className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-[14rem] flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${unlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
          >
            {unlocked ? <CheckCircle2 size={20} strokeWidth={1.9} /> : <Lock size={18} strokeWidth={1.9} />}
          </span>
          <div>
            <h2 id="payout-threshold" className="text-[15px] font-semibold text-ink">
              Payout threshold
            </h2>
            <p className="text-sm text-stone-500">Minimum {usd(MIN_PAYOUT)} to request a payout</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            unlocked ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/15'
          }`}
        >
          {unlocked ? 'Threshold unlocked!' : 'Locked'}
        </span>
      </div>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex justify-center">
          <Gauge percent={percent} color={color} balance={balance} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink">{usd(balance)}</span>
              <span className="text-sm text-stone-500">/ {usd(MIN_PAYOUT)}</span>
            </p>
            {trend && gained > 0 && (
              <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
                <TrendingUp size={14} strokeWidth={2} aria-hidden="true" />+{usd(gained)} in {trend.days.length} days
              </p>
            )}
          </div>
          <p className="text-xs text-stone-500">Pending balance · last {trend?.days.length ?? 30} days</p>
          {trend && (
            <div className="mt-2">
              <TrendChart trend={trend} color={color} />
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"
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

      {unlocked ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            {blocker ? 'You’ve reached the minimum.' : `Your balance of ${usd(balance)} is ready to withdraw.`}
          </p>
          <RequestPayoutButton disabled={Boolean(blocker)} reason={blocker} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-stone-600">
          You need <span className="font-semibold tabular-nums text-ink">{usd(MIN_PAYOUT - Math.max(0, balance))}</span> more in sales to request
          your first payout. Once it’s unlocked, request it here in one click.
        </p>
      )}
    </section>
  );
}
