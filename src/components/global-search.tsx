"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { PaymentSearchHit, VendorSearchHit } from "@/lib/data";

type Results = { vendors: VendorSearchHit[]; payments: PaymentSearchHit[] };
type Hit = { href: string; key: string };

const EMPTY: Results = { vendors: [], payments: [] };

export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Debounced fetch; aborts the previous request so stale results never overwrite newer ones.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
        setActive(0);
      } catch {
        /* aborted or network error — keep previous results */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // "/" focuses search from anywhere (unless already typing); click outside closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const hits: Hit[] = [
    ...results.vendors.map((v) => ({ key: `v-${v.id}`, href: `/finance/vendors/${v.id}` })),
    ...results.payments.map((p) => ({ key: `p-${p.id}`, href: `/requests/${p.request_id}` })),
  ];

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown" && hits.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp" && hits.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter" && hits[active]) {
      e.preventDefault();
      go(hits[active].href);
    }
  };

  const showPanel = open && query.trim().length >= 2;
  const rowClass = (i: number) =>
    `flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
      i === active ? "bg-[#eaf3ed]" : "hover:bg-[#fbf9f4]"
    }`;

  return (
    <div ref={boxRef} className="relative w-full max-w-sm">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a8d80]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search vendors & payments…"
          aria-label="Search vendors and payments"
          className="w-full rounded-xl border border-[#dcd4c0] bg-[#fbf9f4] py-2 pl-9 pr-9 text-xs font-semibold text-[#14261c] placeholder:text-[#7a8d80] transition-all hover:border-[#1e3e30] focus:border-[#1e3e30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3e30]/15"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[#dcd4c0] bg-white px-1.5 text-[10px] font-bold text-[#7a8d80] sm:block">
          /
        </kbd>
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#dfd7c4] bg-white shadow-[0_12px_32px_rgba(26,40,31,0.14)] sm:min-w-[420px]">
          {loading && hits.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs font-semibold text-[#7a8d80]">Searching…</div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs font-semibold text-[#7a8d80]">
              No vendors or payments match “{query.trim()}”
            </div>
          ) : (
            <>
              {results.vendors.length > 0 && (
                <div className="py-1">
                  <div className="px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-[#415546]">
                    Vendors
                  </div>
                  {results.vendors.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hits[i].href)}
                      className={rowClass(i)}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#14261c]">{v.name}</div>
                        <div className="truncate text-[11px] text-[#536658]">
                          {[v.trade_name, v.city].filter(Boolean).join(" · ") || "—"}
                          {v.gstin && <span className="ml-1 font-mono">{v.gstin}</span>}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                          v.active
                            ? "border border-[#cce3d4] bg-[#eaf3ed] text-[#1e3e30]"
                            : "border border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                        }`}
                      >
                        {v.active ? "Active" : v.status.replace(/_/g, " ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {results.payments.length > 0 && (
                <div className="border-t border-[#f0ebd9] py-1">
                  <div className="px-4 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-[#415546]">
                    Payments made
                  </div>
                  {results.payments.map((p, j) => {
                    const i = results.vendors.length + j;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(hits[i].href)}
                        className={rowClass(i)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[#14261c]">
                            <span className="font-mono text-xs text-[#1e3e30]">{p.request_no ?? "—"}</span>
                            <span className="ml-2">{p.vendor_name ?? "No vendor"}</span>
                          </div>
                          <div className="truncate text-[11px] text-[#536658]">
                            {fmtDate(p.paid_on)} · <span className="uppercase">{p.mode}</span>
                            {p.utr_ref && <span className="ml-1 font-mono">UTR {p.utr_ref}</span>}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-xs font-bold text-[#14261c]">
                          {fmtMoney(p.amount_paid, p.currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
