import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, REQUEST_COLS } from "@/lib/data";
import { PageTitle } from "@/components/ui";
import { RequestTable } from "@/components/request-table";
import { STATUS_LABEL, type Status } from "@/lib/types";

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

  const mkHref = (s?: string, c?: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (c) p.set("category", c);
    const qs = p.toString();
    return `/requests${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title={profile.role === "requester" ? "My Fund Requests" : "All Fund Requests"}
        sub={`${rows?.length ?? 0} request${(rows?.length ?? 0) === 1 ? "" : "s"} logged in ledger`}
        actions={
          profile.role === "requester" ? (
            <Link
              href="/requests/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E88C38] to-[#F5A623] px-4 py-2 text-xs font-bold text-[#090C10] shadow-[0_0_15px_rgba(245,166,35,0.3)] hover:scale-[1.02] transition"
            >
              + Raise New Request
            </Link>
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2">
        <Link
          href={mkHref(undefined, category)}
          className={`rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition ${
            !status
              ? "border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,166,35,0.2)]"
              : "border-white/10 bg-white/5 text-[#8E9CA6] hover:bg-white/10 hover:text-white"
          }`}
        >
          All Statuses
        </Link>
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <Link
            key={s}
            href={mkHref(s, category)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              status === s
                ? "border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,166,35,0.2)]"
                : "border-white/10 bg-white/5 text-[#8E9CA6] hover:bg-white/10 hover:text-white"
            }`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}

        <span className="mx-1 h-5 border-l border-white/10" />

        {[
          ["capex", "CAPEX (Plant)"],
          ["raw_material", "Raw Material"],
        ].map(([c, label]) => (
          <Link
            key={c}
            href={mkHref(status, category === c ? undefined : c)}
            className={`rounded-xl border px-3.5 py-1.5 text-xs font-bold transition ${
              category === c
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                : "border-white/10 bg-white/5 text-[#8E9CA6] hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <RequestTable rows={rows ?? []} showRequester={profile.role !== "requester"} />
    </div>
  );
}
