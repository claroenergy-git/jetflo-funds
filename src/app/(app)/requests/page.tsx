import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, REQUEST_COLS } from "@/lib/data";
import { PageTitle } from "@/components/ui";
import { RequestTable } from "@/components/request-table";
import { RequestFilters } from "@/components/request-filters";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const { status, category } = await searchParams;
  const profile = await requireProfile();
  const supabase = await getSupabase();

  let q = supabase.from("jetflo_fund_requests").select(REQUEST_COLS).order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  if (category) q = q.eq("category", category);
  const { data: rows } = await q;

  const isDraft = status === "draft";
  const isAllStatuses = !status || status !== "draft";

  return (
    <div className="space-y-6">
      <PageTitle
        title={profile.role === "requester" ? "My Fund Requests" : "All Fund Requests"}
        sub={`${rows?.length ?? 0} request${(rows?.length ?? 0) === 1 ? "" : "s"} logged in ledger`}
        actions={
          profile.role === "requester" ? (
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e3e30] px-4 py-2.5 text-xs font-bold text-white shadow-[0_2px_8px_rgba(30,62,48,0.2)] hover:bg-[#142d21] hover:scale-[1.02] transition cursor-pointer"
            >
              + Raise New Request
            </Link>
          ) : undefined
        }
      />

      {/* Primary Section Tabs: All Statuses & Drafts */}
      <div className="flex items-center gap-2 border-b border-[#e5decb] pb-3">
        <Link
          href={category ? `/requests?category=${category}` : "/requests"}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            isAllStatuses
              ? "bg-[#1e3e30] text-white shadow-xs"
              : "text-[#536658] hover:bg-[#f0ebd9] hover:text-[#14261c]"
          }`}
        >
          All Statuses
        </Link>
        <Link
          href={category ? `/requests?status=draft&category=${category}` : "/requests?status=draft"}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            isDraft
              ? "bg-[#1e3e30] text-white shadow-xs"
              : "text-[#536658] hover:bg-[#f0ebd9] hover:text-[#14261c]"
          }`}
        >
          Drafts
        </Link>
      </div>

      {/* Dropdown Filters for Category & Status */}
      {isAllStatuses && (
        <RequestFilters currentCategory={category} currentStatus={status} />
      )}

      {/* Requests Ledger Table */}
      <RequestTable rows={rows ?? []} showRequester={profile.role !== "requester"} />
    </div>
  );
}
