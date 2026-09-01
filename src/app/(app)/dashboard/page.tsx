import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { inr, fmtDate, daysSince, monthKey, agingBucket } from "@/lib/format";
import { MonthlyBars, HBarList, Kpi, C_CAPEX, C_RM } from "@/components/dashboard-charts";
import { CsvButton } from "@/components/csv-button";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const [{ data: requests }, { data: payments }, { data: heads }, { data: settings }] = await Promise.all([
    supabase
      .from("jetflo_fund_requests")
      .select(
        `id, request_no, category, item_description, product_sku, amount_requested, amount_approved,
         amount_paid, status, urgency, submitted_at, decided_at, first_paid_at, closed_at, created_at,
         budget_head:jetflo_budget_heads ( sub_head, sanctioned_amount ),
         vendor:jetflo_vendors ( name ),
         requester:jetflo_users!jetflo_fund_requests_requester_id_fkey ( name )`
      ),
    supabase
      .from("jetflo_payments")
      .select(
        `id, amount_paid, paid_on, mode, utr_ref,
         request:jetflo_fund_requests ( request_no, category, product_sku,
           vendor:jetflo_vendors ( name ), budget_head:jetflo_budget_heads ( sub_head ) )`
      )
      .order("paid_on"),
    supabase.from("jetflo_budget_heads").select("*").eq("category", "capex").eq("active", true),
    supabase.from("jetflo_settings").select("key, value"),
  ]);

  const reqs: any[] = requests ?? [];
  const pays: any[] = payments ?? [];

  // ---- headline KPIs ----
  const paidCapex = pays.filter((p) => p.request?.category === "capex").reduce((s, p) => s + +p.amount_paid, 0);
  const paidRm = pays.filter((p) => p.request?.category === "raw_material").reduce((s, p) => s + +p.amount_paid, 0);

  // ---- date-filtered slices ----
  const inRange = (d: string | null) =>
    !!d && (!from || d >= from) && (!to || d.slice(0, 10) <= to);
  const fPays = from || to ? pays.filter((p) => inRange(p.paid_on)) : pays;

  // money in flight
  const approvedUnpaid = reqs.filter(
    (r) => ["approved", "partially_approved"].includes(r.status) && +r.amount_approved > +r.amount_paid
  );
  const awaitingApproval = reqs.filter((r) => ["submitted", "awaiting_second_approval"].includes(r.status));
  const unclosed = reqs.filter((r) => r.status === "paid");
  const inFlight =
    approvedUnpaid.reduce((s, r) => s + +r.amount_approved - +r.amount_paid, 0) +
    awaitingApproval.reduce((s, r) => s + +r.amount_requested, 0);

  // TATs
  const decided = reqs.filter((r) => r.submitted_at && r.decided_at);
  const avgApprovalDays = decided.length
    ? decided.reduce((s, r) => s + (new Date(r.decided_at).getTime() - new Date(r.submitted_at).getTime()), 0) /
      decided.length /
      86400000
    : 0;
  const paidReqs = reqs.filter((r) => r.submitted_at && r.first_paid_at);
  const avgPayDays = paidReqs.length
    ? paidReqs.reduce((s, r) => s + (new Date(r.first_paid_at).getTime() - new Date(r.submitted_at).getTime()), 0) /
      paidReqs.length /
      86400000
    : 0;

  // CAPEX by sub-head
  const capexRows = (heads ?? [])
    .map((h: any) => {
      const hr = reqs.filter(
        (r) =>
          r.category === "capex" &&
          r.budget_head?.sub_head === h.sub_head &&
          ["approved", "partially_approved", "paid", "closed"].includes(r.status)
      );
      const committed = hr.reduce((s, r) => s + +(r.amount_approved ?? 0), 0);
      const paid = hr.reduce((s, r) => s + +(r.amount_paid ?? 0), 0);
      const sanctioned = +(h.sanctioned_amount ?? 0);
      return { sub_head: h.sub_head, sanctioned, committed, paid, util: sanctioned ? committed / sanctioned : 0 };
    })
    .filter((r) => r.sanctioned || r.committed)
    .sort((a, b) => b.committed - a.committed);

  const capexTotals = capexRows.reduce(
    (t, r) => ({ sanctioned: t.sanctioned + r.sanctioned, committed: t.committed + r.committed, paid: t.paid + r.paid }),
    { sanctioned: 0, committed: 0, paid: 0 }
  );

  // RM: monthly run-rate
  const rmPays = fPays.filter((p) => p.request?.category === "raw_material");
  const byMonth = new Map<string, number>();
  for (const p of rmPays) byMonth.set(monthKey(p.paid_on), (byMonth.get(monthKey(p.paid_on)) ?? 0) + +p.amount_paid);
  const trend = [...byMonth.entries()].map(([label, value]) => ({ label, value }));

  // RM: top vendors
  const byVendor = new Map<string, number>();
  for (const p of rmPays) {
    const v = p.request?.vendor?.name ?? "—";
    byVendor.set(v, (byVendor.get(v) ?? 0) + +p.amount_paid);
  }
  const topVendors = [...byVendor.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const rmFilteredTotal = rmPays.reduce((s, p) => s + +p.amount_paid, 0);

  // aging buckets
  const buckets = new Map<string, { count: number; amount: number }>();
  for (const r of unclosed) {
    const b = agingBucket(daysSince(r.first_paid_at));
    const cur = buckets.get(b) ?? { count: 0, amount: 0 };
    buckets.set(b, { count: cur.count + 1, amount: cur.amount + +r.amount_paid });
  }

  // CSV rows
  const paymentsCsv = fPays.map((p) => ({
    request: p.request?.request_no,
    category: p.request?.category,
    sub_head: p.request?.budget_head?.sub_head,
    vendor: p.request?.vendor?.name,
    sku: p.request?.product_sku ?? "",
    amount: p.amount_paid,
    paid_on: p.paid_on,
    mode: p.mode,
    utr: p.utr_ref ?? "",
  }));
  const capexCsv = capexRows.map((r) => ({
    sub_head: r.sub_head,
    sanctioned: r.sanctioned,
    committed: r.committed,
    paid: r.paid,
    utilization_pct: Math.round(r.util * 100),
  }));

  const qs = (f?: string, t?: string) => {
    const p = new URLSearchParams();
    if (f) p.set("from", f);
    if (t) p.set("to", t);
    const s = p.toString();
    return `/dashboard${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <PageTitle
          title="Executive Ledger Dashboard"
          sub="JetFlo Manufacturing Unit — CAPEX Plant Setup & Live Production Burn Rate"
        />
        <form className="flex flex-wrap items-center gap-2 text-xs" action="/dashboard">
          <Link
            href={qs()}
            className={`rounded-xl border px-3.5 py-1.5 font-bold transition ${
              !from && !to
                ? "border-[#1e3e30] bg-[#1e3e30] text-white shadow-2xs"
                : "border-[#e5decb] bg-white text-[#536658] hover:bg-[#f0ebd9] hover:text-[#14261c]"
            }`}
          >
            Since Inception
          </Link>
          <Link
            href={qs("2026-04-01")}
            className={`rounded-xl border px-3.5 py-1.5 font-bold transition ${
              from === "2026-04-01" && !to
                ? "border-[#1e3e30] bg-[#1e3e30] text-white shadow-2xs"
                : "border-[#e5decb] bg-white text-[#536658] hover:bg-[#f0ebd9] hover:text-[#14261c]"
            }`}
          >
            FY 26–27
          </Link>
          <div className="flex items-center gap-1.5 rounded-xl border border-[#dcd4c0] bg-white px-2.5 py-1 shadow-2xs">
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="bg-transparent text-xs text-[#14261c] focus:outline-none"
            />
            <span className="text-[#8e9f93]">→</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="bg-transparent text-xs text-[#14261c] focus:outline-none"
            />
          </div>
          <button className="rounded-xl border border-[#dcd4c0] bg-white px-3.5 py-1.5 font-bold text-[#1e3e30] shadow-2xs hover:bg-[#f0ebd9] transition cursor-pointer">
            Filter
          </button>
        </form>
      </div>

      {/* Row 1: Actionable Headline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Total CAPEX Deployed"
          value={inr(paidCapex, { compact: true })}
          sub={`${inr(paidCapex)} settled`}
          accent={C_CAPEX}
          variant="emerald"
        />
        <Kpi
          label="Raw Material Payments"
          value={inr(paidRm, { compact: true })}
          sub={`${inr(paidRm)} settled`}
          accent={C_RM}
          variant="amber"
        />
        <Kpi
          label="Funds In Flight"
          value={inr(inFlight, { compact: true })}
          sub={`${approvedUnpaid.length} approved unpaid · ${awaitingApproval.length} in queue`}
        />
        <Kpi
          label="Unclosed Advances"
          value={inr(unclosed.reduce((s, r) => s + +r.amount_paid, 0), { compact: true })}
          sub={`${unclosed.length} paid, invoices pending`}
        />
      </div>

      {/* Row 2: Disbursement Register (Payment Records) */}
      <div className="bento-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#14261c]">Payment Records & Disbursement Register</h2>
            <p className="text-xs text-[#536658]">
              {from || to ? `Filtered records (${from ?? "Start"} ➔ ${to ?? "Today"})` : "Complete payment audit trail"}
            </p>
          </div>
          <CsvButton rows={paymentsCsv} filename="jetflo-disbursements.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                <th className="px-6 py-3">Transfer Date</th>
                <th className="px-6 py-3">Request No</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Beneficiary / Vendor</th>
                <th className="px-6 py-3 text-right">Amount Disbursed</th>
                <th className="px-6 py-3">Bank UTR / Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5decb]">
              {fPays.length ? (
                [...fPays].reverse().map((p) => (
                  <tr key={p.id} className="hover:bg-[#fbf9f4] transition-colors">
                    <td className="px-6 py-3 text-xs text-[#536658] font-semibold">{fmtDate(p.paid_on)}</td>
                    <td className="px-6 py-3 font-bold text-[#1e3e30]">{p.request?.request_no}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          p.request?.category === "capex"
                            ? "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]"
                            : "bg-[#fef3c7] text-[#92400e] border border-[#fde68a]"
                        }`}
                      >
                        {p.request?.category === "capex" ? "CAPEX" : "Raw Material"}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-3 text-xs font-bold text-[#14261c]">{p.request?.vendor?.name}</td>
                    <td className="px-6 py-3 text-right font-bold tabular-nums text-[#14261c]">{inr(+p.amount_paid)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-[#536658] font-semibold">{p.utr_ref ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-xs text-[#536658]">
                    No payment records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: CAPEX Utilization Table */}
      <div className="bento-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#166534]" />
              CAPEX — Sanctioned vs Committed vs Paid
            </h2>
            <p className="text-xs text-[#536658] mt-0.5">Budget allocation per manufacturing plant sub-head</p>
          </div>
          <CsvButton rows={capexCsv} filename="jetflo-capex-utilization.csv" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                <th className="px-6 py-3">Sub-head</th>
                <th className="px-6 py-3 text-right">Sanctioned Cap</th>
                <th className="px-6 py-3 text-right">Committed</th>
                <th className="px-6 py-3 text-right">Paid Out</th>
                <th className="w-[28%] px-6 py-3">Budget Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5decb]">
              {capexRows.map((r) => (
                <tr key={r.sub_head} className="hover:bg-[#fbf9f4] transition-colors">
                  <td className="px-6 py-3.5 font-bold text-[#14261c]">{r.sub_head}</td>
                  <td className="px-6 py-3.5 text-right tabular-nums text-[#536658] font-semibold">{inr(r.sanctioned, { compact: true })}</td>
                  <td className="px-6 py-3.5 text-right font-bold tabular-nums text-[#14261c]">{inr(r.committed, { compact: true })}</td>
                  <td className="px-6 py-3.5 text-right font-bold tabular-nums text-[#166534]">{inr(r.paid, { compact: true })}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5" title={`Committed ${inr(r.committed)} of ${inr(r.sanctioned)}`}>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f0ebd9] border border-[#e5decb]">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(r.util * 100, 100)}%`,
                            background: r.util > 1 ? "#dc2626" : "linear-gradient(90deg, #1e3e30, #2d5a44)",
                          }}
                        />
                      </div>
                      <span className={`w-12 text-right text-xs tabular-nums font-bold ${r.util > 1 ? "text-red-600" : "text-[#536658]"}`}>
                        {r.sanctioned ? `${Math.round(r.util * 100)}%` : "—"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#e5decb] bg-[#fbf9f4] font-extrabold text-[#14261c]">
                <td className="px-6 py-3.5">Total CAPEX</td>
                <td className="px-6 py-3.5 text-right tabular-nums text-[#536658]">{inr(capexTotals.sanctioned, { compact: true })}</td>
                <td className="px-6 py-3.5 text-right tabular-nums">{inr(capexTotals.committed, { compact: true })}</td>
                <td className="px-6 py-3.5 text-right tabular-nums text-[#166534]">{inr(capexTotals.paid, { compact: true })}</td>
                <td className="px-6 py-3.5 text-xs text-[#536658]">
                  {capexTotals.sanctioned ? `${Math.round((capexTotals.committed / capexTotals.sanctioned) * 100)}% overall utilized` : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4: Run-rate & Vendor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card variant="emerald">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
              Raw Material — Monthly Run-Rate
            </h2>
            <span className="text-[11px] font-bold text-[#166534] bg-[#dcfce7] px-2.5 py-0.5 rounded-full border border-[#bbf7d0]">
              {from || to ? "Filtered Period" : "All Time"}
            </span>
          </div>
          <p className="text-xs text-[#536658] mb-4">Disbursements per month for production components</p>
          <MonthlyBars data={trend} color={C_RM} />
        </Card>

        <Card variant="amber">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#d97706]" />
              Top Suppliers by Spend
            </h2>
            <span className="text-[11px] font-bold text-[#92400e] bg-[#fef3c7] px-2.5 py-0.5 rounded-full border border-[#fde68a]">
              Raw Material
            </span>
          </div>
          <p className="text-xs text-[#536658] mb-4">Concentration of spend across key manufacturing vendors</p>
          <HBarList data={topVendors} color={C_RM} total={rmFilteredTotal} />
        </Card>
      </div>

      {/* Row 5: Turnaround & Advance Aging */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-sm font-bold text-[#14261c] mb-1">Unclosed Advances Aging</h2>
          <p className="text-xs text-[#536658] mb-4">Paid transfers awaiting final tax invoice</p>
          {unclosed.length ? (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-[#e5decb]">
                {["0–7 days", "8–15 days", "16–30 days", "30+ days"].map((b) => {
                  const v = buckets.get(b);
                  const isCritical = b === "30+ days" && v && v.count > 0;
                  return (
                    <tr key={b} className="py-2.5">
                      <td className={`py-2.5 font-bold ${isCritical ? "text-red-600" : "text-[#536658]"}`}>
                        {b}
                      </td>
                      <td className="py-2.5 text-right text-[#536658] font-medium">{v ? `${v.count} requests` : "0"}</td>
                      <td className="py-2.5 text-right font-bold tabular-nums text-[#14261c]">
                        {v ? inr(v.amount, { compact: true }) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-[#166534] bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-4">
              <span className="text-base mb-1">✓</span>
              <span>All paid advances have been settled with final invoices.</span>
            </div>
          )}
        </Card>

        <Card variant="default">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-bold text-[#14261c]">Governance & TAT</h2>
            {profile.role === "leadership" && (
              <Link
                href="/settings"
                className="text-[11px] font-bold text-[#1e3e30] hover:underline flex items-center gap-1"
              >
                ⚙️ Limits ➔
              </Link>
            )}
          </div>
          <p className="text-xs text-[#536658] mb-3">Processing speeds & policy limits</p>
          <div className="space-y-2.5">
            <div className="rounded-xl border border-[#d8e8dc] bg-[#f4f9f5] p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#1e3e30]">2nd Approver Cap</div>
                <div className="text-xs text-[#536658]">Requires Dual Sign-off</div>
              </div>
              <div className="text-sm font-extrabold text-[#166534] tabular-nums">
                {inr(Number(settings?.find((s: any) => s.key === "second_approver_above")?.value ?? 500000), { compact: true })}
              </div>
            </div>
            <div className="rounded-xl border border-[#e5decb] bg-[#fbf9f4] p-3">
              <div className="text-xl font-extrabold text-[#14261c] tabular-nums">
                {avgApprovalDays.toFixed(1)} <span className="text-xs font-semibold text-[#536658]">days</span>
              </div>
              <div className="text-[11px] text-[#536658]">Submission ➔ Decision ({decided.length} reqs)</div>
            </div>
            <div className="rounded-xl border border-[#e5decb] bg-[#fbf9f4] p-3">
              <div className="text-xl font-extrabold text-[#166534] tabular-nums">
                {avgPayDays.toFixed(1)} <span className="text-xs font-semibold text-[#536658]">days</span>
              </div>
              <div className="text-[11px] text-[#536658]">Submission ➔ Payment ({paidReqs.length} reqs)</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
