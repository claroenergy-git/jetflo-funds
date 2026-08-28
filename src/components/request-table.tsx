import Link from "next/link";
import { Card, StatusChip } from "@/components/ui";
import { inr, fmtDate, daysSince } from "@/lib/format";
import { CATEGORY_LABEL, URGENCY_STYLE, type Status } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RequestTable({ rows, showRequester = false }: { rows: any[]; showRequester?: boolean }) {
  if (!rows.length) {
    return (
      <Card className="p-12 text-center text-sm text-[#8E9CA6]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-amber-400 text-xl shadow-[0_0_15px_rgba(245,166,35,0.15)]">
          📋
        </div>
        No fund requests found matching this filter.
      </Card>
    );
  }

  return (
    <div className="bento-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-left text-xs font-bold uppercase tracking-wider text-[#8E9CA6]">
              <th className="px-6 py-3.5">Request No & Details</th>
              <th className="px-6 py-3.5">Classification</th>
              <th className="px-6 py-3.5">Beneficiary / Vendor</th>
              <th className="px-6 py-3.5 text-right">Requested</th>
              <th className="px-6 py-3.5 text-right">Approved</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Aging / Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.03] transition-colors group">
                <td className="px-6 py-4">
                  <Link
                    href={`/requests/${r.id}`}
                    className="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
                  >
                    <span>{r.request_no}</span>
                    <span className="opacity-0 group-hover:opacity-100 text-xs transition-opacity">➔</span>
                  </Link>
                  <div className="max-w-[280px] truncate text-xs text-[#8E9CA6] mt-0.5">{r.item_description}</div>
                  {showRequester && r.requester && (
                    <div className="text-[11px] font-medium text-[#5F6E77] mt-0.5">Raised by: {r.requester.name}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      r.category === "capex"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {CATEGORY_LABEL[r.category]}
                  </span>
                  <div className="text-[11px] font-medium text-[#8E9CA6] mt-1">{r.budget_head?.sub_head}</div>
                </td>
                <td className="max-w-[170px] truncate px-6 py-4 text-xs font-semibold text-slate-200">
                  {r.vendor?.name}
                </td>
                <td className="px-6 py-4 text-right font-bold tabular-nums text-white">
                  {inr(r.amount_requested)}
                </td>
                <td className="px-6 py-4 text-right font-bold tabular-nums text-emerald-300">
                  {r.amount_approved ? inr(r.amount_approved) : "—"}
                </td>
                <td className="px-6 py-4">
                  <StatusChip status={r.status as Status} />
                  {r.duplicate_warning && (
                    <span title="Possible duplicate detected within 7 days" className="ml-1.5 text-xs text-amber-400 font-bold">
                      ⚠
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-xs">
                  <span className={`font-bold ${URGENCY_STYLE[r.urgency]}`}>
                    {r.urgency !== "normal" ? `${r.urgency.toUpperCase()} · ` : ""}
                  </span>
                  <span className="font-bold text-white">{daysSince(r.submitted_at ?? r.created_at)}d</span>
                  <div className="text-[11px] text-[#5F6E77] mt-0.5">{fmtDate(r.submitted_at ?? r.created_at)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
