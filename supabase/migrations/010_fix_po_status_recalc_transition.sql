-- Fix: jetflo_po_recalc_status()'s automatic status updates (open <-> partially_billed
-- <-> fully_billed) were being rejected by jetflo_po_validate_transition() as an
-- "illegal transition", because that trigger only recognized the manual
-- issue/second-approve/cancel transitions. These three are just a billing-progress
-- label, not a security-relevant state change, so allow free movement between them.

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

  -- billing-progress sub-states: recomputed automatically by jetflo_po_recalc_status(),
  -- not a manually-initiated transition, so no gate is needed between them.
  if old.status in ('open','partially_billed','fully_billed')
     and new.status in ('open','partially_billed','fully_billed') then
    return new;
  end if;

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
