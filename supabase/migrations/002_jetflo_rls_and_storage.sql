-- JetFlo RLS policies + private storage bucket
-- Applied to Supabase as migration `jetflo_rls_and_storage`.

alter table jetflo_users enable row level security;
alter table jetflo_settings enable row level security;
alter table jetflo_vendors enable row level security;
alter table jetflo_budget_heads enable row level security;
alter table jetflo_fund_requests enable row level security;
alter table jetflo_attachments enable row level security;
alter table jetflo_payments enable row level security;
alter table jetflo_audit_log enable row level security;

-- users: any active jetflo user can read profiles (names in timelines); no client writes
drop policy if exists jetflo_users_select on jetflo_users;
create policy jetflo_users_select on jetflo_users for select
  using (jetflo_role() is not null);

-- settings: readable by all roles; no client writes
drop policy if exists jetflo_settings_select on jetflo_settings;
create policy jetflo_settings_select on jetflo_settings for select
  using (jetflo_role() is not null);

-- vendors: all roles read; finance writes
drop policy if exists jetflo_vendors_select on jetflo_vendors;
create policy jetflo_vendors_select on jetflo_vendors for select
  using (jetflo_role() is not null);
drop policy if exists jetflo_vendors_insert on jetflo_vendors;
create policy jetflo_vendors_insert on jetflo_vendors for insert
  with check (jetflo_role() = 'finance');
drop policy if exists jetflo_vendors_update on jetflo_vendors;
create policy jetflo_vendors_update on jetflo_vendors for update
  using (jetflo_role() = 'finance');

-- budget heads: all roles read; finance writes
drop policy if exists jetflo_bh_select on jetflo_budget_heads;
create policy jetflo_bh_select on jetflo_budget_heads for select
  using (jetflo_role() is not null);
drop policy if exists jetflo_bh_insert on jetflo_budget_heads;
create policy jetflo_bh_insert on jetflo_budget_heads for insert
  with check (jetflo_role() = 'finance');
drop policy if exists jetflo_bh_update on jetflo_budget_heads;
create policy jetflo_bh_update on jetflo_budget_heads for update
  using (jetflo_role() = 'finance');

-- fund requests
drop policy if exists jetflo_fr_select on jetflo_fund_requests;
create policy jetflo_fr_select on jetflo_fund_requests for select
  using (
    jetflo_role() in ('finance','leadership')
    or (jetflo_role() = 'requester' and requester_id = auth.uid())
  );
drop policy if exists jetflo_fr_insert on jetflo_fund_requests;
create policy jetflo_fr_insert on jetflo_fund_requests for insert
  with check (jetflo_role() = 'requester' and requester_id = auth.uid()
              and status in ('draft','submitted'));
drop policy if exists jetflo_fr_update on jetflo_fund_requests;
create policy jetflo_fr_update on jetflo_fund_requests for update
  using (
    jetflo_role() = 'finance'
    or (jetflo_role() = 'requester' and requester_id = auth.uid())
  );
-- the transition trigger enforces exactly which updates each role may make

-- attachments: visibility follows the request; owner/finance insert
drop policy if exists jetflo_att_select on jetflo_attachments;
create policy jetflo_att_select on jetflo_attachments for select
  using (exists (select 1 from jetflo_fund_requests r where r.id = request_id));
drop policy if exists jetflo_att_insert on jetflo_attachments;
create policy jetflo_att_insert on jetflo_attachments for insert
  with check (
    jetflo_role() = 'finance'
    or (jetflo_role() = 'requester'
        and exists (select 1 from jetflo_fund_requests r
                    where r.id = request_id and r.requester_id = auth.uid()))
  );

-- payments: visibility follows the request; finance inserts; nobody edits/deletes
drop policy if exists jetflo_pay_select on jetflo_payments;
create policy jetflo_pay_select on jetflo_payments for select
  using (exists (select 1 from jetflo_fund_requests r where r.id = request_id));
drop policy if exists jetflo_pay_insert on jetflo_payments;
create policy jetflo_pay_insert on jetflo_payments for insert
  with check (jetflo_role() = 'finance');

-- audit log: read-only, visibility follows the request; writes only via triggers
drop policy if exists jetflo_audit_select on jetflo_audit_log;
create policy jetflo_audit_select on jetflo_audit_log for select
  using (exists (select 1 from jetflo_fund_requests r where r.id = request_id));

-- storage: private bucket for quotations, invoices, payment proofs
insert into storage.buckets (id, name, public)
values ('jetflo-docs', 'jetflo-docs', false)
on conflict (id) do nothing;

drop policy if exists jetflo_docs_read on storage.objects;
create policy jetflo_docs_read on storage.objects for select
  using (bucket_id = 'jetflo-docs' and jetflo_role() is not null);
drop policy if exists jetflo_docs_write on storage.objects;
create policy jetflo_docs_write on storage.objects for insert
  with check (bucket_id = 'jetflo-docs' and jetflo_role() in ('requester','finance'));
