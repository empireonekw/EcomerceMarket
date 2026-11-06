// Small SVG charts for the Listing stats page (server-rendered, no chart library).

const W = 600;

/** Nice upper bound for the y-axis: at least 5, rounded up so gridlines land on whole numbers. */
function axisMax(values) {
  const max = Math.max(5, ...values);
  const step = Math.ceil(max / 5);
  return step * 5;
}

const shortDay = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase();

/**
 * Line chart over days. `series` = [{ values, color, label, area? }]; `days` = ["2026-10-08", …].
 * `compact`: no gridline numbers, only the first date (the small metric cards). `right` puts a 2nd axis on the right
 * for the second series (Visits vs Orders).
 */
export default function StatsChart({ series, days, height = 220, compact = false, dualAxis = false, format = (v) => v }) {
  const pad = { top: 12, right: dualAxis ? 34 : 12, bottom: 26, left: compact ? 8 : 34 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxes = series.map((s, i) => (dualAxis || i === 0 ? axisMax(s.values) : axisMax(series[0].values)));
  const x = (i) => pad.left + (days.length > 1 ? (i / (days.length - 1)) * innerW : innerW / 2);
  const y = (v, max) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, 1, 2, 3, 4, 5];
  const labelDays = compact ? [0] : [0, Math.floor((days.length - 1) / 2), days.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={series.map((s) => `${s.label}: ${s.values.reduce((a, b) => a + b, 0)}`).join(', ')}>
      {ticks.map((t) => {
        const yy = pad.top + innerH - (t / 5) * innerH;
        return (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={yy} y2={yy} stroke="#e7e5e4" strokeWidth="1" />
            {!compact && (
              <text x={pad.left - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#78716c">
                {format((maxes[0] / 5) * t)}
              </text>
            )}
            {dualAxis && series[1] && (
              <text x={W - pad.right + 8} y={yy + 4} fontSize="11" fill={series[1].color}>
                {(maxes[1] / 5) * t}
              </text>
            )}
          </g>
        );
      })}
      {series.map((s, si) => {
        const max = maxes[si];
        const points = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v, max).toFixed(1)}`).join(' ');
        return (
          <g key={s.label}>
            {s.area && <polygon points={`${x(0)},${pad.top + innerH} ${points} ${x(s.values.length - 1)},${pad.top + innerH}`} fill={s.color} opacity="0.18" />}
            <polyline points={points} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      })}
      {labelDays.map((i) => (
        <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} fontSize="11" fill="#78716c">
          {shortDay(days[i])}
        </text>
      ))}
    </svg>
  );
}

/** Donut of visit counts: [{ label, value, color }]; the total in the middle. */
export function Donut({ items, label = 'Total visits' }) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative mx-auto size-48 shrink-0">
      <svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#f5f5f4" strokeWidth="18" />
        {total > 0 &&
          items.map((it) => {
            const len = (it.value / total) * c;
            const el = <circle key={it.label} cx="90" cy="90" r={r} fill="none" stroke={it.color} strokeWidth="18" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{total}</p>
      </div>
    </div>
  );
}
