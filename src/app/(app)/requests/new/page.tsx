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

  const [{ data: vendors }, { data: heads }] = await Promise.all([
    supabase.from("jetflo_vendors").select("id, name, category").eq("active", true).order("name"),
    supabase.from("jetflo_budget_heads").select("id, category, sub_head").eq("active", true).order("sub_head"),
  ]);

  return (
    <div className="max-w-2xl">
      <PageTitle title="New fund request" sub="Submitted requests go to the Claro finance team for approval" />
      <Card className="p-5">
        <RequestForm vendors={vendors ?? []} budgetHeads={heads ?? []} />
      </Card>
    </div>
  );
}
