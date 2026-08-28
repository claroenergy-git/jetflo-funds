import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card, Alert } from "@/components/ui";
import { VendorForm } from "@/components/master-forms";

export default async function VendorsPage() {
  const profile = await requireProfile();
  if (profile.role !== "finance") return <Alert kind="error">Finance team only.</Alert>;
  const supabase = await getSupabase();
  const { data: vendors } = await supabase.from("jetflo_vendors").select("*").order("name");

  return (
    <div>
      <PageTitle title="Vendor master" sub={`${vendors?.length ?? 0} vendors`} />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">GSTIN</th>
                <th className="px-4 py-2.5 font-medium">Bank</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
              </tr>
            </thead>
            <tbody>
              {(vendors ?? []).map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{v.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{v.gstin ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {v.bank_name ?? "—"} {v.ifsc && <span className="text-slate-400">· {v.ifsc}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs capitalize text-slate-500">{v.category.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-3 text-sm font-semibold">Add vendor</h2>
          <VendorForm />
        </Card>
      </div>
    </div>
  );
}
