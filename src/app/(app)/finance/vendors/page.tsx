import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle } from "@/components/ui";
import { VendorApprovalActions } from "@/components/master-forms";
import { ExpandableVendorOnboarding } from "@/components/expandable-vendor-onboarding";

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
                  <th className="px-4 py-3">GSTIN / PAN</th>
                  <th className="px-4 py-3">Bank Details</th>
                  <th className="px-4 py-3">IFSC</th>
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

      {/* Approved Vendor Directory Card */}
      <div className="bento-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#166534]" />
              Approved Vendors Directory ({approvedVendors.length})
            </h2>
            <p className="text-xs text-[#536658] mt-0.5">Universal directory across CAPEX & Raw Material</p>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">
            Active Master
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-sm">
            <thead>
              <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                <th className="px-6 py-3.5">Vendor Legal & Trade Name</th>
                <th className="px-6 py-3.5">GSTIN & Tax ID</th>
                <th className="px-6 py-3.5">Disbursement Bank & Account</th>
                <th className="px-6 py-3.5 text-right">Directory Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5decb]">
              {approvedVendors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-xs text-[#536658]">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ebd9] text-[#1e3e30] text-lg">
                      🏢
                    </div>
                    No approved vendors found in directory. Use the onboarding form above to add vendors.
                  </td>
                </tr>
              ) : (
                approvedVendors.map((v) => {
                  const isForeignVendor = v.ifsc && v.ifsc.length <= 11 && !/^[A-Z]{4}0/.test(v.ifsc);
                  return (
                    <tr key={v.id} className="hover:bg-[#fbf9f4] transition-colors">
                      <td className="px-6 py-4 font-bold text-[#14261c]">
                        <div className="flex items-center gap-2">
                          <span>{v.name}</span>
                          <span className="h-2 w-2 rounded-full bg-[#166534]" />
                          {isForeignVendor && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                              🌍 Import / Foreign
                            </span>
                          )}
                        </div>
                        {v.trade_name && (
                          <div className="text-[11px] font-normal text-[#536658] mt-0.5">{v.trade_name}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[#1e3e30] font-semibold">
                        {v.gstin ?? "GST Exempt / Unregistered"}
                      </td>
                      <td className="px-6 py-4 text-xs text-[#536658]">
                        <div className="font-bold text-[#14261c]">{v.bank_name ?? "—"}</div>
                        <div className="font-mono text-[11px] text-[#7a8d80] mt-0.5">
                          {v.ifsc ? (isForeignVendor ? `SWIFT: ${v.ifsc}` : `IFSC: ${v.ifsc}`) : "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
