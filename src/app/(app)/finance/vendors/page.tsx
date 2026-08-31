import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card, Alert } from "@/components/ui";
import { VendorOnboardingForm, VendorApprovalActions } from "@/components/master-forms";

export default async function VendorsPage() {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const isFinance = profile.role === "finance";

  // Fetch all vendors
  const { data: allVendors } = await supabase
    .from("jetflo_vendors")
    .select("*")
    .order("created_at", { ascending: false });

  const pendingVendors = (allVendors ?? []).filter((v) => !v.active);
  const approvedVendors = (allVendors ?? []).filter((v) => v.active);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Vendor Master & Onboarding"
        sub={
          isFinance
            ? "Dual-Control Vendor Verification & Banking Ledger"
            : "Coimbatore Plant Approved Vendor Directory & Onboarding"
        }
      />

      {/* Finance Pending Approvals Alert / Banner */}
      {isFinance && pendingVendors.length > 0 && (
        <div className="bento-card border border-amber-500/30 bg-amber-500/[0.04] p-5 shadow-[0_0_25px_rgba(245,166,35,0.15)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_#f5a623]" />
              <h2 className="text-base font-bold text-amber-300">
                Pending Accounts Verification ({pendingVendors.length})
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Action Required by accounts@claroenergy.in
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-left text-xs font-bold uppercase tracking-wider text-[#8E9CA6]">
                  <th className="px-4 py-3">Vendor / Entity</th>
                  <th className="px-4 py-3">GSTIN / PAN</th>
                  <th className="px-4 py-3">Bank Details</th>
                  <th className="px-4 py-3">IFSC</th>
                  <th className="px-4 py-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-bold text-white">
                      <div>{v.name}</div>
                      <div className="text-[11px] text-[#8E9CA6] font-normal">Pending Approval</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-amber-300">
                      {v.gstin ?? "Exempt / Unregistered"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <div className="font-semibold text-white">{v.bank_name ?? "—"}</div>
                      <div className="font-mono text-[#8E9CA6]">
                        {v.account_no ? `••••${v.account_no.slice(-4)}` : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{v.ifsc ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <VendorApprovalActions vendorId={v.id} vendorName={v.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Grid: Directory & Onboarding Form */}
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* Approved Vendor Directory */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Approved Vendors ({approvedVendors.length})
            </h2>
            <span className="text-xs text-[#8E9CA6]">Universal Across Categories</span>
          </div>

          <div className="bento-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-left text-xs font-bold uppercase tracking-wider text-[#8E9CA6]">
                    <th className="px-5 py-3.5">Vendor Name</th>
                    <th className="px-5 py-3.5">GSTIN</th>
                    <th className="px-5 py-3.5">Disbursement Bank</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {approvedVendors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-xs text-[#8E9CA6]">
                        No approved vendors found. Use the onboarding form to add vendors.
                      </td>
                    </tr>
                  ) : (
                    approvedVendors.map((v) => (
                      <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{v.name}</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-amber-300/90">
                          {v.gstin ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-300">
                          <div className="font-semibold">{v.bank_name ?? "—"}</div>
                          <div className="font-mono text-[11px] text-[#8E9CA6]">
                            {v.ifsc && `IFSC: ${v.ifsc}`}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Onboarding Form Card */}
        <div>
          <Card className="p-5 sticky top-20 border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="mb-4 pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-amber-400">🏢</span>
                <span>{isFinance ? "Add / Onboard Vendor" : "Request Vendor Onboarding"}</span>
              </h2>
              <p className="text-[11px] text-[#8E9CA6] mt-1">
                {isFinance
                  ? "Finance team direct master entry with bank details"
                  : "Ground team submission for accounts@claroenergy.in verification"}
              </p>
            </div>
            <VendorOnboardingForm isFinance={isFinance} />
          </Card>
        </div>
      </div>
    </div>
  );
}
