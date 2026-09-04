import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle } from "@/components/ui";
import { VendorApprovalActions } from "@/components/master-forms";
import { ExpandableVendorOnboarding } from "@/components/expandable-vendor-onboarding";
import { VendorDirectoryTable, type VendorItem } from "@/components/vendor-directory-table";
import { getVendorDocumentsMap } from "@/lib/vendor-docs";

export default async function VendorsPage() {
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const isFinance = profile.role === "finance";

  // Fetch all vendors
  const { data: allVendors } = await supabase
    .from("jetflo_vendors")
    .select("*")
    .order("created_at", { ascending: false });

  // Fetch all vendor verification documents (24hr signed URLs)
  const docsMap = await getVendorDocumentsMap();

  const vendorsList = ((allVendors ?? []) as any[]).map((v) => ({
    ...v,
    documents: docsMap[v.id] ?? [],
  })) as VendorItem[];

  const pendingVendors = vendorsList.filter((v) => !v.active);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Vendor Master & Onboarding"
        sub={
          isFinance
            ? "Dual-Control Vendor Verification & Banking Ledger (Audited & Locked)"
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
            <table className="w-full min-w-[750px] text-sm">
              <thead>
                <tr className="border-b border-[#fde68a] bg-[#fef3c7]/60 text-left text-xs font-bold uppercase tracking-wider text-[#92400e]">
                  <th className="px-4 py-3">Vendor / Entity</th>
                  <th className="px-4 py-3">GSTIN / Tax ID</th>
                  <th className="px-4 py-3">Bank Details</th>
                  <th className="px-4 py-3">IFSC / SWIFT</th>
                  <th className="px-4 py-3">Verification Attachments (Read-Only)</th>
                  <th className="px-4 py-3 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#fde68a]/50">
                {pendingVendors.map((v) => {
                  const docs = v.documents ?? [];
                  const bankDoc = docs.find((d) => d.kind === "bank_proof");
                  const taxDoc = docs.find((d) => d.kind === "gst_cert");

                  return (
                    <tr key={v.id} className="hover:bg-white/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14261c]">
                        <Link
                          href={`/finance/vendors/${v.id}`}
                          className="hover:underline hover:text-[#92400e] flex items-center gap-1 group"
                          title="Open full vendor record and verification dossier"
                        >
                          <span>{v.name}</span>
                          <span className="text-[10px] text-[#92400e] opacity-70 group-hover:opacity-100">↗</span>
                        </Link>
                        <div className="text-[11px] text-[#92400e] font-semibold">Pending Approval</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#92400e] font-semibold">
                        {v.gstin ?? v.vat_no ?? "Exempt / Unregistered"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#536658]">
                        <div className="font-bold text-[#14261c]">{v.bank_name ?? "—"}</div>
                        <div className="font-mono text-[#7a8d80]">
                          {v.account_no ? `••••${v.account_no.slice(-4)}` : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#14261c] font-semibold">
                        {v.ifsc ?? v.swift_code ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {docs.length === 0 ? (
                          <span className="text-xs text-[#7a8d80] italic">No document attached</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {bankDoc && (
                              <a
                                href={bankDoc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#1e3e30] hover:underline bg-white px-2 py-1 rounded border border-[#d8e8dc] shadow-2xs group max-w-fit"
                                title={`Inspect Bank Proof: ${bankDoc.originalName}`}
                              >
                                <span>📄</span>
                                <span className="truncate max-w-[140px]">
                                  {bankDoc.docTypeLabel.replace(/^\d+\.\s*/, "")}
                                </span>
                                <span className="text-[10px] text-[#2d5a44] group-hover:translate-x-0.5 transition-transform">
                                  ↗
                                </span>
                              </a>
                            )}
                            {taxDoc && (
                              <a
                                href={taxDoc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#92400e] hover:underline bg-white px-2 py-1 rounded border border-[#fde68a] shadow-2xs group max-w-fit"
                                title={`Inspect Tax Cert: ${taxDoc.originalName}`}
                              >
                                <span>📜</span>
                                <span className="truncate max-w-[140px]">
                                  {v.is_foreign ? "VAT Cert" : "GST Certificate"}
                                </span>
                                <span className="text-[10px] text-[#b45309] group-hover:translate-x-0.5 transition-transform">
                                  ↗
                                </span>
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <VendorApprovalActions vendorId={v.id} vendorName={v.name} />
                      </td>
                    </tr>
                  );
                })}
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
