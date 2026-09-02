import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle } from "@/components/ui";
import { VendorApprovalActions } from "@/components/master-forms";
import { ExpandableVendorOnboarding } from "@/components/expandable-vendor-onboarding";
import { VendorDirectoryTable, type VendorItem } from "@/components/vendor-directory-table";

export default async function VendorsPage() {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const isFinance = profile.role === "finance";

  // Fetch all vendors
  const { data: allVendors } = await supabase
    .from("jetflo_vendors")
    .select("*")
    .order("created_at", { ascending: false });

  const vendorsList = (allVendors ?? []) as VendorItem[];
  const pendingVendors = vendorsList.filter((v) => !v.active);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Vendor Master & Onboarding"
        sub={
          isFinance
            ? "Dual-Control Vendor Verification & Banking Ledger"
            : "Coimbatore Plant Approved Vendor Directory & Onboarding Tracker"
        }
      />

      {/* Finance Pending Approvals Alert / Action Banner */}
      {isFinance && pendingVendors.length > 0 && (
        <div className="bento-card border border-[#fde68a] bg-[#fffbeb] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full bg-[#d97706] animate-pulse" />
              <h2 className="text-base font-bold text-[#92400e]">
                Pending Accounts Verification ({pendingVendors.length})
              </h2>
            </div>
            <span className="text-xs font-bold text-[#92400e] bg-[#fef3c7] px-3 py-1 rounded-full border border-[#fde68a]">
              Action Required by accounts@claroenergy.in
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-[#fde68a] bg-[#fef3c7]/60 text-left text-xs font-bold uppercase tracking-wider text-[#92400e]">
                  <th className="px-4 py-3">Vendor / Entity</th>
                  <th className="px-4 py-3">GSTIN / Tax ID</th>
                  <th className="px-4 py-3">Bank Details</th>
                  <th className="px-4 py-3">IFSC / SWIFT</th>
                  <th className="px-4 py-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#fde68a]/50">
                {pendingVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-white/60">
                    <td className="px-4 py-3 font-bold text-[#14261c]">
                      <div>{v.name}</div>
                      <div className="text-[11px] text-[#92400e] font-semibold">Pending Approval</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#92400e] font-semibold">
                      {v.gstin ?? "Exempt / Unregistered"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#536658]">
                      <div className="font-bold text-[#14261c]">{v.bank_name ?? "—"}</div>
                      <div className="font-mono text-[#7a8d80]">
                        {v.account_no ? `••••${v.account_no.slice(-4)}` : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#14261c] font-semibold">{v.ifsc ?? "—"}</td>
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

      {/* Feature: Expandable Onboarding Form with Rolling UI Animation */}
      <ExpandableVendorOnboarding isFinance={isFinance} />

      {/* Interactive Vendor Directory & Approval Tracker with Status Filter */}
      <VendorDirectoryTable
        vendors={vendorsList}
        isFinance={isFinance}
        currentUserId={profile.id}
      />
    </div>
  );
}
