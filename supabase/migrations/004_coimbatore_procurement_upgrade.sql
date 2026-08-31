-- JetFlo Migration 004: Coimbatore Procurement & Governance Upgrade
-- Safe, non-breaking column additions, subheads standardisation, and vendor onboarding workflow

-- 1. Vendors table additions
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

-- 2. Fund requests additions for balance payment linking
alter table jetflo_fund_requests add column if not exists parent_request_id uuid references jetflo_fund_requests(id);
alter table jetflo_fund_requests add column if not exists prior_invoice_no text;

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
