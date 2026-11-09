import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, getFundRequests, getPurchaseOrders } from "@/lib/data";
import { withUserContext } from "@/lib/db";
import { PageTitle, Card } from "@/components/ui";
import {
  inr,
  fmtMoney,
  fmtMoneyMulti,
  fmtDate,
  daysSince,
  monthKey,
  agingBucket,
  istDateKey,
  sumByCurrency,
  addTotals,
  type CurrencyTotals,
} from "@/lib/format";
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

  const reqData: any[] = await getFundRequests(profile, { orderBy: "fr.created_at DESC" });

  const paymentsData: any[] = await withUserContext(profile.id, async (client) => {
    const res = await client.query(
      `SELECT p.id, p.amount_paid, p.paid_on::text AS paid_on, p.mode, p.utr_ref,
         COALESCE(fr.currency, 'INR') AS currency,
         json_build_object(
           'request_no', fr.request_no, 'category', fr.category, 'product_sku', fr.product_sku,
           'vendor', CASE WHEN v.id IS NOT NULL THEN json_build_object('name', v.name) END,
           'budget_head', CASE WHEN bh.id IS NOT NULL THEN json_build_object('sub_head', bh.sub_head) END
         ) AS request
       FROM jetflo_payments p
       LEFT JOIN jetflo_fund_requests fr ON fr.id = p.request_id
       LEFT JOIN jetflo_vendors v ON v.id = fr.vendor_id
       LEFT JOIN jetflo_budget_heads bh ON bh.id = fr.budget_head_id
       ORDER BY p.paid_on`
    );
    return res.rows;
  });

  const [{ data: heads }, { data: settings }] = await Promise.all([
    supabase.from("jetflo_budget_heads").select("*").eq("category", "capex").eq("active", true),
    supabase.from("jetflo_settings").select("key, value"),
  ]);

  const allPos: any[] = await getPurchaseOrders(profile, { orderBy: "po.created_at DESC" });
  const posData: any[] = allPos.filter((p) => p.status !== "draft" && p.status !== "cancelled");

  const poIds = (posData ?? []).map((p: any) => p.id);
  const { data: poLinkedRequests } = poIds.length
    ? await supabase
        .from("jetflo_fund_requests")
        .select("po_id, amount_approved, amount_paid, status")
        .in("po_id", poIds)
    : { data: [] as any[] };

  const todayTimestamp = new Date().setHours(0, 0, 0, 0);

  const poRows = (posData ?? []).map((p: any) => {
    const linked = (poLinkedRequests ?? []).filter((r: any) => r.po_id === p.id);
    const billed = linked
      .filter((r: any) => ["awaiting_second_approval", "approved", "partially_approved", "paid", "closed"].includes(r.status))
      .reduce((s: number, r: any) => s + Number(r.amount_approved || 0), 0);
    const paidOnPo = linked.reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0);
    
    const totalOrdered = (p.items ?? []).reduce((s: number, i: any) => s + Number(i.qty || 0), 0);
    const totalReceived = (p.items ?? []).reduce((s: number, i: any) => s + Number(i.qty_received || 0), 0);
    const grnUtil = totalOrdered > 0 ? totalReceived / totalOrdered : 0;
    const billedUtil = Number(p.total_value) > 0 ? billed / Number(p.total_value) : 0;
    const paidUtil = Number(p.total_value) > 0 ? paidOnPo / Number(p.total_value) : 0;
    
    const isOverdue =
      p.expected_delivery_date &&
      new Date(p.expected_delivery_date).getTime() < todayTimestamp &&
      p.receive_status !== "received";

    return {
      ...p,
      billed,
      paidOnPo,
      totalOrdered,
      totalReceived,
      grnUtil,
      billedUtil,
      paidUtil,
      isOverdue,
    };
  });

  const reqs: any[] = reqData ?? [];
  const pays: any[] = paymentsData ?? [];
  const amendedReqs = reqs.filter((r) => r.currency_amended);
  const reqCurrency = (r: any) => r.currency || "INR";
  const payAmount = (p: any) => +p.amount_paid;
  const payCurrency = (p: any) => p.currency;

  // ---- date filter ----
  // Applies to flows (payments made, decisions taken in the period). Positions — funds in flight,
  // unclosed advances, budget utilisation, PO matrix, aging — are "as of today" and labelled so.
  const isFiltered = Boolean(from || to);
  const inRange = (d: string | Date | null | undefined) => {
    if (!d) return false;
    const day = istDateKey(d);
    return (!from || day >= from) && (!to || day <= to);
  };
  const fPays = isFiltered ? pays.filter((p) => inRange(p.paid_on)) : pays;
  const periodLabel = isFiltered
    ? `${from ? fmtDate(from) : "Start"} → ${to ? fmtDate(to) : "Today"}`
    : "Since inception";

  // ---- headline KPIs ----
  const paidCapex = sumByCurrency(fPays.filter((p) => p.request?.category === "capex"), payAmount, payCurrency);
  const paidRm = sumByCurrency(fPays.filter((p) => p.request?.category === "raw_material"), payAmount, payCurrency);

  // money in flight
  const approvedUnpaid = reqs.filter(
    (r) => ["approved", "partially_approved"].includes(r.status) && +r.amount_approved > +r.amount_paid
  );
  const awaitingApproval = reqs.filter((r) => ["submitted", "awaiting_second_approval"].includes(r.status));
  const unclosed = reqs.filter((r) => r.status === "paid");
  const inFlight = addTotals(
    sumByCurrency(approvedUnpaid, (r) => +r.amount_approved - +r.amount_paid, reqCurrency),
    sumByCurrency(awaitingApproval, (r) => +r.amount_requested, reqCurrency)
  );
  const unclosedTotals = sumByCurrency(unclosed, (r) => +r.amount_paid, reqCurrency);

  // TATs — requests decided / first paid within the period
  const decided = reqs.filter((r) => r.submitted_at && r.decided_at && (!isFiltered || inRange(r.decided_at)));
  const avgApprovalDays = decided.length
    ? decided.reduce((s, r) => s + (new Date(r.decided_at).getTime() - new Date(r.submitted_at).getTime()), 0) /
      decided.length /
      86400000
    : 0;
  const paidReqs = reqs.filter(
    (r) => r.submitted_at && r.first_paid_at && (!isFiltered || inRange(r.first_paid_at))
  );
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
      const committed = sumByCurrency(hr, (r) => +(r.amount_approved ?? 0), reqCurrency);
      const paid = sumByCurrency(hr, (r) => +(r.amount_paid ?? 0), reqCurrency);
      // Sanctioned budgets are in INR, so utilisation is INR-committed vs sanctioned.
      const sanctioned = +(h.sanctioned_amount ?? 0);
      const committedInr = committed.INR ?? 0;
      return { sub_head: h.sub_head, sanctioned, committed, paid, committedInr, util: sanctioned ? committedInr / sanctioned : 0 };
    })
    .filter((r) => r.sanctioned || Object.values(r.committed).some(Boolean))
    .sort((a, b) => b.committedInr - a.committedInr);

  const capexTotals = capexRows.reduce(
    (t, r) => ({
      sanctioned: t.sanctioned + r.sanctioned,
      committed: addTotals(t.committed, r.committed),
      paid: addTotals(t.paid, r.paid),
    }),
    { sanctioned: 0, committed: {} as CurrencyTotals, paid: {} as CurrencyTotals }
  );

  // RM: charts plot a single INR scale; other-currency payments are called out separately
  const rmPaysAll = fPays.filter((p) => p.request?.category === "raw_material");
  const rmPays = rmPaysAll.filter((p) => p.currency === "INR");
  const rmOtherCurrency = sumByCurrency(rmPaysAll.filter((p) => p.currency !== "INR"), payAmount, payCurrency);
  const rmExcludedNote = Object.keys(rmOtherCurrency).length
    ? `INR only · excludes ${fmtMoneyMulti(rmOtherCurrency)} paid in other currencies`
    : null;
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
  const buckets = new Map<string, { count: number; amount: CurrencyTotals }>();
  for (const r of unclosed) {
    const b = agingBucket(daysSince(r.first_paid_at));
    const cur = buckets.get(b) ?? { count: 0, amount: {} };
    buckets.set(b, { count: cur.count + 1, amount: addTotals(cur.amount, { [reqCurrency(r)]: +r.amount_paid }) });
  }

  // CSV rows
  const paymentsCsv = fPays.map((p) => ({
    request: p.request?.request_no,
    category: p.request?.category,
    sub_head: p.request?.budget_head?.sub_head,
    vendor: p.request?.vendor?.name,
    sku: p.request?.product_sku ?? "",
    currency: p.currency,
    amount: p.amount_paid,
    paid_on: p.paid_on,
    mode: p.mode,
    utr: p.utr_ref ?? "",
  }));
  const capexCsv = capexRows.map((r) => ({
    sub_head: r.sub_head,
    sanctioned_inr: r.sanctioned,
    committed_inr: r.committed.INR ?? 0,
    paid_inr: r.paid.INR ?? 0,
    committed_usd: r.committed.USD ?? 0,
    paid_usd: r.paid.USD ?? 0,
    utilization_pct: Math.round(r.util * 100),
  }));
  const poTotals = sumByCurrency(poRows, (p: any) => Number(p.total_value || 0), (p: any) => p.currency);
  const poBilled = sumByCurrency(poRows, (p: any) => Number(p.billed || 0), (p: any) => p.currency);

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
          <a
            href="/jetflo_historical_data_template.csv"
            download="JetFlo_Historical_Records_Template.csv"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#cce3d4] bg-[#eaf3ed] px-3.5 py-1.5 font-bold text-[#166534] shadow-2xs hover:bg-[#dcfce7] transition cursor-pointer"
            title="Download CSV / Excel template to fill previous records"
          >
            <span>📥</span>
            <span>Import Template</span>
          </a>
        </form>
      </div>

      {/* Accounts Oversight Notification: Formal Currency Amendments Logged */}
      {amendedReqs.length > 0 && (
        <div className="rounded-2xl border-2 border-[#bae6fd] bg-gradient-to-r from-[#f0f9ff] via-[#e0f2fe] to-[#f0f9ff] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bae6fd] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0369a1] text-white text-xs font-bold shadow-xs">
                🔔
              </span>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0369a1]">
                Accounts Oversight Alert: Formal Currency Amendments Logged ({amendedReqs.length})
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-[#0369a1]">
              Claro Accounts Oversight Notice
            </span>
          </div>

          <div className="mt-3 divide-y divide-[#bae6fd]/50">
            {amendedReqs.slice(0, 5).map((r: any) => (
              <div key={r.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Link
                    href={`/requests/${r.id}`}
                    className="font-mono font-bold text-[#0369a1] hover:underline"
                  >
                    {r.request_no}
                  </Link>
                  <span className="text-[#14261c] font-semibold">{r.vendor?.name}</span>
                  <span className="text-[#7a8d80]">·</span>
                  <span className="text-[#536658] font-medium">{r.item_description}</span>
                  {r.currency_amendment_reason && (
                    <span className="text-[11px] text-[#0369a1] bg-white/70 px-2 py-0.5 rounded border border-[#bae6fd]/60 font-medium">
                      Note: {r.currency_amendment_reason}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="line-through text-[#7a8d80] text-[11px] mr-1.5">
                      {fmtMoney(r.previous_amount || r.amount_requested, r.previous_currency || "INR")}
                    </span>
                    <span className="font-extrabold text-[#0369a1]">
                      ➔ {fmtMoney(r.amount_requested, r.currency)}
                    </span>
                  </div>
                  <Link
                    href={`/requests/${r.id}`}
                    className="px-2.5 py-1 rounded-lg bg-[#0369a1] text-white text-[11px] font-bold hover:bg-[#0284c7] transition shrink-0 shadow-2xs"
                  >
                    Review Ticket ➔
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isFiltered && (
        <div className="rounded-xl border border-[#cce3d4] bg-[#eaf3ed] px-4 py-2.5 text-xs font-semibold text-[#1e3e30]">
          Showing <b>{periodLabel}</b> for payments, spend charts and turnaround times. Sections marked{" "}
          <b>As of today</b> show the current position and aren&apos;t affected by the date filter.
        </div>
      )}

      {/* Row 1: Actionable Headline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Total CAPEX Deployed"
          value={fmtMoneyMulti(paidCapex, { compact: true })}
          sub={`${fmtMoneyMulti(paidCapex)} settled`}
          badge={periodLabel}
          accent={C_CAPEX}
          variant="emerald"
        />
        <Kpi
          label="Raw Material Payments"
          value={fmtMoneyMulti(paidRm, { compact: true })}
          sub={`${fmtMoneyMulti(paidRm)} settled`}
          badge={periodLabel}
          accent={C_RM}
          variant="amber"
        />
        <Kpi
          label="Funds In Flight"
          value={fmtMoneyMulti(inFlight, { compact: true })}
          sub={`${approvedUnpaid.length} approved unpaid · ${awaitingApproval.length} in queue`}
          badge="As of today"
        />
        <Kpi
          label="Unclosed Advances"
          value={fmtMoneyMulti(unclosedTotals, { compact: true })}
          sub={`${unclosed.length} paid, invoices pending`}
          badge="As of today"
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
                    <td className="px-6 py-3 text-right font-bold tabular-nums text-[#14261c]">{fmtMoney(+p.amount_paid, p.currency)}</td>
                    <td className="px-6 py-3 font-mono text-xs text-[#536658] font-semibold">{p.utr_ref ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-xs text-[#536658]">
                    {isFiltered ? "No payments in this period." : "No payment records logged yet."}
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
            <p className="text-xs text-[#536658] mt-0.5">
              Budget allocation per manufacturing plant sub-head · <b>As of today</b> (cumulative)
            </p>
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
                  <td className="px-6 py-3.5 text-right font-bold tabular-nums text-[#14261c]">{fmtMoneyMulti(r.committed, { compact: true })}</td>
                  <td className="px-6 py-3.5 text-right font-bold tabular-nums text-[#166534]">{fmtMoneyMulti(r.paid, { compact: true })}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5" title={`Committed ${inr(r.committedInr)} of ${inr(r.sanctioned)} (INR)`}>
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
                <td className="px-6 py-3.5 text-right tabular-nums">{fmtMoneyMulti(capexTotals.committed, { compact: true })}</td>
                <td className="px-6 py-3.5 text-right tabular-nums text-[#166534]">{fmtMoneyMulti(capexTotals.paid, { compact: true })}</td>
                <td className="px-6 py-3.5 text-xs text-[#536658]">
                  {capexTotals.sanctioned
                    ? `${Math.round(((capexTotals.committed.INR ?? 0) / capexTotals.sanctioned) * 100)}% overall utilized`
                    : ""}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3.5: Purchase Order 3-Way Match Matrix (Physical vs Billed vs Paid) */}
      <div className="bento-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
                Purchase Orders — 3-Way Match & Fulfillment Matrix
              </h2>
              {poRows.some((p: any) => p.isOverdue) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#fecaca] bg-[#fee2e2] px-2.5 py-0.5 text-[11px] font-extrabold text-[#991b1b]">
                  ⚠️ {poRows.filter((p: any) => p.isOverdue).length} Delivery Overdue
                </span>
              )}
            </div>
            <p className="text-xs text-[#536658] mt-0.5">
              Dual-stage fulfillment tracking: Physical Goods Receipt (GRN) vs Invoiced (Billed) vs Bank Disbursement · <b>As of today</b>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-xl border border-[#e5decb] bg-white px-3 py-1 text-[#14261c]">
              Orders: <strong>{poRows.length}</strong>
            </span>
            <span className="rounded-xl border border-[#e5decb] bg-white px-3 py-1 text-[#166534]">
              Total: <strong>{fmtMoneyMulti(poTotals, { compact: true })}</strong>
            </span>
            <span className="rounded-xl border border-[#e5decb] bg-white px-3 py-1 text-[#0369a1]">
              Billed: <strong>{fmtMoneyMulti(poBilled, { compact: true })}</strong>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                <th className="px-5 py-3">PO Number</th>
                <th className="px-5 py-3">Vendor & Plant</th>
                <th className="px-5 py-3">Delivery Due</th>
                <th className="px-5 py-3 text-right">Order Value</th>
                <th className="w-[18%] px-5 py-3">Physical (GRN)</th>
                <th className="w-[18%] px-5 py-3">Billed (Invoiced)</th>
                <th className="px-5 py-3 text-right">Paid Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5decb]">
              {poRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-xs text-[#536658]">
                    No active purchase orders issued yet.{" "}
                    <Link href="/finance/purchase-orders" className="text-[#1e3e30] font-bold underline">
                      View or draft a Purchase Order
                    </Link>{" "}
                    to see live 3-Way Match tracking here.
                  </td>
                </tr>
              ) : (
                poRows.map((p: any) => {
                  return (
                    <tr key={p.id} className="hover:bg-[#fbf9f4] transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/finance/purchase-orders/${p.id}`} className="font-mono font-bold text-[#1e3e30] hover:underline">
                          {p.po_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-[#14261c]">{p.vendor?.name}</div>
                        <div className="text-[11px] text-[#536658]">{p.destination_plant ?? "Hyderabad Plant"}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {p.expected_delivery_date ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#14261c]">{fmtDate(p.expected_delivery_date)}</span>
                            {p.isOverdue && (
                              <span className="text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] px-1.5 py-0.5 rounded border border-[#fecaca]">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#7a8d80]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#14261c] font-bold">
                        {fmtMoney(p.total_value, p.currency, { compact: true })}
                      </td>
                      
                      {/* Physical Progress (GRN) */}
                      <td className="px-5 py-3.5">
                        {p.totalOrdered > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-bold">
                              <span className="text-[#0369a1]">
                                {p.totalReceived} / {p.totalOrdered} items
                              </span>
                              <span className="text-[#536658]">{Math.round(p.grnUtil * 100)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#e0f2fe] border border-[#bae6fd]">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-[#0284c7] to-[#0369a1] transition-all duration-500"
                                style={{ width: `${Math.min(p.grnUtil * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#7a8d80] italic">No item count</span>
                        )}
                      </td>

                      {/* Financial Invoiced (Billed) Progress */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-[#14261c]">{fmtMoney(p.billed, p.currency, { compact: true })}</span>
                            <span className={p.billedUtil > 1 ? "text-red-600" : "text-[#536658]"}>
                              {Math.round(p.billedUtil * 100)}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#f0ebd9] border border-[#e5decb]">
                            <div
                              className="h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(p.billedUtil * 100, 100)}%`,
                                background: p.billedUtil > 1 ? "#dc2626" : "linear-gradient(90deg, #1e3e30, #2d5a44)",
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right font-bold tabular-nums text-[#166534]">
                        {fmtMoney(p.paidOnPo, p.currency, { compact: true })}
                      </td>
                    </tr>
                  );
                })
              )}
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
              {periodLabel}
            </span>
          </div>
          <p className="text-xs text-[#536658] mb-4">
            Disbursements per month for production components{rmExcludedNote && ` · ${rmExcludedNote}`}
          </p>
          <MonthlyBars data={trend} color={C_RM} />
        </Card>

        <Card variant="amber">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#d97706]" />
              Top Suppliers by Spend
            </h2>
            <span className="text-[11px] font-bold text-[#92400e] bg-[#fef3c7] px-2.5 py-0.5 rounded-full border border-[#fde68a]">
              Raw Material · {periodLabel}
            </span>
          </div>
          <p className="text-xs text-[#536658] mb-4">
            Concentration of spend across key manufacturing vendors{rmExcludedNote && ` · ${rmExcludedNote}`}
          </p>
          <HBarList data={topVendors} color={C_RM} total={rmFilteredTotal} />
        </Card>
      </div>

      {/* Row 5: Turnaround & Advance Aging */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card>
          <h2 className="text-sm font-bold text-[#14261c] mb-1">Unclosed Advances Aging</h2>
          <p className="text-xs text-[#536658] mb-4">Paid transfers awaiting final tax invoice · <b>As of today</b></p>
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
                        {v ? fmtMoneyMulti(v.amount, { compact: true }) : "—"}
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
          <p className="text-xs text-[#536658] mb-3">Processing speeds ({periodLabel}) & policy limits</p>
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
