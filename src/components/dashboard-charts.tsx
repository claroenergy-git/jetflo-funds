import { inr } from "@/lib/format";

// Series colors matching dark obsidian & golden amber theme from reference image
export const C_CAPEX = "#10B981"; // Radiant Emerald
export const C_RM = "#F5A623";    // Glowing Warm Amber

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
      <div className="flex h-36 items-center justify-center text-xs text-[#8E9CA6]">
        No payment records found for this period.
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly payments">
      <defs>
        <linearGradient id="barGlow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.25" />
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
                fill="url(#barGlow)"
              />
            )}
            {d.value > 0 && (
              <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#F3F5F7">
                {inr(d.value, { compact: true }).replace("₹", "")}
              </text>
            )}
            <text x={i * step + step / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#8E9CA6">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1="0" y1={H - padB} x2={W} y2={H - padB} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
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
    return <div className="text-xs text-[#8E9CA6]">No data available.</div>;
  }
  return (
    <div className="space-y-3.5">
      {data.map((d) => (
        <div key={d.label} title={`${d.label}: ${inr(d.value)}`} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-slate-200">{d.label}</span>
            <span className="whitespace-nowrap tabular-nums text-amber-300 font-bold">
              {inr(d.value, { compact: true })}
              {total ? ` (${Math.round((d.value / total) * 100)}%)` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
            <div
              className="h-2 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(245,166,35,0.4)]"
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
    default: "bento-card",
    amber: "bento-card bento-card-amber",
    emerald: "bento-card bento-card-emerald",
  };

  return (
    <div className={`${variantStyles[variant]} p-5 relative overflow-hidden group`}>
      {/* Accent Top Line with Glow */}
      {accent && (
        <div
          className="absolute top-0 left-0 h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      )}
      <div className="text-[11px] font-bold uppercase tracking-wider text-[#8E9CA6] flex items-center justify-between">
        <span>{label}</span>
        {accent && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />}
      </div>
      <div className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-[#8E9CA6] font-medium">{sub}</div>}
    </div>
  );
}
