-- Purchase Orders: draft -> issue lifecycle, itemized lines, second-approval above a
-- configurable threshold, and a hard balance/currency check wired into the existing
-- fund-request approval trigger. See PURCHASE-ORDERS-SPEC.md for the full design.

create sequence if not exists jetflo_seq_po;

create table if not exists jetflo_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text unique,
  vendor_id uuid not null references jetflo_vendors(id),
  budget_head_id uuid not null references jetflo_budget_heads(id),
  category text not null check (category in ('capex','raw_material')),
  currency text not null default 'INR' check (currency in ('INR','USD')),
  total_value numeric not null default 0,
  status text not null default 'draft' check (status in
    ('draft','pending_second_approval','open','partially_billed','fully_billed','cancelled')),
  source_request_id uuid references jetflo_fund_requests(id),
  created_by uuid not null references jetflo_users(id),
  approved_by uuid references jetflo_users(id),
  notes text,
  issued_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jetflo_po_status_idx on jetflo_purchase_orders (status);
create index if not exists jetflo_po_vendor_idx on jetflo_purchase_orders (vendor_id);

create table if not exists jetflo_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references jetflo_purchase_orders(id) on delete cascade,
  item_description text not null,
  product_sku text,
  qty numeric not null check (qty > 0),
  unit_rate numeric not null check (unit_rate >= 0),
  tax_percent numeric,
  tax_amount numeric,
  round_off numeric,
  line_total numeric not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jetflo_poi_po_idx on jetflo_purchase_order_items (purchase_order_id);

alter table jetflo_fund_requests add column if not exists po_id uuid references jetflo_purchase_orders(id);
create index if not exists jetflo_fr_po_idx on jetflo_fund_requests (po_id);

insert into jetflo_settings (key, value, description) values
  ('po_second_approver_above', 1000000, 'Purchase orders above this value (INR) need a second finance approver')
on conflict (key) do nothing;

-- audit log: widen to also cover purchase-order events (issuance, amendment) so the
-- dashboard can show one unified trail alongside currency amendments.
alter table jetflo_audit_log alter column request_id drop not null;
alter table jetflo_audit_log add column if not exists purchase_order_id uuid references jetflo_purchase_orders(id) on delete cascade;
alter table jetflo_audit_log drop constraint if exists jetflo_audit_log_target_chk;
alter table jetflo_audit_log add constraint jetflo_audit_log_target_chk
  check (request_id is not null or purchase_order_id is not null);
create index if not exists jetflo_audit_po_idx on jetflo_audit_log (purchase_order_id);

-- ---------------------------------------------------------------------------
-- keep total_value in sync with line items, always
-- ---------------------------------------------------------------------------
create or replace function jetflo_po_recalc_total() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_po uuid;
  new_total numeric;
begin
  target_po := coalesce(new.purchase_order_id, old.purchase_order_id);
  select coalesce(sum(line_total), 0) into new_total
    from jetflo_purchase_order_items where purchase_order_id = target_po;
  update jetflo_purchase_orders set total_value = new_total, updated_at = now()
    where id = target_po;
  return coalesce(new, old);
end $$;

drop trigger if exists jetflo_trg_poi_recalc on jetflo_purchase_order_items;
create trigger jetflo_trg_poi_recalc after insert or update or delete on jetflo_purchase_order_items
for each row execute function jetflo_po_recalc_total();

-- ---------------------------------------------------------------------------
-- purchase order state machine, enforced in the database (mirrors
-- jetflo_validate_transition for fund requests)
-- ---------------------------------------------------------------------------
create or replace function jetflo_po_validate_transition() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  r text;
  core_changed boolean;
  linked_active_count int;
