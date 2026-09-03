-- JetFlo Migration 007: Consolidated Procurement & Schema Fix
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wanhdvyjgjuilqdqhlzt/sql/new

-- 1. Fund requests additions: parent request, prior invoice, and tax fields
alter table jetflo_fund_requests add column if not exists parent_request_id uuid references jetflo_fund_requests(id);
alter table jetflo_fund_requests add column if not exists prior_invoice_no text;
alter table jetflo_fund_requests add column if not exists tax_percent numeric;
alter table jetflo_fund_requests add column if not exists tax_amount numeric;
alter table jetflo_fund_requests add column if not exists round_off numeric;

comment on column jetflo_fund_requests.parent_request_id is 'Optional reference to parent/advance fund request for balance payments';
comment on column jetflo_fund_requests.prior_invoice_no is 'Optional invoice or PO reference number';
comment on column jetflo_fund_requests.tax_percent is 'Applicable tax percentage (e.g. 18 for 18% GST)';
comment on column jetflo_fund_requests.tax_amount is 'Calculated or specified tax amount in INR';
comment on column jetflo_fund_requests.round_off is 'Rounding adjustment amount in INR (+/-)';

-- 2. Vendors table additions: onboarding workflow, addresses, and foreign vendors
alter table jetflo_vendors add column if not exists status text not null default 'approved';
alter table jetflo_vendors add column if not exists contact_person text;
alter table jetflo_vendors add column if not exists email text;
alter table jetflo_vendors add column if not exists phone text;
alter table jetflo_vendors add column if not exists pan text;
alter table jetflo_vendors add column if not exists trade_name text;
alter table jetflo_vendors add column if not exists address_line text;
alter table jetflo_vendors add column if not exists city text;
alter table jetflo_vendors add column if not exists state text;
alter table jetflo_vendors add column if not exists pincode text;
alter table jetflo_vendors add column if not exists bank_beneficiary_name text;
alter table jetflo_vendors add column if not exists account_type text default 'current';
alter table jetflo_vendors add column if not exists msme_reg_no text;
alter table jetflo_vendors add column if not exists rejection_reason text;
alter table jetflo_vendors add column if not exists approved_by uuid references jetflo_users(id);
alter table jetflo_vendors add column if not exists approved_at timestamptz;
alter table jetflo_vendors add column if not exists is_foreign boolean not null default false;
alter table jetflo_vendors add column if not exists country text default 'India';
alter table jetflo_vendors add column if not exists vat_no text;
alter table jetflo_vendors add column if not exists swift_code text;
alter table jetflo_vendors add column if not exists district text;
alter table jetflo_vendors add column if not exists bank_doc_type text default 'cancelled_cheque';

-- 3. Ensure document kinds in attachments include PO, work order, delivery challan
alter table jetflo_attachments drop constraint if exists jetflo_attachments_kind_check;
alter table jetflo_attachments add constraint jetflo_attachments_kind_check
  check (kind in ('quotation','proforma','invoice','grn','purchase_order','delivery_challan','bank_proof','gst_cert','payment_proof','other'));

-- 4. Standardise budget heads for both categories
insert into jetflo_budget_heads (category, sub_head, active)
values
  ('capex', 'JetFlo Aqua', true),
  ('capex', 'JetFlo Volt', true),
  ('capex', 'JetFlo Reserve', true),
  ('capex', 'Not Applicable', true),
  ('raw_material', 'JetFlo Aqua', true),
  ('raw_material', 'JetFlo Volt', true),
  ('raw_material', 'JetFlo Reserve', true),
  ('raw_material', 'Not Applicable', true)
on conflict (category, sub_head) do update set active = true;

-- 5. RLS update: allow requester to onboard vendors in pending_approval state
drop policy if exists jetflo_vendors_insert on jetflo_vendors;
create policy jetflo_vendors_insert on jetflo_vendors for insert
  with check (
    jetflo_role() = 'finance'
    or (jetflo_role() = 'requester' and status = 'pending_approval')
  );

drop policy if exists jetflo_vendors_update on jetflo_vendors;
create policy jetflo_vendors_update on jetflo_vendors for update
  using (jetflo_role() = 'finance');

-- 6. Refresh PostgREST schema cache
notify pgrst, 'reload schema';
