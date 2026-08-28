-- JetFlo Fund Request & Approval Portal — core schema
-- Applied to Supabase project xsqixbducicsfxfjfzlk as migration `jetflo_schema_core`.
-- All objects are prefixed jetflo_ (the project DB is shared with the HR dashboard).

create extension if not exists pgcrypto;

create table if not exists jetflo_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  phone text,
  role text not null check (role in ('requester','finance','leadership')),
  plant text not null default 'JetFlo Hyderabad',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists jetflo_settings (
  key text primary key,
  value numeric not null,
  description text
);

insert into jetflo_settings (key, value, description) values
  ('second_approver_above', 500000, 'Requests above this amount (INR) need a second finance approver'),
  ('quotation_mandatory_above', 50000, 'Quotation attachment mandatory above this amount (INR)'),
  ('duplicate_window_days', 7, 'Warn on same vendor + similar amount within this many days')
on conflict (key) do nothing;

create table if not exists jetflo_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  bank_name text,
  account_no text,
  ifsc text,
  category text not null default 'both' check (category in ('capex','raw_material','both')),
  active boolean not null default true,
  created_by uuid references jetflo_users(id),
  created_at timestamptz not null default now()
);

create table if not exists jetflo_budget_heads (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('capex','raw_material')),
  sub_head text not null,
  sanctioned_amount numeric,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, sub_head)
);

create sequence if not exists jetflo_seq_cap;
create sequence if not exists jetflo_seq_rm;

create table if not exists jetflo_fund_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text unique,
  category text not null check (category in ('capex','raw_material')),
  budget_head_id uuid not null references jetflo_budget_heads(id),
  vendor_id uuid not null references jetflo_vendors(id),
  item_description text not null,
  product_sku text,
  qty numeric,
  unit_rate numeric,
  amount_requested numeric not null check (amount_requested > 0),
  amount_approved numeric,
  urgency text not null default 'normal' check (urgency in ('normal','urgent','critical')),
  need_by_date date,
  payment_type text not null default 'advance' check (payment_type in ('advance','against_invoice','balance')),
  justification text,
  status text not null default 'draft' check (status in
    ('draft','submitted','sent_back','awaiting_second_approval','approved','partially_approved','rejected','paid','closed')),
  requester_id uuid not null references jetflo_users(id),
  approved_by uuid references jetflo_users(id),
  second_approved_by uuid references jetflo_users(id),
  approval_remarks text,
  rejection_reason text,
  duplicate_warning boolean not null default false,
  amount_paid numeric not null default 0,
  goods_received boolean not null default false,
  submitted_at timestamptz,
  decided_at timestamptz,
  first_paid_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jetflo_fr_status_idx on jetflo_fund_requests (status);
create index if not exists jetflo_fr_requester_idx on jetflo_fund_requests (requester_id);
create index if not exists jetflo_fr_category_idx on jetflo_fund_requests (category);

create table if not exists jetflo_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references jetflo_fund_requests(id) on delete cascade,
  kind text not null check (kind in ('quotation','proforma','invoice','grn','payment_proof','other')),
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references jetflo_users(id),
  created_at timestamptz not null default now()
);
create index if not exists jetflo_att_req_idx on jetflo_attachments (request_id);

create table if not exists jetflo_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references jetflo_fund_requests(id),
  amount_paid numeric not null check (amount_paid > 0),
  paid_on date not null default current_date,
  mode text not null check (mode in ('neft','rtgs','imps','upi','cheque','cash')),
  bank text,
  utr_ref text,
  remarks text,
  recorded_by uuid references jetflo_users(id),
  created_at timestamptz not null default now()
);
create index if not exists jetflo_pay_req_idx on jetflo_payments (request_id);

create table if not exists jetflo_audit_log (
  id bigint generated always as identity primary key,
  request_id uuid not null references jetflo_fund_requests(id) on delete cascade,
  actor_id uuid,
  action text not null,
  old_status text,
  new_status text,
  remarks text,
  created_at timestamptz not null default now()
);
create index if not exists jetflo_audit_req_idx on jetflo_audit_log (request_id);