begin
  new.updated_at := now();
  if actor is null then return new; end if; -- service-role bypass (used by amendPurchaseOrder)

  r := jetflo_role();
  if r is null then raise exception 'No JetFlo profile for this user'; end if;
  if r <> 'finance' then raise exception 'Only finance can manage purchase orders'; end if;

  core_changed :=
    new.vendor_id is distinct from old.vendor_id or
    new.budget_head_id is distinct from old.budget_head_id or
    new.currency is distinct from old.currency;

  if old.status <> 'draft' and core_changed then
    raise exception 'Purchase order % is immutable after issue — use an amendment', old.po_number;
  end if;

  if new.status = old.status then return new; end if;

  if old.status = 'draft' and new.status in ('open','pending_second_approval') then
    if new.total_value is null or new.total_value <= 0 then
      raise exception 'Add at least one line item before issuing';
    end if;
    if new.po_number is null then
      new.po_number := 'JF-PO-' || lpad(nextval('jetflo_seq_po')::text, 4, '0');
    end if;
    new.issued_at := now();
    if new.status = 'open' and new.total_value > jetflo_setting('po_second_approver_above') then
      raise exception 'Value above ₹% needs a second approver — route via pending_second_approval',
        jetflo_setting('po_second_approver_above');
    end if;

  elsif old.status = 'pending_second_approval' and new.status = 'open' then
    if old.created_by = actor then
      raise exception 'Second approver must be a different finance user';
    end if;
    new.approved_by := actor;
    new.approved_at := now();

  elsif new.status = 'cancelled' then
    if old.status not in ('draft','open','pending_second_approval') then
      raise exception 'Cannot cancel a purchase order once billing has started';
    end if;
    if old.status <> 'draft' then
      select count(*) into linked_active_count from jetflo_fund_requests
        where po_id = old.id and status not in ('rejected','sent_back');
      if linked_active_count > 0 then
        raise exception 'Cannot cancel a purchase order with linked fund requests';
      end if;
    end if;

  else
    raise exception 'Illegal purchase order transition % → %', old.status, new.status;
  end if;

  return new;
end $$;

drop trigger if exists jetflo_trg_po_transition on jetflo_purchase_orders;
create trigger jetflo_trg_po_transition before update on jetflo_purchase_orders
for each row execute function jetflo_po_validate_transition();

