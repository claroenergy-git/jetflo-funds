import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card, PoStatusChip } from "@/components/ui";
import { NewBlankPoForm } from "@/components/po-actions";
import { fmtMoney, fmtDate, daysSince } from "@/lib/format";
import type { PoStatus } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_TABS: { value: PoStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_second_approval", label: "Awaiting 2nd Approval" },
  { value: "open", label: "Open" },
  { value: "partially_billed", label: "Partially Billed" },
  { value: "fully_billed", label: "Fully Billed" },
  { value: "cancelled", label: "Cancelled" },
];

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const profile = await requireProfile();
  const isFinance = profile.role === "finance";
  const supabase = await getSupabase();

  const posRes = await supabase
    .from("jetflo_purchase_orders")
    .select(
      `id, po_number, category, currency, total_value, status, created_at,
       vendor:jetflo_vendors ( id, name ),
       budget_head:jetflo_budget_heads ( id, sub_head )`
    )
    .order("created_at", { ascending: false });

  const pos = posRes.data;
  const rows = ((pos ?? []) as any[]).filter((p) => !status || status === "all" || p.status === status);

  const counts = new Map<string, number>();
  for (const p of pos ?? []) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);

  let vendors: { id: string; name: string; category: string }[] = [];
  let budgetHeads: { id: string; category: string; sub_head: string }[] = [];
  const canDraftPo = isFinance;
  if (canDraftPo) {
    const [v, h] = await Promise.all([
      supabase.from("jetflo_vendors").select("id, name, category").eq("active", true).order("name"),
      supabase.from("jetflo_budget_heads").select("id, category, sub_head").eq("active", true).order("sub_head"),
    ]);
    vendors = v.data ?? [];
    budgetHeads = h.data ?? [];
  }

  const today = new Date().setHours(0, 0, 0, 0);

  return (
    <div className="space-y-6">
      <PageTitle title="Purchase Orders" sub="Numbered orders with plant delivery tracking, goods receipts (GRN), and invoice billing ceilings" />

      {canDraftPo && (
        <Card>
          <h2 className="mb-3 text-sm font-bold text-[#14261c]">
            + New Draft Purchase Order
          </h2>
          <NewBlankPoForm vendors={vendors} budgetHeads={budgetHeads} />
        </Card>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "all" ? "/finance/purchase-orders" : `/finance/purchase-orders?status=${t.value}`}
            className={`rounded-xl border px-3.5 py-1.5 font-bold transition ${
              (status ?? "all") === t.value
                ? "border-[#1e3e30] bg-[#1e3e30] text-white shadow-2xs"
                : "border-[#e5decb] bg-white text-[#536658] hover:bg-[#f0ebd9] hover:text-[#14261c]"
            }`}
          >
            {t.label} {t.value !== "all" && counts.get(t.value) ? `(${counts.get(t.value)})` : ""}
          </Link>
        ))}
      </div>

      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto no-scrollbar">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546] shadow-[0_1px_2px_rgba(20,38,28,0.05)]">
                <th className="px-5 py-3.5 bg-[#fbf9f4]">PO Number & Details</th>
                <th className="px-5 py-3.5 bg-[#fbf9f4]">Vendor & Plant</th>
                <th className="px-5 py-3.5 bg-[#fbf9f4]">Budget Head</th>
                <th className="px-5 py-3.5 text-right bg-[#fbf9f4]">Value</th>
                <th className="px-5 py-3.5 bg-[#fbf9f4]">Delivery Due</th>
                <th className="px-5 py-3.5 bg-[#fbf9f4]">PO Status</th>
                <th className="px-5 py-3.5 text-right bg-[#fbf9f4]">Date & Age</th>
                <th className="px-5 py-3.5 text-center bg-[#fbf9f4]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5decb]">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-xs text-[#536658]">
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const isOverdue =
                    p.expected_delivery_date &&
                    new Date(p.expected_delivery_date).getTime() < today &&
                    p.receive_status !== "received";
                  const isDraft = p.status === "draft";

                  return (
                    <tr key={p.id} className="hover:bg-[#fbf9f4] transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/finance/purchase-orders/${p.id}`}
                          className="font-mono font-extrabold text-[#1e3e30] hover:text-[#142d21] hover:underline flex items-center gap-1.5"
                        >
                          <span>{p.po_number ?? "Draft PO"}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-xs transition-opacity text-[#1e3e30]">➔</span>
                        </Link>
                        {isDraft && (
                          <div className="text-[10px] text-[#92400e] font-bold">Unissued draft</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/finance/purchase-orders/${p.id}`}
                          className="font-bold text-[#14261c] hover:text-[#1e3e30] transition-colors block"
                        >
                          {p.vendor?.name}
                        </Link>
                        <div className="text-[11px] text-[#536658] font-medium">{p.destination_plant ?? "Hyderabad Plant"}</div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#536658] font-semibold">{p.budget_head?.sub_head}</td>
                      <td className="px-5 py-3.5 text-right font-bold tabular-nums text-[#14261c]">
                        {fmtMoney(p.total_value, p.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {p.expected_delivery_date ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#14261c]">{fmtDate(p.expected_delivery_date)}</span>
                            {isOverdue && (
                              <span className="text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] px-1.5 py-0.5 rounded border border-[#fecaca]">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#7a8d80]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <PoStatusChip status={p.status as PoStatus} />
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs">
                        <span className="font-bold text-[#14261c]">{daysSince(p.created_at)}d</span>
                        <div className="text-[11px] text-[#7a8d80] font-medium mt-0.5">{fmtDate(p.created_at)}</div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Link
                          href={`/finance/purchase-orders/${p.id}`}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-2xs ${
                            isDraft
                              ? "bg-[#1e3e30] text-white hover:bg-[#142d21] shadow-xs"
                              : "bg-[#f0ebd9] text-[#1e3e30] border border-[#d5cbba] hover:bg-[#1e3e30] hover:text-white"
                          }`}
                        >
                          {isDraft ? "Review & Issue ➔" : "View Order ➔"}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
