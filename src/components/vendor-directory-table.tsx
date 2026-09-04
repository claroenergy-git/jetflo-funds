"use client";

import { useState } from "react";
import Link from "next/link";
import type { VendorDocument } from "@/lib/vendor-docs";

export interface VendorItem {
  id: string;
  name: string;
  trade_name?: string | null;
  gstin?: string | null;
  bank_name?: string | null;
  account_no?: string | null;
  ifsc?: string | null;
  active: boolean;
  created_at: string;
  created_by?: string | null;
  status?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  pan?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  bank_beneficiary_name?: string | null;
  account_type?: string | null;
  is_foreign?: boolean;
  country?: string | null;
  vat_no?: string | null;
  swift_code?: string | null;
  bank_doc_type?: string | null;
  documents?: VendorDocument[];
}

export function VendorDirectoryTable({
  vendors,
  isFinance = false,
  currentUserId,
}: {
  vendors: VendorItem[];
  isFinance?: boolean;
  currentUserId?: string;
}) {
  const [filter, setFilter] = useState<"all" | "in_process" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const handleOpenVendor = async (v: VendorItem) => {
    setSelectedVendor(v);
    if (!v.documents || v.documents.length === 0) {
      setLoadingDocs(true);
      try {
        const res = await fetch(`/api/vendors/${v.id}/documents`);
        if (res.ok) {
          const data = await res.json();
          if (data.documents && data.documents.length > 0) {
            setSelectedVendor((prev) =>
              prev && prev.id === v.id ? { ...prev, documents: data.documents } : prev
            );
          }
        }
      } catch (err) {
        console.error("Failed to load documents for vendor", err);
      } finally {
        setLoadingDocs(false);
      }
    }
  };

  const filtered = vendors.filter((v) => {
    // Status filter
    if (filter === "approved" && !v.active) return false;
    if (filter === "in_process" && v.active) return false;
    if (filter === "rejected" && v.active) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = v.name.toLowerCase().includes(q);
      const matchGstin = (v.gstin ?? "").toLowerCase().includes(q);
      const matchBank = (v.bank_name ?? "").toLowerCase().includes(q);
      const matchIfsc = (v.ifsc ?? "").toLowerCase().includes(q);
      const matchCountry = (v.country ?? "").toLowerCase().includes(q);
      if (!matchName && !matchGstin && !matchBank && !matchIfsc && !matchCountry) return false;
    }

    return true;
  });

  const inProcessCount = vendors.filter((v) => !v.active).length;
  const approvedCount = vendors.filter((v) => v.active).length;

  return (
    <div className="bento-card overflow-hidden">
      {/* Header with Title & Filter Tabs */}
      <div className="flex flex-col gap-4 border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1e3e30]" />
            Vendor Directory & Approval Tracker ({vendors.length})
          </h2>
          <p className="text-xs text-[#536658] mt-0.5">
            Click on any vendor record to view complete details and verification attachments
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search vendor / GSTIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-xl border border-[#dcd4c0] bg-white px-3 text-xs font-semibold text-[#14261c] placeholder-[#7a8d80] focus:border-[#1e3e30] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center rounded-xl border border-[#dcd4c0] bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                filter === "all"
                  ? "bg-[#1e3e30] text-white shadow-xs"
                  : "text-[#536658] hover:text-[#14261c] hover:bg-[#f0ebd9]"
              }`}
            >
              All ({vendors.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("in_process")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filter === "in_process"
                  ? "bg-[#d97706] text-white shadow-xs"
                  : "text-[#92400e] hover:bg-[#fef3c7]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              In Process ({inProcessCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("approved")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filter === "approved"
                  ? "bg-[#166534] text-white shadow-xs"
                  : "text-[#166534] hover:bg-[#dcfce7]"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Approved ({approvedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
              <th className="px-5 py-3.5">Vendor Legal / Trade Name</th>
              <th className="px-4 py-3.5">GSTIN / Tax ID</th>
              <th className="px-4 py-3.5">Disbursement Bank & Code</th>
              <th className="px-4 py-3.5">Verification Attachments (Read-Only)</th>
              <th className="px-4 py-3.5">Approval Status</th>
              <th className="px-4 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5decb]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-xs text-[#536658]">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0ebd9] text-[#1e3e30] text-lg">
                    🏢
                  </div>
                  {search
                    ? "No vendors match your search query."
                    : filter === "in_process"
                    ? "No vendors currently pending verification."
                    : "No vendors found in this category."}
                </td>
              </tr>
            ) : (
              filtered.map((v) => {
                const isForeignVendor = Boolean(
                  v.is_foreign || (v.country && v.country.toLowerCase() !== "india")
                );
                const isOwner = currentUserId && v.created_by === currentUserId;
                const docs = v.documents ?? [];
                const bankDoc = docs.find((d) => d.kind === "bank_proof");
                const taxDoc = docs.find((d) => d.kind === "gst_cert");

                return (
                  <tr
                    key={v.id}
                    onClick={() => handleOpenVendor(v)}
                    className="hover:bg-[#f5efe3] transition-colors cursor-pointer group select-none"
                    title="Click row to open vendor verification dossier"
                  >
                    {/* Legal / Trade Name */}
                    <td className="px-5 py-4 font-bold text-[#14261c]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[#14261c] group-hover:text-[#1e3e30] group-hover:underline">
                          {v.name}
                        </span>
                        {isForeignVendor && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                            🌍 Import / Foreign
                          </span>
                        )}
                        {isOwner && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#eaf3ed] text-[#1e3e30] border border-[#cce3d4]">
                            Submitted by You
                          </span>
                        )}
                      </div>
                      {v.trade_name && (
                        <div className="text-[11px] font-normal text-[#536658] mt-0.5">{v.trade_name}</div>
                      )}
                    </td>

                    {/* GSTIN / Tax ID */}
                    <td className="px-4 py-4 font-mono text-xs text-[#1e3e30] font-semibold">
                      {v.gstin ?? v.vat_no ?? "GST Exempt / Unregistered"}
                    </td>

                    {/* Bank Details */}
                    <td className="px-4 py-4 text-xs text-[#536658]">
                      <div className="font-bold text-[#14261c]">{v.bank_name ?? "—"}</div>
                      <div className="font-mono text-[11px] text-[#7a8d80] mt-0.5">
                        {v.ifsc ? (isForeignVendor ? `SWIFT: ${v.ifsc}` : `IFSC: ${v.ifsc}`) : "—"}
                        {v.account_no && (
                          <span className="ml-2 text-[#536658]">
                            (••••{v.account_no.slice(-4)})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Verification Attachments (Viewing, Not Editing) */}
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      {docs.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenVendor(v)}
                          className="text-[11px] text-[#1e3e30] underline hover:font-bold"
                        >
                          Check attachments
                        </button>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {bankDoc && (
                            <a
                              href={bankDoc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#eaf3ed] text-[#1e3e30] border border-[#cce3d4] hover:bg-[#d8e8dc] hover:border-[#1e3e30] transition shadow-2xs group/btn max-w-fit"
                              title={`View ${bankDoc.docTypeLabel} (${bankDoc.originalName}) - Read-only`}
                            >
                              <span className="text-xs">📄</span>
                              <span className="truncate max-w-[140px]">
                                {bankDoc.docTypeLabel.replace(/^\d+\.\s*/, "")}
                              </span>
                              <span className="text-[10px] text-[#2d5a44] group-hover/btn:translate-x-0.5 transition-transform">
                                ↗
                              </span>
                            </a>
                          )}

                          {taxDoc && (
                            <a
                              href={taxDoc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#fffbeb] text-[#92400e] border border-[#fde68a] hover:bg-[#fef3c7] hover:border-[#d97706] transition shadow-2xs group/btn max-w-fit"
                              title={`View ${taxDoc.docTypeLabel} (${taxDoc.originalName}) - Read-only`}
                            >
                              <span className="text-xs">📜</span>
                              <span className="truncate max-w-[140px]">
                                {isForeignVendor ? "VAT / Tax Cert" : "GST Certificate"}
                              </span>
                              <span className="text-[10px] text-[#b45309] group-hover/btn:translate-x-0.5 transition-transform">
                                ↗
                              </span>
                            </a>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      {v.active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#166534]" />
                          Approved & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#d97706] animate-pulse" />
                          In Process (Pending Accounts)
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenVendor(v)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#1e3e30] text-white hover:bg-[#2d5a44] transition cursor-pointer shadow-2xs"
                        title="Open Vendor Details and Attachments"
                      >
                        <span>👁️</span>
                        <span>Open</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Read-Only Vendor Verification Dossier Modal */}
      {selectedVendor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedVendor(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#cbe1d3] bg-[#fbf9f4] p-6 shadow-2xl space-y-5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-[#e5decb] pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#eaf3ed] text-[#1e3e30] border border-[#cce3d4]">
                    🔒 Locked Verification Record (Read-Only)
                  </span>
                  {selectedVendor.active ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">
                      Approved & Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                      In Process (Pending Accounts)
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-[#14261c] mt-2 flex items-center gap-2">
                  <span>{selectedVendor.name}</span>
                </h2>
                {selectedVendor.trade_name && (
                  <p className="text-xs text-[#536658]">Trade Alias: {selectedVendor.trade_name}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/finance/vendors/${selectedVendor.id}`}
                  className="text-xs font-bold text-[#1e3e30] hover:underline bg-[#eaf3ed] px-2.5 py-1 rounded-lg border border-[#cce3d4]"
                  title="Open Dedicated Full Page"
                >
                  Full Page ↗
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedVendor(null)}
                  className="rounded-lg p-1.5 text-[#536658] hover:bg-[#e5decb] hover:text-[#14261c] transition cursor-pointer text-sm font-bold"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Read-only Alert Notice */}
            <div className="rounded-xl border border-[#d8e8dc] bg-[#f4f9f5] p-3 text-xs text-[#2d5a44] flex items-center gap-2 font-medium">
              <span className="text-base">🛡️</span>
              <span>
                <b>Dual-Control Compliance:</b> Bank proofs and statutory documents submitted for this vendor are securely locked against editing to preserve auditing integrity for Ground and Accounts teams.
              </span>
            </div>

            {/* Verification Attachments (Read-Only) */}
            <div className="rounded-xl border border-[#d8e8dc] bg-[#f4f9f5] p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-[#1e3e30] flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#2d5a44]" />
                  Uploaded Verification Attachments (Viewing Only)
                </div>
                <span className="text-[10px] font-bold text-[#2d5a44] bg-[#eaf3ed] px-2 py-0.5 rounded-full border border-[#cce3d4]">
                  🔒 Verified & Locked
                </span>
              </div>

              {loadingDocs ? (
                <div className="p-6 text-center text-xs text-[#536658] animate-pulse">
                  Loading verification attachments from secure storage…
                </div>
              ) : !selectedVendor.documents || selectedVendor.documents.length === 0 ? (
                <div className="p-4 rounded-xl border border-[#dcd4c0] bg-white text-center text-xs text-[#536658]">
                  No verification documents were attached during onboarding.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedVendor.documents.map((doc, idx) => (
                    <div
                      key={doc.path || idx}
                      className="rounded-xl border border-[#dcd4c0] bg-white p-3.5 flex flex-col justify-between shadow-2xs hover:border-[#1e3e30] transition"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2d5a44] bg-[#eaf3ed] px-2 py-0.5 rounded-md border border-[#cce3d4]">
                            {doc.kind === "bank_proof" ? "Bank Verification" : "Tax / Statutory Proof"}
                          </span>
                          <span className="text-[10px] font-medium text-[#7a8d80]">
                            Read-Only
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-[#14261c] mt-2">
                          {doc.docTypeLabel}
                        </h3>
                        <p className="text-[11px] font-mono text-[#536658] truncate mt-0.5" title={doc.originalName}>
                          {doc.originalName}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-[#f0ebd9] flex items-center justify-between">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1e3e30] text-white hover:bg-[#2d5a44] transition shadow-2xs"
                        >
                          <span>👁️ View Document</span>
                          <span className="text-[10px]">↗</span>
                        </a>
                        <a
                          href={doc.url}
                          download={doc.originalName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-[#536658] hover:text-[#1e3e30] hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Banking & Disbursement Ledger */}
            <div className="rounded-xl border border-[#e5decb] bg-white p-4 space-y-3 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#1e3e30] flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
                Banking & Disbursement Details
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Disbursement Bank</span>
                  <div className="font-bold text-[#14261c] mt-0.5">{selectedVendor.bank_name ?? "—"}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Account / IBAN Number</span>
                  <div className="font-mono font-bold text-[#14261c] mt-0.5">
                    {selectedVendor.account_no ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">
                    {selectedVendor.is_foreign ? "SWIFT / BIC Code" : "IFSC Code"}
                  </span>
                  <div className="font-mono font-bold text-[#14261c] mt-0.5">
                    {selectedVendor.ifsc ?? selectedVendor.swift_code ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Beneficiary Name</span>
                  <div className="font-medium text-[#14261c] mt-0.5">
                    {selectedVendor.bank_beneficiary_name ?? selectedVendor.name}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Account Type</span>
                  <div className="capitalize font-medium text-[#14261c] mt-0.5">
                    {selectedVendor.account_type ?? "Current"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Jurisdiction</span>
                  <div className="font-medium text-[#14261c] mt-0.5">
                    {selectedVendor.is_foreign
                      ? `Foreign (${selectedVendor.country ?? "Overseas"})`
                      : "Domestic (India)"}
                  </div>
                </div>
              </div>
            </div>

            {/* Statutory & Entity Information */}
            <div className="rounded-xl border border-[#e5decb] bg-white p-4 space-y-3 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#1e3e30] flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
                Statutory & Contact Information
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">GSTIN / VAT ID</span>
                  <div className="font-mono font-bold text-[#14261c] mt-0.5">
                    {selectedVendor.gstin ?? selectedVendor.vat_no ?? "Exempt / Unregistered"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">PAN / Tax Specimen</span>
                  <div className="font-mono font-bold text-[#14261c] mt-0.5">
                    {selectedVendor.pan ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Contact Person</span>
                  <div className="font-medium text-[#14261c] mt-0.5">
                    {selectedVendor.contact_person ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Email (Accounts)</span>
                  <div className="font-medium text-[#14261c] mt-0.5">
                    {selectedVendor.email ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Phone / Mobile</span>
                  <div className="font-medium text-[#14261c] mt-0.5">
                    {selectedVendor.phone ?? "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#7a8d80]">Address / Plant Location</span>
                  <div className="font-medium text-[#14261c] mt-0.5">
                    {[selectedVendor.city, selectedVendor.state, selectedVendor.country]
                      .filter(Boolean)
                      .join(", ") || "Coimbatore Plant Operations"}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 flex items-center justify-between">
              <Link
                href={`/finance/vendors/${selectedVendor.id}`}
                className="text-xs font-bold text-[#1e3e30] hover:underline"
              >
                View Full Page with Associated Tickets ↗
              </Link>
              <button
                type="button"
                onClick={() => setSelectedVendor(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1e3e30] text-white hover:bg-[#2d5a44] transition cursor-pointer shadow-xs"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