-- ---------------------------------------------------------------------------
-- balance + currency check, called from the fund-request approval trigger
-- ---------------------------------------------------------------------------
create or replace function jetflo_check_po_balance(
  p_po_id uuid, p_request_id uuid, p_amount numeric, p_currency text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  po jetflo_purchase_orders;
  committed numeric;
begin
  select * into po from jetflo_purchase_orders where id = p_po_id;
  if po.id is null then
    raise exception 'Linked purchase order not found';
  end if;
  if po.status not in ('open','partially_billed') then
    raise exception 'Purchase order % is not open for billing (status: %)', po.po_number, po.status;
  end if;
  if p_currency is distinct from po.currency then
    raise exception 'Request currency (%) must match its purchase order currency (%)', p_currency, po.currency;
  end if;

  select coalesce(sum(amount_approved), 0) into committed
    from jetflo_fund_requests
   where po_id = p_po_id
     and id <> p_request_id
     and status in ('awaiting_second_approval','approved','partially_approved','paid','closed');

  if committed + p_amount > po.total_value then
    raise exception 'This approval (%) would exceed purchase order % remaining balance of %',
      p_amount, po.po_number, po.total_value - committed;
  end if;
end $$;

-- recompute a linked PO's display status (open / partially_billed / fully_billed)
-- whenever a linked request's approval state changes. Because the sum below is always
-- computed live from current statuses, a rejected/sent-back request stops counting
-- against its PO immediately, with no separate "release" step needed.
create or replace function jetflo_po_recalc_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_po uuid;
  po jetflo_purchase_orders;
  committed numeric;
begin
  target_po := coalesce(new.po_id, old.po_id);
  if target_po is null then return new; end if;

  select * into po from jetflo_purchase_orders where id = target_po;
  if po.id is null or po.status not in ('open','partially_billed','fully_billed') then
    return new;
  end if;

  select coalesce(sum(amount_approved), 0) into committed
    from jetflo_fund_requests
   where po_id = target_po
     and status in ('awaiting_second_approval','approved','partially_approved','paid','closed');

  update jetflo_purchase_orders
     set status = case
                     when po.total_value > 0 and committed >= po.total_value then 'fully_billed'
                     when committed > 0 then 'partially_billed'
                     else 'open'
                   end,
         updated_at = now()
   where id = target_po;

  return new;
end $$;

drop trigger if exists jetflo_trg_fr_po_recalc on jetflo_fund_requests;
create trigger jetflo_trg_fr_po_recalc after update of status, amount_approved, po_id on jetflo_fund_requests
for each row execute function jetflo_po_recalc_status();

-- ---------------------------------------------------------------------------
-- extend the existing fund-request transition trigger with the PO balance check
-- ---------------------------------------------------------------------------
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
    if new.po_id is not null then
      perform jetflo_check_po_balance(new.po_id, new.id, new.amount_approved, new.currency);
    end if;
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
    if new.po_id is not null then
      perform jetflo_check_po_balance(new.po_id, new.id, new.amount_approved, new.currency);
    end if;
    new.approved_by := actor;
    new.decided_at := now();

  elsif old.status = 'awaiting_second_approval' and new.status in ('approved','partially_approved') then
    if r <> 'finance' then raise exception 'Only finance can approve'; end if;
    if old.approved_by = actor then raise exception 'Second approver must be a different finance user'; end if;
    if new.po_id is not null then
      perform jetflo_check_po_balance(new.po_id, new.id, new.amount_approved, new.currency);
    end if;
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table jetflo_purchase_orders enable row level security;
alter table jetflo_purchase_order_items enable row level security;

drop policy if exists jetflo_po_select on jetflo_purchase_orders;
create policy jetflo_po_select on jetflo_purchase_orders for select
  using (
    (status <> 'draft' and jetflo_role() is not null)
    or (status = 'draft' and jetflo_role() = 'finance')
  );
drop policy if exists jetflo_po_insert on jetflo_purchase_orders;
create policy jetflo_po_insert on jetflo_purchase_orders for insert
  with check (jetflo_role() = 'finance' and status = 'draft' and created_by = auth.uid());
drop policy if exists jetflo_po_update on jetflo_purchase_orders;
create policy jetflo_po_update on jetflo_purchase_orders for update
  using (jetflo_role() = 'finance');

drop policy if exists jetflo_poi_select on jetflo_purchase_order_items;
create policy jetflo_poi_select on jetflo_purchase_order_items for select
  using (
    exists (
      select 1 from jetflo_purchase_orders p where p.id = purchase_order_id
        and ((p.status <> 'draft' and jetflo_role() is not null)
             or (p.status = 'draft' and jetflo_role() = 'finance'))
    )
  );
drop policy if exists jetflo_poi_write on jetflo_purchase_order_items;
create policy jetflo_poi_write on jetflo_purchase_order_items for all
  using (
    jetflo_role() = 'finance'
    and exists (select 1 from jetflo_purchase_orders p where p.id = purchase_order_id and p.status = 'draft')
  )
  with check (
    jetflo_role() = 'finance'
    and exists (select 1 from jetflo_purchase_orders p where p.id = purchase_order_id and p.status = 'draft')
  );

-- widen the audit-log select policy to also cover purchase-order events
drop policy if exists jetflo_audit_select on jetflo_audit_log;
create policy jetflo_audit_select on jetflo_audit_log for select
  using (
    (request_id is not null and exists (select 1 from jetflo_fund_requests r where r.id = request_id))
    or (purchase_order_id is not null and exists (
          select 1 from jetflo_purchase_orders p where p.id = purchase_order_id
            and ((p.status <> 'draft' and jetflo_role() is not null)
                 or (p.status = 'draft' and jetflo_role() = 'finance'))
       ))
  );
