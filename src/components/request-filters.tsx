"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function RequestFilters({
  currentCategory,
  currentStatus,
}: {
  currentCategory?: string;
  currentStatus?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: "category" | "status", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(`/requests${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#dfd7c4] bg-white p-4 shadow-[0_4px_16px_rgba(26,40,31,0.06)]">
      <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
        {/* Category Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="filter-category" className="text-xs font-bold uppercase tracking-wider text-[#415546] whitespace-nowrap">
            Category:
          </label>
          <div className="relative flex-1 sm:w-56">
            <select
              id="filter-category"
              value={currentCategory ?? ""}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="w-full appearance-none rounded-xl border border-[#dcd4c0] bg-[#fbf9f4] px-3.5 py-2 pr-9 text-xs font-bold text-[#14261c] transition-all hover:border-[#1e3e30] focus:border-[#1e3e30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3e30]/15 cursor-pointer shadow-2xs"
            >
              <option value="">All Categories</option>
              <option value="capex">CAPEX (Plant Setup)</option>
              <option value="raw_material">Raw Material / Components</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#536658]">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="filter-status" className="text-xs font-bold uppercase tracking-wider text-[#415546] whitespace-nowrap">
            Status:
          </label>
          <div className="relative flex-1 sm:w-52">
            <select
              id="filter-status"
              value={currentStatus ?? ""}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="w-full appearance-none rounded-xl border border-[#dcd4c0] bg-[#fbf9f4] px-3.5 py-2 pr-9 text-xs font-bold text-[#14261c] transition-all hover:border-[#1e3e30] focus:border-[#1e3e30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3e30]/15 cursor-pointer shadow-2xs"
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="submitted">Submitted</option>
              <option value="paid">Paid</option>
              <option value="closed">Closed</option>
              <option value="partially_approved">Partially Approved</option>
              <option value="sent_back">Sent Back</option>
              <option value="awaiting_second_approval">Awaiting 2nd Approval</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#536658]">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Filters Reset Button */}
      {(currentCategory || (currentStatus && currentStatus !== "draft")) && (
        <button
          onClick={() => router.push("/requests")}
          className="text-xs font-bold text-[#1e3e30] hover:text-[#142d21] hover:underline cursor-pointer flex items-center gap-1"
        >
          <span>✕</span> Reset Filters
        </button>
      )}
    </div>
  );
}
