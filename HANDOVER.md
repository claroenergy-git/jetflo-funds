# JetFlo Funds Portal — Technical Handover

Internal web app that replaces the WhatsApp-based fund request/approval flow between the
JetFlo plant team (Hyderabad) and the Claro Energy finance team (Mumbai), and gives
leadership a live view of plant setup (CAPEX) and raw material spend.

Status: **working build, not yet deployed.** Runs locally against a live Supabase project
with ~30 seeded requests covering every workflow state.

---

## 1. Credentials — read this first

**No secrets are included in this zip.** `.env.local` was deliberately excluded; you get
`.env.local.example` with the variable names only.

You need three values from Kartik (Supabase → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…   # safe in the browser
SUPABASE_SERVICE_ROLE_KEY=eyJ…                   # server-only, bypasses RLS — never ship to client
```

The service-role key is used by **one** file, `scripts/seed-users.mjs`, and nothing else.
The app itself runs entirely on the publishable key + row-level security.

Supabase project: **`Kar-July2026`**, region `ap-southeast-1`. Note this project is
**shared with an existing HR dashboard** — every table, function and trigger belonging to
this app is prefixed `jetflo_`. Do not touch the unprefixed tables (`employees`,
`payroll_*`, `dropdown_options`, `v1_*`).

---

## 2. Running it locally

```bash
npm install
cp .env.local.example .env.local     # paste the three values in
npm run dev                          # http://localhost:3000
```

The database is already migrated and seeded, so this is all you need.

Demo logins — password `JetFlo@2026` for all four:

| Role | Email |
|---|---|
| Requester (ground team) | `ground@jetflo.in` |
| Finance (approver 1) | `finance@claroenergy.in` |
| Finance (approver 2) | `finance2@claroenergy.in` |
| Leadership (read-only) | `leadership@claroenergy.in` |

To rebuild the database from scratch on a **new** Supabase project, run in this order:

1. `supabase/migrations/001_jetflo_schema_core.sql` — tables, state machine, triggers
2. `supabase/migrations/002_jetflo_rls_and_storage.sql` — RLS policies, storage bucket
3. `node scripts/seed-users.mjs` — creates the four auth users + profiles
4. `supabase/migrations/003_jetflo_seed_data.sql` — vendors, budget heads, sample requests

Step 3 must run before step 4 (the seed data references those user IDs).

---

## 3. Stack

- **Next.js 16** (App Router, React 19, Server Actions, Turbopack) — no separate API layer;
  all mutations are server actions in `src/app/actions.ts`
- **TypeScript**, **Tailwind CSS 4**
- **Supabase** — Postgres, Auth (email + password), Storage (private bucket `jetflo-docs`)
- Deploy target: **Vercel**
- Zero UI dependencies — the handful of primitives in `src/components/ui.tsx` are
  hand-rolled Tailwind. Charts are server-rendered inline SVG, no charting library.

---

## 4. The important architectural decision

**The workflow rules live in the database, not the application.**

A `BEFORE UPDATE` trigger (`jetflo_validate_transition`) on `jetflo_fund_requests` validates
every state change against the caller's role via `auth.uid()`. Row-level security decides
what each role can see and touch. The React UI only *reflects* those rules.

This means someone with the publishable key and a REST client still cannot approve their own
request, edit a submitted request, pay more than was approved, or close a request without an
invoice. Please keep new features on this side of the line — if you add a workflow rule,
add it to the trigger, not just the form.

What is enforced in Postgres:

- Requests are **immutable once submitted** — changes only via *send back*
- Requesters cannot approve; finance cannot raise requests; **leadership has no write path at all**
- Approvals above **₹5,00,000** require a second, *different* finance user
- Payments cannot exceed the approved amount; status flips to `paid` automatically when the total is reached
- Closing requires `goods_received = true` **and** an invoice/GRN attachment
- The audit log is append-only and written by trigger — no client can write or edit it

Configurable thresholds live in the `jetflo_settings` table (`second_approver_above`,
`quotation_mandatory_above`, `duplicate_window_days`) — change the row, no deploy needed.

### State machine

```
draft ──► submitted ──► sent_back ──► submitted
              │
              ├──► rejected
              ├──► approved | partially_approved
              └──► awaiting_second_approval ──► approved | rejected     (above ₹5L)

approved | partially_approved ──► paid ──► closed
                              (auto, when payments total the approved amount)
```

---

## 5. Code map

```
src/
  app/
    actions.ts                    ALL server actions (auth, requests, decisions, payments, masters)
    login/page.tsx
    (app)/
      layout.tsx                  shell + role-based nav
      page.tsx                    role-based redirect to the right landing page
      requests/                   list · new · [id] detail (timeline, attachments, all action panels)
      finance/                    queue · payments · vendors · budget-heads
      dashboard/page.tsx          leadership dashboard — all aggregation happens here
      closures/page.tsx           requester's paid-but-unclosed list
  components/
    ui.tsx                        Card, StatusChip, Alert, shared input/button classes
    request-form.tsx              create + edit draft (shared)
    action-panels.tsx             approve/reject, record payment, close, resubmit
    dashboard-charts.tsx          SVG bar chart, horizontal bar list, KPI tile
    request-table.tsx, nav-links.tsx, csv-button.tsx, master-forms.tsx
  lib/
    supabase/server.ts, client.ts
    data.ts                       requireProfile() + the shared request select projection
    format.ts                     ₹ formatting (lakh/crore), dates, aging buckets
    types.ts                      status labels, chip styles, Role/Status types
  proxy.ts                        auth middleware (Next 16 renamed middleware → proxy)
supabase/migrations/              the three SQL files described above
scripts/seed-users.mjs            creates demo auth users (needs service-role key)
```

Two conventions worth knowing:

- `REQUEST_COLS` in `lib/data.ts` is the shared PostgREST projection for a fund request,
  including its joins. Add a column there and every screen gets it.
- `src/app/(app)/requests/[id]/page.tsx` casts the joined row to `any` — Supabase types
  aren't generated yet. Running `supabase gen types typescript` and wiring the generated
  `Database` type through the clients is a clean, contained first task.

---

## 6. Dashboard numbers

Aggregation is done in TypeScript in the dashboard page component, over the full request and
payment sets. Fine at current volume (tens of rows); if this grows past a few thousand
payments, move the roll-ups into Postgres views or an RPC rather than optimising the
component.

Headline figures are **cumulative since inception** and deliberately ignore the date filter —
that was the original ask ("I don't know the total extent of expenditure"). The date filter
applies to the run-rate chart, vendor/SKU breakdowns, and the payments register.

---

## 7. Deployment (not done yet)

Standard Vercel Next.js deploy. Set `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables.
`npm run build` passes clean.

One known constraint carried over from the sibling HR project: **direct TCP connections to
the Supabase database host fail from Vercel and from local machines on this account** — use
`@supabase/supabase-js` over HTTPS (which is what this app does). Don't swap in `pg`.

---

## 8. Known gaps / suggested next steps

1. **Notifications.** The whole point was to move off WhatsApp, but nobody currently gets
   told when a request needs attention. A WhatsApp Business API or email hook on submit /
   approve / pay is the highest-value next feature.
2. **Generated Supabase types** — removes the one `any` cast (§5).
3. Seeded attachments point at a placeholder path (`seed/final-invoice.pdf`) so those demo
   download links 404. Real uploads work correctly.
4. Export is CSV, not XLSX.
5. Single plant today. `jetflo_users.plant` exists so a second unit can be added without a
   schema change, but the RLS policies would need a plant predicate added.
6. Password auth was chosen over magic links to make the demo easy. Switching to magic links
   or SSO is a Supabase Auth config change, no schema impact.
7. No automated tests. The workflow rules in the trigger are the highest-value thing to
   cover — they're pure SQL and testable with a seeded transaction per role.

## 9. Unrelated but urgent

While working in this Supabase project I noticed the **HR dashboard's tables have row-level
security disabled** — `employees`, `payroll_months`, `payroll_records`, `import_staging`,
`dropdown_options` and their `v1_*` copies are readable and writable by anyone holding the
publishable key. That is payroll data. It's a separate application from this one, but
whoever owns it should fix it. Enabling RLS without adding policies will break that app, so
it needs policies written alongside.
