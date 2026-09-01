"use client";

import { useState } from "react";
import { VendorOnboardingForm } from "@/components/master-forms";

export function ExpandableVendorOnboarding({ isFinance = false }: { isFinance?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bento-card overflow-hidden transition-all duration-300 border border-[#ded5c2] shadow-[0_2px_8px_rgba(20,38,28,0.05)]">
      {/* Interactive Dropdown Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between p-5 sm:p-6 bg-[#fbf9f4] hover:bg-[#f5efe3] transition-colors cursor-pointer text-left select-none group"
      >
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf3ed] text-[#1e3e30] border border-[#cce3d4] shadow-xs group-hover:scale-105 transition-transform">
            <span className="text-lg">🏢</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-[#14261c]">
                {isFinance ? "Add / Onboard Master Vendor" : "Request Vendor Onboarding"}
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#eaf3ed] text-[#1e3e30] border border-[#cce3d4]">
                Dual-Control Form
              </span>
            </div>
            <p className="text-xs text-[#536658] mt-0.5 font-medium">
              {isFinance
                ? "Finance team direct entry with GSTIN, PAN, and Bank details"
                : "Submit vendor details with Cancelled Cheque for Accounts verification"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            isOpen
              ? "bg-[#1e3e30] text-white shadow-xs"
              : "bg-white text-[#1e3e30] border border-[#dcd4c0] shadow-2xs group-hover:border-[#1e3e30]"
          }`}>
            <span>{isOpen ? "Close Form" : "+ Open Onboarding Form"}</span>
            <svg
              className={`h-4 w-4 transform transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
      </button>

      {/* Smooth Rolling Dropdown Body */}
      <div
        className={`grid transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-6 border-t border-[#e5decb] bg-white">
            <div className="mb-4 pb-3 border-b border-[#f0ebd9] flex items-center justify-between">
              <div className="text-xs font-bold text-[#415546] uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
                <span>Fill Vendor Statutory & Banking Details</span>
              </div>
              <span className="text-[11px] text-[#7a8d80] font-semibold">* Required fields</span>
            </div>
            <VendorOnboardingForm isFinance={isFinance} />
          </div>
        </div>
      </div>
    </div>
  );
}
