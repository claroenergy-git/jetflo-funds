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
    default: "bento-card bg-white",
    amber: "bento-card bento-card-amber",
    emerald: "bento-card bento-card-emerald",
    elevated: "bento-card shadow-lg bg-[#ffffff] border-[#dcd4c0]",
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
        <h1 className="text-2xl font-extrabold tracking-tight text-[#14261c]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-[#536658] font-medium">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-[#dcd4c0] bg-white px-3.5 py-2.5 text-sm text-[#14261c] placeholder:text-[#8e9f93] transition-all focus:border-[#1e3e30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3e30]/15";

export const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#415546]";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3e30] px-4 py-2.5 text-sm font-bold text-[#ffffff] shadow-[0_2px_8px_rgba(30,62,48,0.2)] transition-all hover:bg-[#142d21] hover:shadow-[0_4px_14px_rgba(30,62,48,0.3)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#dcd4c0] bg-white px-4 py-2.5 text-sm font-semibold text-[#14261c] shadow-2xs transition-all hover:bg-[#f2ece0] hover:border-[#c8bd9f] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

export function Alert({
  kind,
  children,
}: {
  kind: "error" | "warning" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]",
    warning: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
    success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    info: "border-[#bae6fd] bg-[#f0f9ff] text-[#0369a1]",
  };
  return (
    <div className={`rounded-xl border p-3.5 text-sm font-medium leading-relaxed shadow-xs ${styles[kind]}`}>
      {children}
    </div>
  );
}
