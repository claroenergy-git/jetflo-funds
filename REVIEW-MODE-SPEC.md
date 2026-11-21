# Review Mode (Approval Queue) — Spec

**Status:** Done — built 2026-11-21 · no database change
**Mockup:** https://claude.ai/artifact/HXFrbo5x5XLcW8fdio5DiC (approved 2026-11-21)
**Related:** [PROPOSED-FEATURES.md](PROPOSED-FEATURES.md) · approval rules in `src/app/actions.ts` (`financeDecide`)

## Overview

Accounts used to open each request from the queue, scroll to the decision panel, decide, go back
to the queue and open the next one. Review mode lets them work through the queue one request
after another: each request opens with the decision panel in view, and after a decision a
**Move to next request** button opens the next pending one.

## Requirements

- [x] Queue page (`/finance/queue`) gets a **Start reviewing (N) →** button that opens the first
      request the user can act on. Clicking a queue row also opens that request in review mode.
- [x] In review mode (`/requests/[id]?review=<start>`), the decision panel is shown first, under
      the header, with a short summary (item, vendor, amount, documents). Full details stay below.
- [x] A review bar on top shows how many requests are pending before/after this one, with
      **← Previous**, **Skip →** and **Exit review**.
- [x] After any decision (approve, partial, send back, reject, or first approval that parks a
      request for a second approver) the panel becomes a confirmation with
      **Move to next request →**, naming the next request, plus **Back to queue**.
- [x] Previous / Skip / Next move only between requests the user can still act on:
      status `submitted`, or `awaiting_second_approval` where the user was **not** the first
      approver (the DB trigger rejects a self second-approval).
- [x] When nothing pending comes before the current request, Previous is disabled and the bar
      says **"No pending requests before this"**.
- [x] Moving past the last pending request opens `/finance/queue/review-done`:
      **"No more pending requests in the queue"**, with the number of approvals the user made
      since starting review, how many are still waiting, and a button back to those.
- [x] The list is recomputed from the database on every page load, so requests decided by a
      colleague in the meantime drop out.
- [x] Finance role only (the queue page is finance-only). Approval rules, remarks rules and
      emails are unchanged — this is navigation only.

## Order

Same as the queue page, one shared definition (`src/lib/review-queue.ts`):
urgency (critical → urgent → normal), then `submitted_at` oldest first, then id as a tiebreak.
Previous/next are found by comparing the current request's sort key with the pending ones, so
they still work after the current request has been decided and left the pending list.

## DB changes

None. The review-done tally counts `jetflo_fund_requests` with `decided_at` since the review
started and `approved_by` / `second_approved_by` = the user. Reject and send-back don't record
who decided (and `financeDecide` writes through the service login, so the audit log's actor is
empty for finance decisions), so only approvals are counted.

## API changes

None. Uses the existing `financeDecide` server action; its `revalidatePath` re-renders the page
into the confirmation state.

## UI

- `src/components/review-mode.tsx` — `ReviewBar`, `ReviewDecisionSummary`, `ReviewDonePanel` (server components).
- `src/app/(app)/requests/[id]/page.tsx` — review-mode layout.
- `src/app/(app)/finance/queue/page.tsx` — Start reviewing button; rows link into review mode.
- `src/app/(app)/finance/queue/review-done/page.tsx` — end screen.
- `src/components/request-table.tsx` — optional `hrefSuffix` prop.

Differences from the mockup: the per-request progress dots are replaced by "N pending before ·
M after", because the server keeps no per-session skip list. The end screen counts every
request still waiting (skipped ones, plus any submitted meanwhile).

## Tests

`npm test` (Node's built-in runner, `scripts/tests/review-queue.test.mjs`) covers the pure logic:
ordering, actionable filter (incl. self second-approval excluded), previous/next in the middle,
at the start, at the end, after the current request was decided, unknown urgency, missing
`submitted_at`, and review-start parsing.
