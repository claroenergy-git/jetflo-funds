# Proposed Features — Discussion Notes

**Status:** Discussion only — nothing in this file has been built.
**Purpose:** Consolidates everything proposed/decided in the efficiency review session,
so it isn't lost in chat history. One item (Purchase Orders) went all the way to a full
spec and has its own file: [PURCHASE-ORDERS-SPEC.md](PURCHASE-ORDERS-SPEC.md).

---

## 1. Efficiency review of the current app

Starting point: the app ([README.md](README.md), [HANDOVER.md](HANDOVER.md)) is a
DB-enforced fund request → approval → payment → closure workflow with a leadership
dashboard, but everything on it is **pull-based** — nobody is notified of anything, they
have to go look. The recommendations below all follow from that observation.

### Top 3 (highest leverage, recommended to build first)

1. **Notifications.** Already flagged as the #1 known gap in
   [HANDOVER.md:184](HANDOVER.md#L184). Nobody currently gets told when a request needs
   attention. Start with email (cheaper than WhatsApp Business API, same effect) on:
   submit → finance, approaching/entering `awaiting_second_approval` → both approvers,
   paid-unpaid crossing 30 days → requester + finance, currency amendment → finance.

2. **Budget hard-stop at submission, not just after the fact.** The dashboard already
   computes CAPEX sanctioned-vs-committed-vs-paid
   ([dashboard/page.tsx:94-114](src/app/(app)/dashboard/page.tsx#L94-L114)), but nothing
   stops a sub-head going over 100% until leadership happens to notice. The existing
   duplicate-vendor check pattern in
   [actions.ts:176-187](src/app/actions.ts#L176-L187) (check → warn → let finance decide)
   applied to budget-head utilization would catch overruns before they're committed.

3. **SLA breach escalation, not just TAT averages.** `daysSince` is already rendered per
   row ([request-table.tsx:92](src/components/request-table.tsx#L92)) and the dashboard
   shows average approval/pay days
   ([dashboard/page.tsx:82-92](src/app/(app)/dashboard/page.tsx#L82-L92)), but there's no
   count of requests *currently breaching* SLA and no escalation. Add a "stuck > N days"
   KPI plus auto-escalation to leadership.

### Also discussed, not yet prioritized

4. **Cash-flow forecast, not just historical run-rate.** "Funds In Flight"
   ([dashboard/page.tsx:76-78](src/app/(app)/dashboard/page.tsx#L76-L78)) already
   aggregates approved-unpaid + awaiting-approval; combine with the already-computed
   average payment TAT to project *when* that money actually leaves the account (next
   7/14/30 days), instead of only showing the RM run-rate chart in hindsight.

5. **Vendor risk/concentration signals.** The vendor directory and "Top Suppliers by
   Spend" chart already surface concentration %, but nothing flags it. Add: (a) alert
   when one vendor exceeds ~25% of a category's spend, (b) expiring GST/bank-proof
   document warnings, (c) a per-vendor on-time-settlement / rejection-rate score.

6. **XLSX export** instead of CSV ([README.md:80](README.md#L80)) — multi-sheet
   (payments, CAPEX utilization, vendor summary) rather than one flat file.

7. **Approval funnel view** — submitted → 1st approval → 2nd approval → paid → closed as
   one conversion/drop-off chart, to expose exactly where requests bottleneck (currently
   only inferable by cross-referencing three separate tables).

8. **Generated Supabase types** ([HANDOVER.md:187](HANDOVER.md#L187)) and **tests on the
   transition trigger** ([HANDOVER.md:195](HANDOVER.md#L195)) — not user-facing, but the
   trigger is the app's actual business logic, and currently the only untested part of a
   system whose whole value proposition is auditability.

---

## 2. Purchase Orders — fully specced

Full detail: [PURCHASE-ORDERS-SPEC.md](PURCHASE-ORDERS-SPEC.md). Summary of what was
decided in this session:

- **Finance-only issuance**, mirroring the existing vendor-onboarding dual-control model.
- **Draft → Issue lifecycle**: a PO is generated as a fully editable `draft` (either
  blank or pre-filled via a one-click "Issue PO from this request" action on an approved
  request) — vendor, budget head, currency, notes, and line items can all be changed
  freely. Clicking **Issue** is the one-way door: assigns the `po_number`, freezes the
  line items, generates a PDF (pulling vendor master data), and — once past
  second-approval if applicable — emails it to the vendor's `contact_person`/`email`.
- **Itemized line items**, not a single lump value — same shape as the line-item fields
  fund requests already have (qty, unit rate, tax, round-off); `total_value` is the sum.
- **Second-approver required above a configurable threshold**, default ₹10,00,000
  (new `po_second_approver_above` setting, editable on the existing Governance Settings
  page next to `second_approver_above`).
- **Forward-only** — existing historical fund requests are left untouched, no backfill.
- **Amendments allowed on issued POs**, logged the same way currency amendments are
  today (reason required, before/after snapshot, surfaced on the dashboard alert
  banner); an amendment can't shrink a PO below what's already been approved against it.
- **Currency must match** between a PO and any fund request linked to it — enforced in
  the same DB trigger that validates the approval, not just a UI filter.
- **Rejected/sent-back requests free their reserved PO balance immediately** — they
  simply drop out of the "cumulative approved against this PO" sum the approval trigger
  checks.
- **Three-way-match enforcement**: the balance check runs twice — a soft warning at
  request creation (app layer), a hard stop at approval time (DB trigger), matching the
  existing split between the duplicate-vendor check and the state-transition trigger.

**Build order**: migration (table, line-items table, sequence, triggers, RLS) → server
actions → UI (PO list/draft-editor/detail pages, link-to-PO field on the request form,
dashboard "PO Utilization" table).

---

## 3. Suggested next step

Purchase Orders is the only item here that's fully specced and ready for a migration.
Recommended build order overall: **Purchase Orders → Notifications → Budget hard-stop →
SLA escalation** — the rest of §1 stays a backlog until picked up.
