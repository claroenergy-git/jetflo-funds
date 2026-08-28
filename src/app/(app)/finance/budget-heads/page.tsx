import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card, Alert } from "@/components/ui";
import { BudgetHeadForm } from "@/components/master-forms";
import { inr } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/types";

export default async function BudgetHeadsPage() {
  const profile = await requireProfile();
  if (profile.role !== "finance") return <Alert kind="error">Finance team only.</Alert>;
  const supabase = await getSupabase();
  const { data: heads } = await supabase
    .from("jetflo_budget_heads")
    .select("*")
    .order("category")
    .order("sub_head");

  return (
    <div>
      <PageTitle title="Budget heads" sub="CAPEX sub-heads carry a sanctioned budget" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Sub-head</th>
                <th className="px-4 py-2.5 text-right font-medium">Sanctioned</th>
              </tr>
            </thead>
            <tbody>
              {(heads ?? []).map((h) => (
                <tr key={h.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-xs text-slate-500">{CATEGORY_LABEL[h.category]}</td>
                  <td className="px-4 py-2.5 font-medium">{h.sub_head}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {h.sanctioned_amount ? inr(Number(h.sanctioned_amount)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-3 text-sm font-semibold">Add budget head</h2>
          <BudgetHeadForm />
        </Card>
      </div>
    </div>
  );
}