-- helper functions
create or replace function jetflo_role() returns text
language sql stable security definer set search_path = public as
$$ select role from jetflo_users where id = auth.uid() and active $$;

create or replace function jetflo_setting(k text) returns numeric
language sql stable security definer set search_path = public as
$$ select value from jetflo_settings where key = k $$;

-- request numbering: JF-CAP-0001 / JF-RM-0001
create or replace function jetflo_assign_request_no() returns trigger
language plpgsql as $$
begin
  if new.request_no is null then
    if new.category = 'capex' then
      new.request_no := 'JF-CAP-' || lpad(nextval('jetflo_seq_cap')::text, 4, '0');
    else
      new.request_no := 'JF-RM-' || lpad(nextval('jetflo_seq_rm')::text, 4, '0');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists jetflo_trg_request_no on jetflo_fund_requests;
create trigger jetflo_trg_request_no before insert on jetflo_fund_requests
for each row execute function jetflo_assign_request_no();

-- state machine, enforced in the database
create or replace function jetflo_validate_transition() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  r text;
  core_changed boolean;
begin
  new.updated_at := now();
  if actor is null then return new; end if;  -- service role / seed bypass
  r := jetflo_role();
  if r is null then raise exception 'No JetFlo profile for this user'; end if;
  if r = 'leadership' then raise exception 'Leadership access is read-only'; end if;

  core_changed :=
    new.category is distinct from old.category or
    new.budget_head_id is distinct from old.budget_head_id or
    new.vendor_id is distinct from old.vendor_id or
    new.item_description is distinct from old.item_description or
    new.product_sku is distinct from old.product_sku or
    new.qty is distinct from old.qty or
    new.unit_rate is distinct from old.unit_rate or
    new.amount_requested is distinct from old.amount_requested or
    new.urgency is distinct from old.urgency or
    new.need_by_date is distinct from old.need_by_date or
    new.payment_type is distinct from old.payment_type or
    new.justification is distinct from old.justification or
    new.requester_id is distinct from old.requester_id or
    new.request_no is distinct from old.request_no;

  if old.status not in ('draft','sent_back') and core_changed then
    raise exception 'Request % is immutable after submission', old.request_no;
  end if;
  if new.amount_approved is distinct from old.amount_approved
     and old.status not in ('submitted','awaiting_second_approval') then
    raise exception 'Approved amount cannot be changed after decision';
  end if;

  if new.status = old.status then return new; end if;

  if old.status in ('draft','sent_back') and new.status = 'submitted' then
    if r <> 'requester' or old.requester_id <> actor then
      raise exception 'Only the owning requester can submit';
    end if;
    new.submitted_at := now();

  elsif old.status = 'submitted' and new.status = 'sent_back' then
    if r <> 'finance' then raise exception 'Only finance can send back'; end if;
    if coalesce(new.approval_remarks,'') = '' then raise exception 'Remarks required to send back'; end if;

  elsif old.status in ('submitted','awaiting_second_approval') and new.status = 'rejected' then
    if r <> 'finance' then raise exception 'Only finance can reject'; end if;
    if coalesce(new.rejection_reason,'') = '' then raise exception 'Rejection reason required'; end if;
    new.decided_at := now();

  elsif old.status = 'submitted' and new.status = 'awaiting_second_approval' then
    if r <> 'finance' then raise exception 'Only finance can approve'; end if;
    if new.amount_approved is null or new.amount_approved <= 0 then raise exception 'Approved amount required'; end if;
    new.approved_by := actor;

  elsif old.status = 'submitted' and new.status in ('approved','partially_approved') then
    if r <> 'finance' then raise exception 'Only finance can approve'; end if;
    if new.amount_approved is null or new.amount_approved <= 0 then raise exception 'Approved amount required'; end if;
    if new.status = 'partially_approved' and coalesce(new.approval_remarks,'') = '' then
      raise exception 'Remarks required for partial approval';
    end if;
    if new.amount_approved > jetflo_setting('second_approver_above') then
      raise exception 'Amount above ₹% needs a second approver — route via awaiting_second_approval',
        jetflo_setting('second_approver_above');
    end if;
    new.approved_by := actor;
    new.decided_at := now();

  elsif old.status = 'awaiting_second_approval' and new.status in ('approved','partially_approved') then
    if r <> 'finance' then raise exception 'Only finance can approve'; end if;
    if old.approved_by = actor then raise exception 'Second approver must be a different finance user'; end if;
    new.second_approved_by := actor;
    new.decided_at := now();

  elsif old.status in ('approved','partially_approved') and new.status = 'paid' then
    if r <> 'finance' then raise exception 'Only finance can record payment'; end if;
    if new.amount_paid < new.amount_approved then
      raise exception 'Cannot mark paid: balance of % remains', new.amount_approved - new.amount_paid;
    end if;

  elsif old.status = 'paid' and new.status = 'closed' then
    if not (r = 'finance' or (r = 'requester' and old.requester_id = actor)) then
      raise exception 'Only the owning requester or finance can close';
    end if;
    if not new.goods_received then
      raise exception 'Confirm goods/services received before closing';
    end if;
    if not exists (select 1 from jetflo_attachments a
                   where a.request_id = new.id and a.kind in ('invoice','grn')) then
      raise exception 'Final invoice/GRN attachment required to close';
    end if;
    new.closed_at := now();

  else
    raise exception 'Illegal transition % → %', old.status, new.status;
  end if;

  return new;
