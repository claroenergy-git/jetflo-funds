# JetFlo Funds Portal

Fund request, approval and spend-visibility web app for **JetFlo** (manufacturing
subsidiary of Claro Energy Limited). Replaces the WhatsApp request/approval flow with
an auditable workflow across three roles.

## Roles & demo logins

Password for all demo users: **JetFlo@2026**

| Role | Login | Can do |
|---|---|---|
| Requester (ground team) | `ground@jetflo.in` | Raise/edit/submit requests, upload quotations, close paid requests with final invoice |
| Finance (Claro, Mumbai) | `finance@claroenergy.in` | Approve / partial / reject / send back, record fund transfers, manage vendors & budget heads |
| Finance — 2nd approver | `finance2@claroenergy.in` | Same as finance; needed for approvals above ₹5,00,000 |
| Leadership | `leadership@claroenergy.in` | Read-only dashboard + all requests |

## Workflow (enforced by the database, not just the UI)

```
draft → submitted → (sent_back → submitted) → approved | partially_approved | rejected
                  → awaiting_second_approval (above ₹5L) → approved | rejected
approved → paid (auto, when payments total the approved amount) → closed
```

- Requests are **immutable after submission**; changes only via *send back*.
- Every state change is written to an **append-only audit log** by a DB trigger — visible
  as the timeline on each request, not editable by anyone.
- Partial payments supported; balance tracked per request.
- **Closure** requires final invoice/GRN upload + confirmation goods were received.
  Paid-but-unclosed advances are surfaced with aging buckets on the dashboard.

## Controls

- Second finance approver (a *different* user) required above ₹5,00,000 — `jetflo_settings.second_approver_above`.
- Quotation attachment mandatory above ₹50,000 — `jetflo_settings.quotation_mandatory_above`.
- Duplicate warning: same vendor ± 10% amount within 7 days — `jetflo_settings.duplicate_window_days`.
- Requesters cannot approve; finance cannot raise requests; leadership has **no write path
  at the RLS level** (all enforced by Postgres RLS + a transition trigger).
- Amounts in INR with Indian digit grouping and ₹ L / ₹ Cr compact formatting.

## Stack

Next.js 16 (App Router, server actions) · TypeScript · Tailwind 4 · Supabase
(Postgres + Auth + Storage, RLS per role) · deployable on Vercel.

- Supabase project: `Kar-July2026` (`xsqixbducicsfxfjfzlk`, ap-southeast-1). The DB is
  shared with the HR dashboard, so every JetFlo object is prefixed `jetflo_`.
- Documents live in the private `jetflo-docs` storage bucket, served via signed URLs.

## Setup

```
npm install
cp .env.local.example .env.local   # fill in the two Supabase keys
node scripts/seed-users.mjs        # creates the 4 demo auth users (needs service-role key)
npm run dev
```

Env vars (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…        # publishable key
SUPABASE_SERVICE_ROLE_KEY=…            # only used by scripts/seed-users.mjs
```

Database: the three migrations in `supabase/migrations/` are already applied to the
project (`jetflo_schema_core`, `jetflo_rls_and_storage`, `jetflo_seed_data`). For a fresh
project run them in order (run `scripts/seed-users.mjs` before `003`).

## Assumptions made

- **Password login** instead of magic links, so the three demo roles are easy to try;
  Supabase email magic-link can be switched on later without schema changes.
- Hand-rolled Tailwind UI primitives rather than the shadcn/ui dependency — same look,
  lighter footprint.
- Seeded attachments (`seed/final-invoice.pdf`) are placeholder paths, so their download
  links 404; files uploaded through the app work normally.
- CSV export (not XLSX) on dashboard tables.
- Second-approver routing applies to any first approval above the threshold; the second
  approver chooses full/reject (partial is decided at first approval).
- One plant today; `jetflo_users.plant` exists so a second unit can be added without
  reworking the schema.
