import { STATUS_LABEL, STATUS_STYLE, type Status } from "@/lib/types";

export function Card({
  children,
  className = "",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "amber" | "emerald" | "elevated";
}) {
  const variantStyles = {
    default: "bento-card",
    amber: "bento-card bento-card-amber",
    emerald: "bento-card bento-card-emerald",
    elevated: "bento-card shadow-2xl bg-[#12151B]/95",
  };

  return (
    <div className={`${variantStyles[variant]} p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function StatusChip({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide shadow-2xs ${STATUS_STYLE[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PageTitle({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {sub && <p className="mt-1 text-sm text-[#8E9CA6]">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#12151B]/80 px-3.5 py-2.5 text-sm text-white placeholder:text-[#5F6E77] transition-all focus:border-amber-400/50 focus:bg-[#161A22] focus:outline-none focus:ring-2 focus:ring-amber-500/20";

export const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#8E9CA6]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#E88C38] via-[#F5A623] to-[#E88C38] bg-[length:200%_auto] px-4 py-2.5 text-sm font-bold text-[#0B0C0E] shadow-[0_0_20px_rgba(245,166,35,0.25)] transition-all hover:shadow-[0_0_30px_rgba(245,166,35,0.4)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#E2E8F0] shadow-2xs transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";

export function Alert({
  kind,
  children,
}: {
  kind: "error" | "warning" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-red-500/30 bg-red-950/40 text-red-300",
    warning: "border-amber-500/30 bg-amber-950/40 text-amber-300",
    success: "border-emerald-500/30 bg-emerald-950/40 text-emerald-300",
    info: "border-blue-500/30 bg-blue-950/40 text-blue-300",
  };
  return (
    <div className={`rounded-xl border p-3.5 text-sm leading-relaxed ${styles[kind]}`}>
      {children}
    </div>
  );
}
