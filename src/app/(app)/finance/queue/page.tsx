import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, REQUEST_COLS } from "@/lib/data";
import { PageTitle, Alert } from "@/components/ui";
import { RequestTable } from "@/components/request-table";
import { inr } from "@/lib/format";

export default async function QueuePage() {
  const profile = await requireProfile();
  if (profile.role !== "finance") return <Alert kind="error">Finance team only.</Alert>;
  const supabase = await getSupabase();

  const { data: rows } = await supabase
    .from("jetflo_fund_requests")
    .select(REQUEST_COLS)
    .in("status", ["submitted", "awaiting_second_approval"])
    .order("submitted_at", { ascending: true });

  const order = { critical: 0, urgent: 1, normal: 2 } as Record<string, number>;
  const sorted = (rows ?? []).sort((a, b) => order[a.urgency] - order[b.urgency]);
  const total = sorted.reduce((s, r) => s + Number(r.amount_requested), 0);

  return (
    <div>
      <PageTitle
        title="Approval queue"
        sub={`${sorted.length} pending · ${inr(total, { compact: true })} requested — sorted by urgency, then age`}
      />
      <RequestTable rows={sorted} showRequester />
    </div>
  );
}
