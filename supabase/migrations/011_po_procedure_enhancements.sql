-- 011_po_procedure_enhancements.sql
-- Integrates industrial procurement features into JetFlo Purchase Orders:
-- 1. Metadata: order_date, expected_delivery_date, destination_plant, reference_no, payment_terms, transporter_name, lr_no, receive_status
-- 2. Line item physical progress: qty_received
-- 3. Plant Goods Receipts (GRN): jetflo_purchase_receives & jetflo_purchase_receive_items
-- 4. Triggers to maintain qty_received and receive_status automatically

-- 1. Enhance jetflo_purchase_orders
alter table jetflo_purchase_orders
  add column if not exists order_date date default current_date,
  add column if not exists expected_delivery_date date,
  add column if not exists destination_plant text default 'Hyderabad Plant',
  add column if not exists reference_no text,
  add column if not exists payment_terms text default 'due_on_receipt',
  add column if not exists transporter_name text,
  add column if not exists lr_no text,
  add column if not exists receive_status text default 'pending';

-- Add check constraint for receive_status if not already present
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jetflo_po_receive_status_chk'
  ) then
    alter table jetflo_purchase_orders
      add constraint jetflo_po_receive_status_chk
      check (receive_status in ('pending', 'partially_received', 'received'));
  end if;
end $$;

create index if not exists jetflo_po_delivery_date_idx on jetflo_purchase_orders (expected_delivery_date);
create index if not exists jetflo_po_receive_status_idx on jetflo_purchase_orders (receive_status);

-- 2. Enhance jetflo_purchase_order_items
alter table jetflo_purchase_order_items
  add column if not exists qty_received numeric not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'jetflo_poi_qty_received_chk'
  ) then
    alter table jetflo_purchase_order_items
      add constraint jetflo_poi_qty_received_chk check (qty_received >= 0);
  end if;
end $$;

-- 3. Create Goods Receipt (GRN) tables
create table if not exists jetflo_purchase_receives (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references jetflo_purchase_orders(id) on delete cascade,
  receive_no text not null,
  received_date date not null default current_date,
  received_by uuid references jetflo_users(id),
  delivery_challan_no text,
  remarks text,
  created_at timestamptz not null default now()
);

create index if not exists jetflo_pr_po_idx on jetflo_purchase_receives (purchase_order_id);

create table if not exists jetflo_purchase_receive_items (
  id uuid primary key default gen_random_uuid(),
  receive_id uuid not null references jetflo_purchase_receives(id) on delete cascade,
  po_item_id uuid not null references jetflo_purchase_order_items(id) on delete cascade,
  qty_received numeric not null check (qty_received > 0),
  created_at timestamptz not null default now()
);

create index if not exists jetflo_pri_recv_idx on jetflo_purchase_receive_items (receive_id);
create index if not exists jetflo_pri_item_idx on jetflo_purchase_receive_items (po_item_id);

-- 4. Trigger to maintain qty_received on jetflo_purchase_order_items and receive_status on jetflo_purchase_orders
create or replace function jetflo_recalc_po_receipts() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_po_item uuid;
  target_po uuid;
  total_ordered numeric;
  total_received numeric;
  new_receive_status text;
begin
  target_po_item := coalesce(new.po_item_id, old.po_item_id);
  
  -- Recalculate qty_received for this line item
  update jetflo_purchase_order_items
    set qty_received = coalesce((
      select sum(qty_received) from jetflo_purchase_receive_items where po_item_id = target_po_item
    ), 0),
    updated_at = now()
    where id = target_po_item
    returning purchase_order_id into target_po;

  -- Recalculate receive_status for the whole PO
  select coalesce(sum(qty), 0), coalesce(sum(qty_received), 0)
    into total_ordered, total_received
    from jetflo_purchase_order_items
    where purchase_order_id = target_po;

  if total_received <= 0 then
    new_receive_status := 'pending';
  elsif total_received >= total_ordered and total_ordered > 0 then
    new_receive_status := 'received';
  else
    new_receive_status := 'partially_received';
  end if;

  update jetflo_purchase_orders
    set receive_status = new_receive_status,
        updated_at = now()
    where id = target_po;

  return coalesce(new, old);
end $$;

drop trigger if exists jetflo_trg_recv_item_recalc on jetflo_purchase_receive_items;
create trigger jetflo_trg_recv_item_recalc
after insert or update or delete on jetflo_purchase_receive_items
for each row execute function jetflo_recalc_po_receipts();

-- 5. RLS Policies for GRN
alter table jetflo_purchase_receives enable row level security;
alter table jetflo_purchase_receive_items enable row level security;

create policy "jetflo_pr_select" on jetflo_purchase_receives
  for select using (auth.uid() is not null);

create policy "jetflo_pr_insert" on jetflo_purchase_receives
  for insert with check (
    auth.uid() is not null and
    jetflo_role() in ('requester', 'finance')
  );

create policy "jetflo_pri_select" on jetflo_purchase_receive_items
  for select using (auth.uid() is not null);

create policy "jetflo_pri_insert" on jetflo_purchase_receive_items
  for insert with check (
    auth.uid() is not null and
    jetflo_role() in ('requester', 'finance')
  );

-- 6. Allow Ground Team (Requesters) to create and edit Draft POs, keeping Issue strictly Finance-only
drop policy if exists jetflo_po_insert on jetflo_purchase_orders;
create policy jetflo_po_insert on jetflo_purchase_orders for insert
  with check (
    jetflo_role() in ('finance', 'requester') 
    and status = 'draft' 
    and created_by = auth.uid()
  );

drop policy if exists jetflo_po_select on jetflo_purchase_orders;
create policy jetflo_po_select on jetflo_purchase_orders for select
  using (
    (status <> 'draft' and jetflo_role() is not null)
    or (status = 'draft' and (jetflo_role() = 'finance' or created_by = auth.uid()))
  );

drop policy if exists jetflo_po_update on jetflo_purchase_orders;
create policy jetflo_po_update on jetflo_purchase_orders for update
  using (
    jetflo_role() = 'finance'
    or (jetflo_role() = 'requester' and status = 'draft' and created_by = auth.uid())
  );

drop policy if exists jetflo_poi_write on jetflo_purchase_order_items;
create policy jetflo_poi_write on jetflo_purchase_order_items for all
  using (
    exists (
      select 1 from jetflo_purchase_orders p 
      where p.id = purchase_order_id and p.status = 'draft'
      and (jetflo_role() = 'finance' or (jetflo_role() = 'requester' and p.created_by = auth.uid()))
    )
  );
