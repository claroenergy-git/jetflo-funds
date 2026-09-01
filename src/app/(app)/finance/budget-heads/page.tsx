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
    <div className="space-y-6">
      <PageTitle title="Budget Heads Master" sub="CAPEX and Raw Material manufacturing budget allocations" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Sub-head</th>
                  <th className="px-5 py-3.5 text-right">Sanctioned Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5decb]">
                {(heads ?? []).map((h) => (
                  <tr key={h.id} className="hover:bg-[#fbf9f4] transition-colors">
                    <td className="px-5 py-3.5 text-xs font-semibold text-[#536658]">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        h.category === "capex" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef3c7] text-[#92400e]"
                      }`}>
                        {CATEGORY_LABEL[h.category]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-[#14261c]">{h.sub_head}</td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-[#166534]">
                      {h.sanctioned_amount ? inr(Number(h.sanctioned_amount)) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <Card className="h-fit p-5 border border-[#dcd4c0] shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-[#14261c] pb-2 border-b border-[#e5decb]">Add Budget Sub-Head</h2>
            <BudgetHeadForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
