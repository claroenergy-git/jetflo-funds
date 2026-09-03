export function currencySymbol(currency?: string | null): string {
  return (currency || "INR").toUpperCase() === "USD" ? "$" : "₹";
}

export function fmtMoney(
  n: number | null | undefined,
  currency?: string | null,
  opts: { compact?: boolean } = {}
): string {
  if (n === null || n === undefined) return "—";
  const curr = (currency || "INR").toUpperCase();
  if (curr === "USD") {
    if (opts.compact) {
      const abs = Math.abs(n);
      if (abs >= 1e6) return `$${(n / 1e6).toFixed(2).replace(/\.00$/, "")}M`;
      if (abs >= 1e3) return `$${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
    }
    return (
      "$" +
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(n)
    );
  }

  // Default to INR
  if (opts.compact) {
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.00$/, "")} Cr`;
    if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2).replace(/\.00$/, "")} L`;
  }
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

export function inr(n: number | null | undefined, opts: { compact?: boolean } = {}): string {
  return fmtMoney(n, "INR", opts);
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function daysSince(d: string | Date | null | undefined): number {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

/** Indian financial-year month key, e.g. "Apr 26" */
export function monthKey(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function agingBucket(days: number): string {
  if (days <= 7) return "0–7 days";
  if (days <= 15) return "8–15 days";
  if (days <= 30) return "16–30 days";
  return "30+ days";
}
