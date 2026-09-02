"use client";

import { useState } from "react";
import { inr } from "@/lib/format";

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
      if (!matchName && !matchGstin && !matchBank && !matchIfsc) return false;
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
            {isFinance
              ? "Universal vendor master ledger and verification pipeline"
              : "Track the verification status of your onboarded vendors"}
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
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
              <th className="px-6 py-3.5">Vendor Legal / Trade Name</th>
              <th className="px-6 py-3.5">GSTIN / Tax ID</th>
              <th className="px-6 py-3.5">Disbursement Bank & Code</th>
              <th className="px-6 py-3.5 text-right">Approval Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5decb]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-xs text-[#536658]">
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
                const isForeignVendor = v.ifsc && v.ifsc.length <= 11 && !/^[A-Z]{4}0/.test(v.ifsc);
                const isOwner = currentUserId && v.created_by === currentUserId;

                return (
                  <tr key={v.id} className="hover:bg-[#fbf9f4] transition-colors">
                    <td className="px-6 py-4 font-bold text-[#14261c]">
                      <div className="flex items-center gap-2">
                        <span>{v.name}</span>
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
                    <td className="px-6 py-4 font-mono text-xs text-[#1e3e30] font-semibold">
                      {v.gstin ?? "GST Exempt / Unregistered"}
                    </td>
                    <td className="px-6 py-4 text-xs text-[#536658]">
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
                    <td className="px-6 py-4 text-right">
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
