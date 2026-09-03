import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card, Alert } from "@/components/ui";
import { RequestForm } from "@/components/request-form";

export default async function NewRequestPage() {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  if (profile.role !== "requester") {
    return <Alert kind="error">Only the ground team can raise fund requests.</Alert>;
  }

  let vendorsRes: any = await supabase.from("jetflo_vendors").select("id, name, is_foreign, country").eq("active", true).order("name");
  if (vendorsRes.error) {
    vendorsRes = await supabase.from("jetflo_vendors").select("id, name").eq("active", true).order("name");
  }

  const [{ data: heads }, { data: priorRequests }] = await Promise.all([
    supabase.from("jetflo_budget_heads").select("id, category, sub_head").eq("active", true).order("sub_head"),
    supabase.from("jetflo_fund_requests").select("id, request_no, vendor_id, amount_approved, amount_requested, item_description, status").not("status", "in", "(draft,rejected)").order("created_at", { ascending: false }),
  ]);
  const vendors = vendorsRes.data ?? [];

  return (
    <div className="max-w-2xl">
      <PageTitle title="New fund request" sub="Coimbatore Plant Procurement & Capex — Submitted requests go to Claro Accounts for dual-control approval" />
      <Card className="p-6">
        <RequestForm
          vendors={vendors ?? []}
          budgetHeads={heads ?? []}
          priorRequests={priorRequests ?? []}
        />
      </Card>
    </div>
  );
}
