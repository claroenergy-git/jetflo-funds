import Link from "next/link";
import { requireProfile, getFundRequests } from "@/lib/data";
import { PageTitle, Alert, btnPrimary } from "@/components/ui";
import { RequestTable } from "@/components/request-table";
import { fmtMoneyMulti, sumByCurrency } from "@/lib/format";
import { PENDING_STATUSES, isActionableBy, reviewHref, sortQueue } from "@/lib/review-queue";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function QueuePage() {
  const profile = await requireProfile();
  if (profile.role !== "finance") return <Alert kind="error">Finance team only.</Alert>;

  const rows: any[] = await getFundRequests(profile, { statusIn: PENDING_STATUSES });
  const sorted = sortQueue(rows);
  const totals = sumByCurrency(sorted, (r: any) => Number(r.amount_requested), (r: any) => r.currency);
  const amendedInQueue = sorted.filter((r: any) => r.currency_amended);

  // Review mode (REVIEW-MODE-SPEC.md): start at the first request this user can decide.
  const reviewStart = Date.now();
  const actionable = sorted.filter((r) => isActionableBy(r, profile.id));
  const first = actionable[0];

  return (
    <div>
      <PageTitle
        title="Approval queue"
        sub={`${sorted.length} pending · ${fmtMoneyMulti(totals, { compact: true })} requested — sorted by urgency, then age`}
        actions={
          first ? (
            <Link href={reviewHref(first.id, reviewStart)} className={btnPrimary}>
              Start reviewing ({actionable.length}) →
            </Link>
          ) : undefined
        }
      />

      {amendedInQueue.length > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-[#bae6fd] bg-[#f0f9ff] p-4 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-[#0369a1] font-bold">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0369a1] text-white text-[11px]">
              🔔
            </span>
            <span>Accounts Action Alert: Currency Amendments Logged</span>
          </div>
          <p className="mt-1 text-[#0369a1]/90 font-medium">
            {amendedInQueue.length} request(s) in this clearance queue (
            <b>{amendedInQueue.map((r: any) => r.request_no).join(", ")}</b>
            ) had their transaction currency amended after submission. Please verify foreign remittance / invoice currency before approval.
          </p>
        </div>
      )}

      <RequestTable rows={sorted} showRequester hrefFor={(r) => reviewHref(r.id, reviewStart)} />
    </div>
  );
}
