import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, REQUEST_COLS } from "@/lib/data";
import { PageTitle, Alert } from "@/components/ui";
import { RequestTable } from "@/components/request-table";

export default async function ClosuresPage() {
  const profile = await requireProfile();
  if (profile.role !== "requester") return <Alert kind="error">Ground team only.</Alert>;
  const supabase = await getSupabase();

  const { data: rows } = await supabase
    .from("jetflo_fund_requests")
    .select(REQUEST_COLS)
    .eq("status", "paid")
    .order("first_paid_at", { ascending: true });

  return (
    <div>
      <PageTitle
        title="Pending closures"
        sub="Funds released but final invoice / goods receipt not yet confirmed — open a request to close it"
      />
      {(rows?.length ?? 0) > 0 && (
        <div className="mb-4">
          <Alert kind="warning">
            {rows!.length} paid request{rows!.length === 1 ? "" : "s"} awaiting invoice upload. Finance and
            leadership see these as unclosed advances.
          </Alert>
        </div>
      )}
      <RequestTable rows={rows ?? []} />
    </div>
  );
}
