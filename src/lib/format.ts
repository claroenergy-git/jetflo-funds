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

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const rem = n % 10;
  return rem ? `${TENS[ten]}-${ONES[rem]}` : TENS[ten];
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  if (hundred > 0 && rem > 0) {
    return `${ONES[hundred]} Hundred ${twoDigits(rem)}`;
  }
  if (hundred > 0) {
    return `${ONES[hundred]} Hundred`;
  }
  return twoDigits(rem);
}

/** Convert currency numbers into formal words in Indian numbering convention (Crore, Lakh, Thousand) */
export function amountToWords(amount: number | null | undefined, currency = "INR"): string {
  if (amount == null || isNaN(amount) || amount === 0) return "Zero";
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  if (intPart === 0 && decPart === 0) return "Zero";

  const crore = Math.floor(intPart / 10000000);
  const remCrore = intPart % 10000000;
  const lakh = Math.floor(remCrore / 100000);
  const remLakh = remCrore % 100000;
  const thousand = Math.floor(remLakh / 1000);
  const remThousand = remLakh % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (remThousand > 0) parts.push(threeDigits(remThousand));

  let words = parts.join(" ");
  if (decPart > 0) {
    words += ` and ${twoDigits(decPart)} ${currency === "USD" ? "Cents" : "Paise"}`;
  }
  return (words.trim() + " Only").replace(/\s+/g, " ");
}
