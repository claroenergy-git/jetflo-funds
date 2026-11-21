import Link from "next/link";
import { requireProfile, getFundRequests } from "@/lib/data";
import { withUserContext } from "@/lib/db";
import { Alert, Card, btnPrimary, btnSecondary } from "@/components/ui";
import { PENDING_STATUSES, isActionableBy, parseReviewStart, reviewHref, sortQueue } from "@/lib/review-queue";

/* eslint-disable @typescript-eslint/no-explicit-any */

// End of review mode (REVIEW-MODE-SPEC.md).
export default async function ReviewDonePage({ searchParams }: { searchParams: Promise<{ since?: string | string[] }> }) {
  const profile = await requireProfile();
  if (profile.role !== "finance") return <Alert kind="error">Finance team only.</Alert>;

  const { since } = await searchParams;
  const start = parseReviewStart(since) ?? Date.now();

  const rows: any[] = await getFundRequests(profile, { statusIn: PENDING_STATUSES });
  const waiting = sortQueue(rows.filter((r) => isActionableBy(r, profile.id)));

  // Decisions that record the decider: approvals (first or second). Reject / send back don't
  // store who decided, so they aren't counted here.
  const approvedByMe = await withUserContext(profile.id, async (client) => {
    const res = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM jetflo_fund_requests
        WHERE decided_at >= to_timestamp($2::double precision / 1000)
          AND (approved_by = $1 OR second_approved_by = $1)`,
      [profile.id, start]
    );
    return Number(res.rows[0]?.n ?? 0);
  });

  return (
    <Card className="mx-auto max-w-xl py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#cce3d4] bg-[#eaf3ed] text-[#1e3e30]">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-extrabold tracking-tight text-[#14261c]">No more pending requests in the queue</h1>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium text-[#536658]">
        {waiting.length === 0
          ? "Every request in the queue has been decided."
          : `${waiting.length} request${waiting.length === 1 ? " is" : "s are"} still waiting — ones you skipped, or new ones submitted while you were reviewing.`}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold text-[#14261c]">
        <span className="rounded-full border border-[#e5decb] bg-[#fbf9f4] px-3 py-1">
          Approved by you <span className="tabular-nums">{approvedByMe}</span>
        </span>
        <span className="rounded-full border border-[#e5decb] bg-[#fbf9f4] px-3 py-1">
          Still waiting <span className="tabular-nums">{waiting.length}</span>
        </span>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {waiting.length > 0 && (
          <Link href={reviewHref(waiting[0].id, start)} className={btnSecondary}>
            Review remaining requests ({waiting.length})
          </Link>
        )}
        <Link href="/finance/queue" className={btnPrimary}>
          Back to approval queue
        </Link>
      </div>
    </Card>
  );
}