end $$;

drop trigger if exists jetflo_trg_transition on jetflo_fund_requests;
create trigger jetflo_trg_transition before update on jetflo_fund_requests
for each row execute function jetflo_validate_transition();

-- append-only audit log, written by trigger only
create or replace function jetflo_write_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks)
    values (new.id, coalesce(auth.uid(), new.requester_id), 'created', null, new.status, null);
  elsif old.status is distinct from new.status then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks)
    values (new.id, auth.uid(), new.status, old.status, new.status,
      case
        when new.status = 'rejected' then new.rejection_reason
        when new.status in ('sent_back','approved','partially_approved','awaiting_second_approval') then new.approval_remarks
        else null
      end);
  end if;
  return new;
end $$;

drop trigger if exists jetflo_trg_audit on jetflo_fund_requests;
create trigger jetflo_trg_audit after insert or update on jetflo_fund_requests
for each row execute function jetflo_write_audit();

-- payments roll-up: multiple payments per request; flips status to paid when fully paid
create or replace function jetflo_apply_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total numeric;
  req jetflo_fund_requests;
begin
  select * into req from jetflo_fund_requests where id = new.request_id for update;
  if req.status not in ('approved','partially_approved','paid') then
    raise exception 'Payments can only be recorded on approved requests (current: %)', req.status;
  end if;
  select coalesce(sum(amount_paid),0) into total from jetflo_payments where request_id = new.request_id;
  if total > req.amount_approved then
    raise exception 'Payment exceeds approved amount (approved %, would total %)', req.amount_approved, total;
  end if;

  update jetflo_fund_requests
     set amount_paid = total,
         first_paid_at = coalesce(first_paid_at, now()),
         status = case when total >= amount_approved then 'paid' else status end
   where id = new.request_id;

  insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks)
  values (new.request_id, coalesce(auth.uid(), new.recorded_by), 'payment_recorded', req.status,
          case when total >= req.amount_approved then 'paid' else req.status end,
          'Paid ₹' || new.amount_paid || ' via ' || upper(new.mode) || coalesce(' UTR ' || new.utr_ref, ''));
  return new;
end $$;

drop trigger if exists jetflo_trg_payment on jetflo_payments;
create trigger jetflo_trg_payment after insert on jetflo_payments
for each row execute function jetflo_apply_payment();
