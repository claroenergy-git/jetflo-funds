import { inr } from "@/lib/format";

// Soothing Sage Green & Warm Amber series colors for Light Green/Beige Theme
export const C_CAPEX = "#1e3e30"; // Deep Forest/Sage Green
export const C_RM = "#d97706";    // Warm Amber

/** Monthly vertical bar chart (single series), SSR SVG */
export function MonthlyBars({
  data,
  color,
}: {
  data: { label: string; value: number }[];
  color: string;
}) {
  const W = 640;
  const H = 200;
  const padB = 24;
  const padT = 18;
  const max = Math.max(...data.map((d) => d.value), 1);
  const bw = Math.min(48, (W / (data.length || 1)) * 0.55);
  const step = W / (data.length || 1);

  if (data.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center text-xs text-[#536658]">
        No payment records found for this period.
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly payments">
      <defs>
        <linearGradient id="barGlowLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const h = Math.max(((H - padB - padT) * d.value) / max, d.value > 0 ? 4 : 0);
        const x = i * step + (step - bw) / 2;
        const y = H - padB - h;
        return (
          <g key={d.label}>
            <title>{`${d.label}: ${inr(d.value)}`}</title>
            {d.value > 0 && (
              <path
                d={`M${x},${y + h} L${x},${y + 4} Q${x},${y} ${x + 4},${y} L${x + bw - 4},${y} Q${x + bw},${y} ${x + bw},${y + 4} L${x + bw},${y + h} Z`}
                fill="url(#barGlowLight)"
              />
            )}
            {d.value > 0 && (
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#14261c">
                {inr(d.value, { compact: true }).replace("₹", "")}
              </text>
            )}
            <text x={i * step + step / 2} y={H - 8} textAnchor="middle" fontSize="11" fontWeight="600" fill="#536658">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1="0" y1={H - padB} x2={W} y2={H - padB} stroke="#e5decb" strokeWidth="1" />
    </svg>
  );
}

/** Horizontal bar list with direct labels */
export function HBarList({
  data,
  color,
  total,
}: {
  data: { label: string; value: number }[];
  color: string;
  total?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  if (data.length === 0) {
    return <div className="text-xs text-[#536658]">No data available.</div>;
  }
  return (
    <div className="space-y-3.5">
      {data.map((d) => (
        <div key={d.label} title={`${d.label}: ${inr(d.value)}`} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-bold text-[#14261c]">{d.label}</span>
            <span className="whitespace-nowrap tabular-nums text-[#1e3e30] font-extrabold">
              {inr(d.value, { compact: true })}
              {total ? ` (${Math.round((d.value / total) * 100)}%)` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#f0ebd9] overflow-hidden border border-[#e5decb]">
            <div
              className="h-2 rounded-full transition-all duration-500 shadow-2xs"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  accent,
  variant = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  variant?: "default" | "amber" | "emerald";
}) {
  const variantStyles = {
    default: "bento-card bg-white",
    amber: "bento-card bento-card-amber",
    emerald: "bento-card bento-card-emerald",
  };

  return (
    <div className={`${variantStyles[variant]} p-5 relative overflow-hidden group shadow-xs`}>
      {accent && (
        <div
          className="absolute top-0 left-0 h-[3px] w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#415546] flex items-center justify-between">
        <span>{label}</span>
        {accent && <span className="h-2 w-2 rounded-full" style={{ background: accent }} />}
      </div>
      <div className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14261c]">{value}</div>
      {sub && <div className="mt-1 text-xs text-[#536658] font-semibold">{sub}</div>}
    </div>
  );
}
