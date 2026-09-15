# Purchase Orders — Spec (Draft, for discussion)

**Status:** Draft — not yet built
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

This is now fully specced. Next step is the migration (schema + triggers + RLS), then
server actions, then UI.
