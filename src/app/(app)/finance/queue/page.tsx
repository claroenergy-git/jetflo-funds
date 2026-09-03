import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, REQUEST_COLS, REQUEST_COLS_LEGACY } from "@/lib/data";
import { PageTitle, Alert } from "@/components/ui";
import { RequestTable } from "@/components/request-table";
import { inr } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function QueuePage() {
  const profile = await requireProfile();
  if (profile.role !== "finance") return <Alert kind="error">Finance team only.</Alert>;
  const supabase = await getSupabase();

  let res: any = await supabase
    .from("jetflo_fund_requests")
    .select(REQUEST_COLS)
    .in("status", ["submitted", "awaiting_second_approval"])
    .order("submitted_at", { ascending: true });

  if (res.error) {
    res = await supabase
      .from("jetflo_fund_requests")
      .select(REQUEST_COLS_LEGACY)
      .in("status", ["submitted", "awaiting_second_approval"])
      .order("submitted_at", { ascending: true });
  }

  const rows: any[] = res.data ?? [];
  const order = { critical: 0, urgent: 1, normal: 2 } as Record<string, number>;
  const sorted = rows.sort((a: any, b: any) => order[a.urgency] - order[b.urgency]);
  const total = sorted.reduce((s: number, r: any) => s + Number(r.amount_requested), 0);
  const amendedInQueue = sorted.filter((r: any) => r.currency_amended);

  return (
    <div>
      <PageTitle
        title="Approval queue"
        sub={`${sorted.length} pending · ${inr(total, { compact: true })} requested — sorted by urgency, then age`}
      />

      {amendedInQueue.length > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-[#bae6fd] bg-[#f0f9ff] p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-[#0369a1] font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0369a1] text-white text-[11px]">
              🔔
            </span>
            <span>Accounts Action Alert: Currency Amendments Logged</span>
          </div>
          <p className="mt-1 text-[#0369a1]/90 font-medium">
            {amendedInQueue.length} request(s) in this clearance queue (
            <b>{amendedInQueue.map((r: any) => r.request_no).join(", ")}</b>
            ) had their transaction currency amended after submission. Please verify foreign remittance / invoice currency before approval.
          </p>
        </div>
      )}

      <RequestTable rows={sorted} showRequester />
    </div>
  );
}
