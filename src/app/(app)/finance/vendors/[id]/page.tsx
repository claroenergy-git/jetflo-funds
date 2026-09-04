import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/data";
import { PageTitle, Card } from "@/components/ui";
import { VendorApprovalActions } from "@/components/master-forms";
import { getVendorDocuments } from "@/lib/vendor-docs";
import { fmtMoney, fmtDate } from "@/lib/format";

export default async function VendorDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireProfile();
  const supabase = await getSupabase();
  const params = await props.params;
  const vendorId = params.id;

  const isFinance = profile.role === "finance";

  // Fetch vendor details
  const { data: vendor, error } = await supabase
    .from("jetflo_vendors")
    .select("*")
    .eq("id", vendorId)
    .single();

  if (error || !vendor) {
    notFound();
  }

  // Fetch verified documents with 24-hour signed URLs
  const documents = await getVendorDocuments(vendorId);

  // Fetch any fund requests associated with this vendor
  const { data: associatedRequests } = await supabase
    .from("jetflo_fund_requests")
    .select("id, request_no, item_description, amount_requested, amount_approved, currency, status, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  const isForeignVendor = Boolean(
    vendor.is_foreign || (vendor.country && vendor.country.toLowerCase() !== "india")
  );

  return (
    <div className="space-y-6">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/finance/vendors"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1e3e30] hover:underline bg-[#fbf9f4] border border-[#e5decb] px-3 py-1.5 rounded-xl transition shadow-2xs"
        >
          <span>←</span>
          <span>Back to Vendor Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          {vendor.active ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">
              <span className="h-2 w-2 rounded-full bg-[#166534]" />
              Approved & Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
              <span className="h-2 w-2 rounded-full bg-[#d97706] animate-pulse" />
              In Process (Pending Accounts Verification)
            </span>
          )}
        </div>
      </div>

      <PageTitle
        title={vendor.name}
        sub={
          vendor.trade_name
            ? `Trade Alias: ${vendor.trade_name} · ${isForeignVendor ? `Foreign Vendor (${vendor.country ?? "Overseas"})` : "Domestic Vendor"}`
            : isForeignVendor
            ? `Foreign Vendor (${vendor.country ?? "Overseas"})`
            : "Domestic Vendor (Coimbatore Plant Approved)"
        }
      />

      {/* Dual Control Compliance Lock Alert */}
      <div className="rounded-2xl border border-[#cbe1d3] bg-[#f4f9f5] p-4 text-xs text-[#2d5a44] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔒</span>
          <div>
            <div className="font-bold text-sm text-[#14261c]">
              Audited & Read-Only Vendor Record
            </div>
            <p className="text-[#536658] mt-0.5 font-medium">
              Submitted banking details and verification proofs are permanently locked against modification. Any banking amendments require formal dual-control resubmission.
            </p>
          </div>
        </div>

        {isFinance && !vendor.active && (
          <div className="shrink-0 ml-4">
            <VendorApprovalActions vendorId={vendor.id} vendorName={vendor.name} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Banking & Disbursement Details */}
        <Card variant="default">
          <div className="flex items-center justify-between mb-4 border-b border-[#e5decb] pb-3">
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
              Disbursement Banking Ledger
            </h2>
            <span className="text-[10px] font-bold text-[#536658] uppercase tracking-wider bg-[#f0ebd9] px-2 py-0.5 rounded-md border border-[#dcd4c0]">
              Verified Channel
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Bank Name</dt>
              <dd className="font-bold text-sm text-[#14261c] mt-0.5">{vendor.bank_name ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Account / IBAN Number</dt>
              <dd className="font-mono font-bold text-sm text-[#14261c] mt-0.5">{vendor.account_no ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">
                {isForeignVendor ? "SWIFT / BIC Code" : "IFSC Code"}
              </dt>
              <dd className="font-mono font-bold text-sm text-[#14261c] mt-0.5">
                {vendor.ifsc ?? vendor.swift_code ?? "—"}
              </dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Beneficiary Name</dt>
              <dd className="font-bold text-sm text-[#14261c] mt-0.5">
                {vendor.bank_beneficiary_name ?? vendor.name}
              </dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Account Type</dt>
              <dd className="capitalize font-semibold text-[#14261c] mt-0.5">{vendor.account_type ?? "Current"}</dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Jurisdiction</dt>
              <dd className="font-semibold text-[#14261c] mt-0.5">
                {isForeignVendor ? `Foreign (${vendor.country ?? "Overseas"})` : "Domestic (India)"}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Statutory & Contact Identity */}
        <Card variant="default">
          <div className="flex items-center justify-between mb-4 border-b border-[#e5decb] pb-3">
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
              Statutory & Contact Information
            </h2>
            <span className="text-[10px] font-bold text-[#536658] uppercase tracking-wider bg-[#f0ebd9] px-2 py-0.5 rounded-md border border-[#dcd4c0]">
              Tax Compliance
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">
                {isForeignVendor ? "VAT / Tax ID" : "GSTIN (15-Digit)"}
              </dt>
              <dd className="font-mono font-bold text-sm text-[#14261c] mt-0.5">
                {vendor.gstin ?? vendor.vat_no ?? "Exempt / Unregistered"}
              </dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">PAN / Tax Specimen</dt>
              <dd className="font-mono font-bold text-sm text-[#14261c] mt-0.5">{vendor.pan ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Key Contact Person</dt>
              <dd className="font-bold text-sm text-[#14261c] mt-0.5">{vendor.contact_person ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Accounts Email</dt>
              <dd className="font-medium text-xs text-[#14261c] mt-0.5 truncate">{vendor.email ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Mobile / Phone</dt>
              <dd className="font-medium text-xs text-[#14261c] mt-0.5">{vendor.phone ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Plant / Location</dt>
              <dd className="font-medium text-xs text-[#14261c] mt-0.5">
                {[vendor.city, vendor.state, vendor.country].filter(Boolean).join(", ") || "Coimbatore Plant Operations"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Verification Attachments Panel (Viewing Only) */}
      <Card variant="default">
        <div className="flex items-center justify-between mb-4 border-b border-[#e5decb] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2d5a44]" />
              Verification Attachments (Viewing Only)
            </h2>
            <p className="text-xs text-[#536658] mt-0.5">
              Original verification proofs submitted during onboarding. Available for compliance and accounts audits.
            </p>
          </div>
          <span className="text-[10px] font-bold text-[#2d5a44] bg-[#eaf3ed] px-2.5 py-1 rounded-full border border-[#cce3d4]">
            🔒 Verified & Read-Only
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-[#dcd4c0] bg-[#fbf9f4] text-xs text-[#536658]">
            No verification documents were attached during initial onboarding.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {documents.map((doc) => (
              <div
                key={doc.path}
                className="rounded-2xl border border-[#dcd4c0] bg-[#fbf9f4] p-4 flex flex-col justify-between shadow-2xs hover:border-[#1e3e30] transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d5a44] bg-[#eaf3ed] px-2.5 py-0.5 rounded-md border border-[#cce3d4]">
                      {doc.kind === "bank_proof" ? "Bank Verification Document" : "Statutory Tax Document"}
                    </span>
                    <span className="text-[10px] font-bold text-[#7a8d80]">Viewing Mode</span>
                  </div>

                  <h3 className="text-sm font-bold text-[#14261c] mt-2.5">{doc.docTypeLabel}</h3>
                  <p className="text-xs font-mono text-[#536658] mt-1 truncate" title={doc.originalName}>
                    {doc.originalName}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e5decb] flex items-center justify-between">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1e3e30] text-white hover:bg-[#2d5a44] transition shadow-xs"
                  >
                    <span>👁️ View Document</span>
                    <span className="text-[10px]">↗</span>
                  </a>

                  <a
                    href={doc.url}
                    download={doc.originalName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#536658] hover:text-[#1e3e30] hover:underline"
                  >
                    Download Copy
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Associated Fund Requests / Tickets for this Vendor */}
      {(associatedRequests ?? []).length > 0 && (
        <div className="bento-card overflow-hidden">
          <div className="border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
              Associated Fund Requests ({associatedRequests!.length})
            </h2>
            <span className="text-xs text-[#536658]">Tickets raised against this vendor</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead>
                <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                  <th className="px-6 py-3">Request No</th>
                  <th className="px-6 py-3">Item Description</th>
                  <th className="px-6 py-3 text-right">Requested Amount</th>
                  <th className="px-6 py-3 text-right">Approved Amount</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5decb]">
                {associatedRequests!.map((r) => (
                  <tr key={r.id} className="hover:bg-[#fbf9f4]">
                    <td className="px-6 py-3 font-mono font-bold text-xs text-[#1e3e30]">
                      <Link href={`/requests/${r.id}`} className="hover:underline">
                        {r.request_no} ↗
                      </Link>
                    </td>
                    <td className="px-6 py-3 font-medium text-xs text-[#14261c]">{r.item_description}</td>
                    <td className="px-6 py-3 text-right font-bold text-xs tabular-nums text-[#14261c]">
                      {fmtMoney(r.amount_requested, r.currency)}
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-xs tabular-nums text-[#166534]">
                      {r.amount_approved ? fmtMoney(r.amount_approved, r.currency) : "—"}
                    </td>
                    <td className="px-6 py-3 text-xs capitalize font-semibold text-[#536658]">{r.status}</td>
                    <td className="px-6 py-3 text-right text-xs text-[#7a8d80]">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
