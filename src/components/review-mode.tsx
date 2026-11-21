// Review mode for the finance approval queue — server components. Spec: REVIEW-MODE-SPEC.md
import Link from "next/link";
import { Card } from "@/components/ui";
import { fmtMoney } from "@/lib/format";
import { STATUS_LABEL, type Status } from "@/lib/types";
import { reviewHref, reviewDoneHref } from "@/lib/review-queue";

/* eslint-disable @typescript-eslint/no-explicit-any */

const barBtn =
  "inline-flex items-center justify-center rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20";
const barBtnDisabled =
  "inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/40 cursor-not-allowed";

export function ReviewBar({
  start,
  prev,
  next,
  before,
  after,
  canSkip,
}: {
  start: number;
  prev: { id: string } | null;
  next: { id: string } | null;
  before: number;
  after: number;
  canSkip: boolean;
}) {
  const skipHref = next ? reviewHref(next.id, start) : reviewDoneHref(start);
  return (
    <div className="sticky top-3 z-30 rounded-2xl bg-[#1e3e30] px-4 py-3 text-white shadow-[0_8px_24px_-8px_rgba(20,38,28,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold">Reviewing the approval queue</div>
          <div className="text-[11.5px] font-medium text-[#cfe3d6]">
            {before} pending before this · {after} after
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {prev ? (
            <Link href={reviewHref(prev.id, start)} className={barBtn}>
              ← Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={barBtnDisabled}>
              ← Previous
            </span>
          )}
          {canSkip && (
            <Link href={skipHref} className={barBtn}>
              Skip →
            </Link>
          )}
          <Link href="/finance/queue" className="px-2 py-1.5 text-xs font-bold text-[#cfe3d6] hover:text-white">
            Exit review
          </Link>
        </div>
      </div>
      {!prev && (
        <div className="mt-2.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold">No pending requests before this</div>
      )}
    </div>
  );
}

/** Compact facts shown above the decision panel so the approver can decide without scrolling. */
export function ReviewDecisionSummary({ r, attachmentCount }: { r: any; attachmentCount: number }) {
  const facts: [string, string][] = [
    ["Amount requested", fmtMoney(r.amount_requested, r.currency)],
    ["Vendor", r.vendor?.name ?? "—"],
    ["Requested by", r.requester?.name ?? "—"],
    ["Documents", attachmentCount ? `${attachmentCount} attached — see below` : "None attached"],
  ];
  return (
    <div className="mb-4 space-y-3 border-b border-[#e5d5be] pb-4">
      <div className="text-sm font-bold text-[#14261c]">{r.item_description}</div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[#e5decb] bg-white/80 px-3 py-2">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">{k}</dt>
            <dd className="mt-0.5 text-[13px] font-bold text-[#14261c]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function outcomeLine(r: any): string {
  const no = r.request_no;
  const approved = fmtMoney(r.amount_approved, r.currency);
  switch (r.status as Status) {
    case "approved":
      return `Approved ${no} for ${approved}`;
    case "partially_approved":
      return `Partially approved ${no} for ${approved}`;
    case "awaiting_second_approval":
      return `First approval recorded for ${no} (${approved}) — waiting for a second approver`;
    case "rejected":
      return `Rejected ${no}`;
    case "sent_back":
      return `Sent ${no} back to ${r.requester?.name ?? "the requester"}`;
    case "draft":
      return `${no} was withdrawn by the requester`;
    default:
      return `${no} is ${STATUS_LABEL[r.status as Status] ?? r.status} — no decision needed`;
  }
}

export function ReviewDonePanel({ r, start, next }: { r: any; start: number; next: any | null }) {
  return (
    <Card variant="emerald">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#166534] text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <div>
          <div className="text-[15px] font-bold text-[#166534]">{outcomeLine(r)}</div>
          <div className="mt-0.5 text-xs font-medium text-[#536658]">Recorded in the audit trail.</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#c4decd] pt-4">
        <div className="min-w-0 text-xs font-medium text-[#536658]">
          {next ? (
            <>
              Up next: <b className="text-[#14261c]">{next.request_no}</b> · {next.vendor?.name ?? "—"} ·{" "}
              <b className="tabular-nums text-[#14261c]">{fmtMoney(next.amount_requested, next.currency)}</b>
            </>
          ) : (
            "No more pending requests after this one."
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/finance/queue"
            className="inline-flex items-center justify-center rounded-xl border border-[#dcd4c0] bg-white px-4 py-2.5 text-sm font-semibold text-[#14261c] transition hover:bg-[#f2ece0]"
          >
            Back to queue
          </Link>
          <Link
            href={next ? reviewHref(next.id, start) : reviewDoneHref(start)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3e30] px-5 py-2.5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(30,62,48,0.2)] transition hover:bg-[#142d21]"
          >
            Move to next request →
          </Link>
        </div>
      </div>
    </Card>
  );
}
