import Link from "next/link";
import { Card, StatusChip } from "@/components/ui";
import { inr, fmtMoney, fmtDate, daysSince } from "@/lib/format";
import { CATEGORY_LABEL, type Status } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RequestTable({ rows, showRequester = false }: { rows: any[]; showRequester?: boolean }) {
  if (!rows.length) {
    return (
      <Card className="p-12 text-center text-sm text-[#536658]">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#dcd4c0] bg-[#fbf9f4] text-[#1e3e30] text-xl shadow-xs">
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
            <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
              <th className="px-6 py-3.5">Request No & Details</th>
              <th className="px-6 py-3.5">Classification</th>
              <th className="px-6 py-3.5">Beneficiary / Vendor</th>
              <th className="px-6 py-3.5 text-right">Requested</th>
              <th className="px-6 py-3.5 text-right">Approved</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Aging / Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5decb]">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-[#fbf9f4] transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/requests/${r.id}`}
                      className="font-extrabold text-[#1e3e30] hover:text-[#142d21] hover:underline flex items-center gap-1 transition-colors"
                    >
                      <span>{r.request_no}</span>
                      <span className="opacity-0 group-hover:opacity-100 text-xs transition-opacity">➔</span>
                    </Link>
                    {(r.currency || "").toUpperCase() === "USD" && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]">
                        USD
                      </span>
                    )}
                    {r.currency_amended && (
                      <span title={`Formally amended to ${r.currency || "USD"}`} className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                        💱 Amended
                      </span>
                    )}
                  </div>
                  <div className="max-w-[280px] truncate text-xs text-[#536658] mt-0.5 font-medium">{r.item_description}</div>
                  {showRequester && r.requester && (
                    <div className="text-[11px] font-semibold text-[#7a8d80] mt-0.5">Raised by: {r.requester.name}</div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      r.category === "capex"
                        ? "bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]"
                        : "bg-[#fef3c7] text-[#92400e] border border-[#fde68a]"
                    }`}
                  >
                    {CATEGORY_LABEL[r.category]}
                  </span>
                  <div className="text-[11px] font-semibold text-[#536658] mt-1">{r.budget_head?.sub_head}</div>
                </td>
                <td className="max-w-[170px] truncate px-6 py-4 text-xs font-bold text-[#14261c]">
                  {r.vendor?.name} {r.vendor?.is_foreign ? "🌐" : ""}
                </td>
                <td className="px-6 py-4 text-right font-bold tabular-nums text-[#14261c]">
                  {fmtMoney(r.amount_requested, r.currency)}
                </td>
                <td className="px-6 py-4 text-right font-bold tabular-nums text-[#166534]">
                  {r.amount_approved ? fmtMoney(r.amount_approved, r.currency) : "—"}
                </td>
                <td className="px-6 py-4">
                  <StatusChip status={r.status as Status} />
                  {r.duplicate_warning && (
                    <span title="Possible duplicate detected within 7 days" className="ml-1.5 text-xs text-[#b45309] font-bold">
                      ⚠
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right text-xs">
                  <span className="font-bold text-[#14261c]">{daysSince(r.submitted_at ?? r.created_at)}d</span>
                  <div className="text-[11px] text-[#7a8d80] font-medium mt-0.5">{fmtDate(r.submitted_at ?? r.created_at)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
