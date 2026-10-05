# Purchase Orders — Spec

**Status:** v1 shipped (`009_purchase_orders.sql`, `010_fix_po_status_recalc_transition.sql`,
`011_po_procedure_enhancements.sql`) · v2.0 roadmap drafted, not yet built — see §7
**Decided so far:**
- Finance-only issue POs (mirrors vendor onboarding's dual-control model)
- POs above a configurable threshold (default ₹10,00,000) require a second, different
  finance approver before the PO is usable — same dual-control pattern as fund-request
  approval above ₹5,00,000
- Forward-only: existing historical requests are left untouched, no backfill
- A PO is generated as an editable **draft** first — pre-filled from a request/quotation
  or started blank — and only becomes a real, numbered, vendor-facing document when
  finance explicitly clicks **Issue**. Nothing is sent or locked before that click.
- A PO carries **itemized line items** (description, qty, rate, tax per line), not a
  single lump value — `total_value` is the sum of its lines.

---

## 1. Why

Today "purchase order" is just a value in the `kind` check-constraint on
`jetflo_attachments` — someone can upload a PDF and call it a PO, but nothing generates
one, numbers it, or checks invoices against it. This spec makes a PO a real object with a
value and a running balance, so:

- A vendor invoicing three times against one order gets blocked once the PO's value is
  exhausted, not caught after the fact on a dashboard.
- Finance gets a real numbered document to hand a vendor.
- Leadership gets a "committed but not yet billed" view per vendor/order, not just per
  budget-head.

---

## 2. Data model

### New table `jetflo_purchase_orders`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `po_number` | text, unique, **nullable** | assigned only at **Issue**, not at draft creation — keeps the numbered sequence audit-clean (no gaps from abandoned drafts). Same trigger pattern as `jetflo_assign_request_no()`, fired on the `draft → issued` transition instead of on insert. |
| `vendor_id` | fk → `jetflo_vendors` | one PO = one vendor |
| `budget_head_id` | fk → `jetflo_budget_heads` | |
| `category` | text, check (`capex`\|`raw_material`) | inherited from budget head |
| `currency` | text, check (`INR`\|`USD`) | |
| `total_value` | numeric | **computed** — kept in sync with the sum of `jetflo_purchase_order_items.line_total` by trigger, never hand-typed |
| `status` | text | `draft` → `pending_second_approval` → `open` → `partially_billed` → `fully_billed` / `cancelled` |
| `source_request_id` | fk → `jetflo_fund_requests`, nullable | set when the draft was generated from "Issue PO from this request"; purely informational, doesn't restrict editing |
| `created_by` | fk → `jetflo_users` | must be finance role |
| `approved_by` | fk → `jetflo_users`, nullable | the second approver, only set when threshold is exceeded |
| `issued_at`, `approved_at`, `created_at`, `updated_at` | timestamptz | `issued_at` is null while still `draft` |
| `notes` | text, nullable | free-text terms/description shown on the generated document |

### New table `jetflo_purchase_order_items`

One row per line on the PO — same shape as the line-item fields your fund requests
already have (`qty`, `unit_rate`, `tax_percent`, `tax_amount`, `round_off`), so the form
and the calculation logic can be lifted from `request-form.tsx` rather than invented
fresh.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `purchase_order_id` | fk → `jetflo_purchase_orders` | |
| `item_description` | text | |
| `product_sku` | text, nullable | |
| `qty` | numeric | |
| `unit_rate` | numeric | |
| `tax_percent` | numeric, nullable | |
| `tax_amount` | numeric, nullable | |
| `round_off` | numeric, nullable | |
| `line_total` | numeric | `qty * unit_rate + tax + round_off`, same formula already used in `createRequest` ([actions.ts:157-161](src/app/actions.ts#L157-L161)) |
| `sort_order` | int | display order on the generated document |

Only editable while the parent PO is `draft`. Once issued, rows are frozen — a
post-issue change to quantity/rate goes through the same amendment mechanic as a
value change (see §6.2 below), not a direct edit.

### New setting

`jetflo_settings` gets a new row: `po_second_approver_above`, default `1000000`, editable
on the existing Governance Settings page next to `second_approver_above` — no schema
change needed there, it's the same key/value table.

### `jetflo_fund_requests` gets one new column

`po_id`, nullable fk → `jetflo_purchase_orders`. A request can, but doesn't have to,
reference a PO. Only meaningful when `payment_type` is `against_invoice` or `balance` —
an `advance` request is, by definition, not billed against a pre-existing order.

---

## 3. State machine

```
  (auto-generated, pre-filled — or started blank)
              │
              ▼
            draft ──(finance edits vendor / budget head / line items / notes freely)──┐
              │                                                                       │
              │ finance clicks "Issue"                                                │
              │  → po_number assigned, PDF generated                                  │
              ▼                                                                       │
   total_value ≤ threshold ───────────────────────────────► open                      │
              │                                               ▲                       │
              │ total_value > threshold                       │                       │
              ▼                                                                       │
   pending_second_approval ──(2nd finance user approves)──────┘                       │
              │                                                                       │
              └──(rejected)──► cancelled ◄────────────────────(discard, any time)──────┘

  open ──(a linked request gets its first payment)──► partially_billed
  partially_billed ──(cumulative billed = total_value)──► fully_billed
```

- **`draft`**: fully editable, nothing vendor-facing exists yet — no number, no PDF, no
  email sent. Can be discarded freely, no audit trail needed (it was never a real
  document). Nothing can be linked to it from a fund request while it's in this state.
- **Issue** is the one-way door: assigns `po_number`, freezes the line items, generates
  the PDF, and — once past any second-approval step — emails it to the vendor's
  `contact_person`/`email` on file. Before this click, nothing leaves the database.
- **`pending_second_approval`**: issued in the numbering sense (has a `po_number`) but
  not yet usable — no request can be linked to it, and the vendor email doesn't fire
  until a second, different finance user approves. Same shape as awaiting-second-approval
  fund requests today.
- **`fully_billed`** is terminal for billing purposes but not read-only for history — the
  PO stays visible with its full request list.
- A PO can only be cancelled while still `draft` (trivial — nothing was ever issued) or
  while `open`/`pending_second_approval` with nothing linked to it yet. Cancelling an
  issued PO that already has linked, paid requests isn't offered as an action; if a
  mistake needs undoing at that point, it's a manual finance conversation, not a button.

---

## 4. Where the check plugs into `createRequest` / approval

Two places, mirroring how the *duplicate-vendor* check ([actions.ts:176-187](src/app/actions.ts#L176-L187))
and the *state-transition trigger* ([001_jetflo_schema_core.sql:224](supabase/migrations/001_jetflo_schema_core.sql#L224))
already work — one soft warning in the app layer, one hard stop in the database:

1. **At request creation** (`createRequest`, app layer): if `po_id` is set, compute the
   PO's remaining balance (`total_value` − sum of `amount_requested` for every
   non-rejected request already linked to it) and show it in the form / return a warning
   if this request would exceed it. This is advisory — lets the requester fix the amount
   before submitting.
2. **At approval** (DB trigger, same trigger that already validates state transitions):
   if the request being approved has a `po_id`, recompute cumulative **approved** amounts
   linked to that PO and raise an exception if this approval would push the total past
   `total_value`. This is the hard stop — the one that can't be bypassed by a client with
   just the publishable key, consistent with how every other rule in this app is enforced.

Recomputing "cumulative billed" needs a decision: is the ceiling checked against
`amount_requested`, `amount_approved`, or `amount_paid` summed across linked requests?
Proposed: **`amount_approved`** — it's the number finance has actually committed to, and
it's already the same figure used for the CAPEX-utilization "committed" column, so the
PO table can reuse identical arithmetic.

---

## 5. UI changes

- **`finance/purchase-orders`** — list (grouped by status, drafts visually distinct from
  issued POs) + "New Draft PO" entry point, finance-only. Same layout as the existing
  Budget Heads page.
- **"Issue PO from this request"** — a button on an approved request's detail page
  ([requests/[id]/page.tsx](src/app/(app)/requests/[id]/page.tsx)) that creates a `draft`
  PO with one line item pre-filled from that request's `item_description` / `qty` /
  `unit_rate` / `tax_percent`, and `source_request_id` set — saves finance from retyping,
  doesn't restrict what they can then change.
- **`finance/purchase-orders/[id]`** — the draft editor and the issued-PO detail view are
  the same page, gated by status:
  - **while `draft`**: vendor, budget head, currency, notes, and the line-item table are
    all editable inline (add/remove/edit rows, same line-total math as the request form);
    a running `total_value` updates live; an "Issue" button replaces the edit controls
    once finance is satisfied.
  - **once issued**: read-only header + line items, a link to the generated PDF, the
    remaining balance, every linked request, and an "Approve" button visible only to a
    second finance user when status is `pending_second_approval`.
- **Request form**: when `payment_type` is `against_invoice` or `balance`, an optional
  "Link to PO" selector (vendor-filtered, only shows `open`/`partially_billed` POs)
  showing live remaining balance.
- **Dashboard**: a "PO Utilization" table — total value vs. billed vs. paid per PO,
  reusing the existing progress-bar component from the CAPEX utilization table
  ([dashboard/page.tsx:374-434](src/app/(app)/dashboard/page.tsx#L374-L434)) rather than
  building a new one.

---

## 6. Auto-generation, document & delivery (settled)

- **Draft pre-fill**: either blank (finance starts from scratch) or seeded from an
  approved request via "Issue PO from this request" (§5). Either way it's just a normal,
  fully-editable `draft` row — no special "generated" state to reason about.
- **Document generation**: on the `draft → issued` transition, render a PDF from the PO's
  header + line items + vendor's own master data (name, GSTIN, bank details, address —
  already on `jetflo_vendors`), store it in the existing `jetflo-docs` bucket alongside
  the other request attachments.
- **Vendor delivery**: once a PO reaches `open` (immediately if under threshold, or after
  second approval if not), email the generated PDF to the vendor's `contact_person` /
  `email`. Never fires from `draft` or `pending_second_approval`.

## 6.2 Decisions (settled)

1. **Rejected/sent-back requests free their PO balance immediately.** The moment a
   linked request leaves `submitted`/`awaiting_second_approval` via rejection or a
   send-back, it drops out of the "cumulative approved against this PO" sum used by the
   approval-time trigger (§4) — enforced by scoping that sum to requests whose status is
   in the active/approved/paid set, not by a separate release step.
2. **Issued POs can be amended, logged the same way currency amendments are today.**
   Amending a `open`/`partially_billed` PO's line items requires a reason, keeps a
   before/after snapshot (mirroring `currency_amended` / `previous_amount` /
   `currency_amendment_reason` on `jetflo_fund_requests`), and surfaces on the dashboard
   alert banner alongside currency amendments so leadership sees both kinds of
   after-the-fact changes in one place. `total_value` is recomputed from the amended
   lines; if the amendment reduces value below what's already been approved against it,
   the trigger from §4 blocks the amendment itself (can't shrink a PO below what's
   already committed).
3. **Currency must match.** A request's `currency` must equal its PO's `currency` for
   `po_id` to be set — enforced as a check in the same trigger that validates the
   approval, not just a UI-level filter, so it can't be bypassed via direct API access
   either.
4. **RLS**: everyone can `select` (read) issued POs; `draft` POs are visible only to
   finance (a half-written draft shouldn't appear on anyone else's screen); only finance
   can `insert`/`update`/edit line items. Second-approval `update` (the `approved_by` /
   status flip) needs the same "different user than creator" check the fund-request
   trigger already does at [001_jetflo_schema_core.sql:224](supabase/migrations/001_jetflo_schema_core.sql#L224).

## 6.3 Shipped beyond this spec's original scope

`011_po_procedure_enhancements.sql` landed alongside v1 and isn't reflected above —
recorded here so this file stays the accurate source rather than drifting from the
migrations:

- **Logistics header fields**: `order_date`, `expected_delivery_date`, `destination_plant`,
  `reference_no` (vendor quote/proforma #), `payment_terms`, `transporter_name`, `lr_no`.
- **Goods receipt (GRN)**: `jetflo_purchase_receives` / `jetflo_purchase_receive_items`,
  a per-line `qty_received`, and a trigger-maintained `receive_status`
  (`pending` → `partially_received` → `received`) on the parent PO.
- **Ground team can draft**: RLS was widened so a `requester` — not just `finance` — can
  create and edit their own `draft` PO (plant teams raising a draft for finance to
  review), with **Issue** still finance-only.

None of this needed a spec revision at the time; it's folded in here so the next
person reads one accurate document instead of the migration diff.

---

# 7 — Version 2.0 roadmap

**Status:** Draft — proposed, not yet built. Nothing below gets implemented until each
item is pulled into its own dated addendum here (per the docs-first rule: spec before
code) and, for anything schema-shaped, confirmed rather than assumed.

**Visual reference:** every widget in this section has a mocked-up dashboard card in
the companion concept board — ask for the "PO Control Tower" artifact link if it isn't
already in hand. The mockups use placeholder vendors/numbers; nothing in them is live
data.

The throughline across all seven tracks: v1 made a PO a real object with a balance.
v2.0 makes that object *informative* — it should tell finance and leadership things they
'd otherwise have to notice by hand: a vendor's price creeping up, a delivery running
late, an invoice that doesn't match what actually arrived, an approval that's been
sitting for two days. Each track below is a candidate spec, not a commitment — order of
build is a separate conversation.

## 7.A — Sourcing & vendor intelligence

*Everything that should inform a draft before it's created.*

| # | Feature | Why | Data model shape (proposed) |
|---|---|---|---|
| A1 | **RFQ / comparative quotation** | A PO today records only the winning vendor — there's no trace of who else was asked or what they quoted, so "why this vendor" is undocumented and price comparison is manual. | New `jetflo_rfqs` (one per sourcing event) + `jetflo_rfq_quotes` (one row per vendor response: rate, lead time, validity). "Convert to draft PO" copies the winning quote's lines the same way "Issue PO from this request" copies a request's line today. |
| A2 | **Vendor rate-card / price history** | Nothing today stops a PO being issued at a rate well above the last one paid for the same SKU — this is the gap the Command Deck's price-variance widget depends on. | Derived, not stored: query `jetflo_purchase_order_items` by `product_sku` + `vendor_id`, ordered by the parent PO's `issued_at`. A materialized view if the query gets expensive at scale. |
| A3 | **Vendor scorecard** | Vendor standing is currently a name and a GSTIN — nothing rolls up delivery or quality history to inform the next PO. | Derived from GRN disposition (A-group ↔ C-group overlap: needs C2's accepted/rejected split) and `expected_delivery_date` vs. actual receipt date, rolled up per vendor. Surfaced on the vendor directory and inline when a vendor is picked on a new draft. |
| A4 | **Preferred / restricted flags at PO creation** | `jetflo_vendors` likely already carries an active/category flag; it's not surfaced at the moment a vendor is picked on a draft, only on the vendor directory page. | UI-only — read the existing vendor row, badge it in the `<select>`/picker. |

## 7.B — Commercial structures

*Shapes a single PO ↔ single delivery ↔ single bill doesn't cover.*

| # | Feature | Why | Data model shape (proposed) |
|---|---|---|---|
| B1 | **Blanket / rate-contract POs** | Recurring raw-material buys (e.g. an annual steel rate contract) don't fit "one PO, one delivery" — today each release would need its own PO, losing the annual-ceiling view. | `jetflo_purchase_orders.po_type` (`standard` \| `blanket`), a `validity_from`/`validity_to`, and a new `jetflo_po_release_orders` table (own line items, own delivery date) that draws down the parent's ceiling — same balance-check trigger shape as §4, scoped to release totals instead of request totals. |
| B2 | **PO templates** | A monthly recurring buy from the same vendor is re-typed from scratch every time. | `jetflo_po_templates` storing vendor, budget head, line-item shape and terms; "New Draft PO from template" pre-fills exactly like "Issue PO from this request" does today. |
| B3 | **Structured payment milestones** | `payment_terms` is free text (per §6.3) — nothing reads it, so "Raise Fund Request from this PO" can't suggest the right amount for the next tranche. | New `jetflo_po_payment_milestones` (label, percent-or-amount, trigger condition e.g. `on_dispatch`). The linked-request form reads open milestones instead of a blank amount field. |
| B4 | **Landed cost for import (USD) POs** | Freight/customs/insurance on an import order are invisible costs today — `total_value` is only the vendor's own line items. | Extra line-item `cost_type` (`goods` \| `freight` \| `customs` \| `insurance`), rolled into a computed landed unit cost shown alongside the vendor rate, USD POs only. |
| B5 | **Short-close a line** | A vendor who can't fulfil the remainder of a line leaves that quantity "pending" forever with no way to release its value back to the PO balance. | A `short_closed` flag + reason on `jetflo_purchase_order_items`; the balance-check in §4 excludes short-closed remainder from "still committable." |
| B6 | **Stale-PO flag** | An `open` PO with no GRN or linked request activity for 60+ days is currently invisible — it just sits there consuming budget-head headroom. | Derived: `updated_at` vs. now, surfaced as a dashboard list, no schema change. |

## 7.C — Three-way match & quality

*The dashboard already promises "3-Way Match tracking" (see the empty-state copy on
`finance/purchase-orders`) — today it shows PO/GRN/billed totals side by side but never
reconciles them. This track makes that copy true.*

| # | Feature | Why | Data model shape (proposed) |
|---|---|---|---|
| C1 | **Automated 3-way match** | Nothing today checks that a linked fund request's amount is consistent with what was actually received (GRN qty × PO rate) — only that it fits inside the PO's total balance (§4). A vendor can be paid in full for a short delivery and nothing flags it. | A check run at fund-request approval, alongside `jetflo_check_po_balance`: compare cumulative invoiced qty/value per line against cumulative `qty_received`. Outside tolerance (see C3) → block approval with a named variance, same pattern as the existing balance-exceeded exception. |
| C2 | **GRN quality disposition** | `qty_received` today is one number — there's no "received but rejected on inspection" state, so a rejected delivery reads identically to a good one. | `jetflo_purchase_receive_items` gains `qty_accepted`, `qty_rejected`, `rejection_reason`; `qty_received` on the parent line becomes `qty_accepted` for match purposes. |
| C3 | **Configurable match tolerance** | A rigid 100% match on quantity/rate would false-flag every rounding difference. | A setting (mirrors `po_second_approver_above`'s pattern) — e.g. `po_match_tolerance_percent`, default 2. |

## 7.D — Approvals & controls

*A single fixed value threshold (§2, `po_second_approver_above`) is a rule, not a
policy — this track makes the policy configurable and makes sure nothing waits
silently.*

| # | Feature | Why | Data model shape (proposed) |
|---|---|---|---|
| D1 | **Configurable multi-tier approval matrix** | Every category above the threshold needs exactly one second approver today, regardless of category or how far above threshold it is. | New `jetflo_po_approval_rules` (category, value band, approver count/role), replacing the single settings key. The state-machine trigger in `011` reads this table instead of one constant. |
| D2 | **Approval delegation** | A PO stuck in `pending_second_approval` because the only other finance user is on leave has no path forward today except waiting. | `jetflo_approval_delegations` (delegator, delegate, date range); the "different user than creator" check in the transition trigger accepts the delegate too. |
| D3 | **SLA & escalation** | Nothing currently times how long a PO sits in `pending_second_approval` — the audit log records the eventual approval, not the wait. | A scheduled check (existing job runner, if one exists — otherwise a cron) flags POs past an SLA setting and escalates per D1's matrix. |

## 7.E — Vendor collaboration & alerts

*v1 emails a PDF and stops. This track gives the vendor a step to act on and gets the
alerts that matter onto a phone, not just into the app.*

| # | Feature | Why | Data model shape (proposed) |
|---|---|---|---|
| E1 | **Vendor acknowledgement** | Once a PO is emailed (§6, "vendor delivery"), there's no signal back — finance doesn't know if the vendor even opened it, let alone agreed to the delivery date. | A signed, expiring link on the emailed PDF; vendor response (`acknowledged` \| `disputed`, optional counter-date) lands as a new PO timeline step and an audit-log row, no vendor login required. |
| E2 | **WhatsApp / SMS to plant ground team** | Delivery-due reminders and GRN prompts are in-app only; the people at the loading dock aren't necessarily the people with the app open. | Reuses whatever transactional messaging provider is chosen for the requester-facing app (if any exists already — otherwise a new integration decision, flag for ADR). |
| E3 | **Automated finance digest** | The "what needs me today" view only exists if someone opens the dashboard. | A scheduled job querying the same three sources the Command Deck's funnel/heatmap/variance widgets already use, formatted as email + optional WhatsApp. |

## 7.F — Command Deck analytics

*Direct extensions of the existing "PO Utilization" table
([dashboard/page.tsx](src/app/(app)/dashboard/page.tsx)) — the leadership view §1 of
this spec originally promised ("committed but not yet billed... per vendor/order") but
the shipped table only ever showed GRN and billed progress bars, not the budget-head
commitment layer.*

| # | Feature | Why |
|---|---|---|
| F1 | **Committed-but-not-billed layer on budget utilization** | Closes the exact gap §1 called out: the CAPEX/Raw-Material utilization tables show sanctioned vs. approved, never the open-PO value sitting in between. Three-segment bar: billed / PO-committed / available. |
| F2 | **Vendor spend concentration** | Surfaces concentration risk (e.g. one vendor holding 40% of a category's open commitment) that's invisible in a flat PO list. |
| F3 | **Delivery reliability heatmap** | Rolls up the per-PO "Overdue" chip (already on the PO list today) into a per-vendor, per-week pattern — a single late PO is noise, a vendor consistently 6+ days late is signal. |
| F4 | **Price variance alerts feed** | Surfaces A2's rate-card check as a ranked list — the biggest recent jumps first — instead of something finance has to go looking for. |
| F5 | **Approval funnel with SLA breach highlight** | Shows where POs are actually stuck (draft too long / second-approval too long) rather than just current counts per status. |

## 7.G — Documents, compliance & integration

*Lower visual footprint than F, same "one integration point, not a one-off script"
principle.*

| # | Feature | Why |
|---|---|---|
| G1 | **E-signature on the issued PDF** | The document handed to a vendor today is letterhead + data, no signature. |
| G2 | **GSTIN / e-invoice cross-check** | Nothing currently validates a linked invoice's GSTIN or tax math against the vendor master before a fund request approves against a PO. |
| G3 | **Accounting export (Tally / Zoho)** | Issued POs and recorded GRNs currently live only in JetFlo — every downstream accounting entry is re-keyed by hand. |
| G4 | **Mobile GRN capture with photo** | `LogGoodsReceiptPanel` (§5) is a desktop-shaped form today; the plant gate is not a desk — a phone-first flow with a delivery-challan photo attached to the GRN record removes the "type it in later" step. |

---

Next step for any of the above: pick one item, write it as its own dated spec section
under this file (or split into its own file if it grows past a few hundred lines —
matching how `009`/`010`/`011` split by concern rather than landing as one migration),
get the schema/API questions in it answered, *then* build.
