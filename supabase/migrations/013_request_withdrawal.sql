-- 013: Requester can withdraw a SUBMITTED request back to draft to edit it, before finance decides.
--
-- Must be run as the owner of the jetflo_* functions (postgres). Based on the LIVE definitions of
-- jetflo_validate_transition / jetflo_write_audit as of 2026-11-20; the only changes are the
-- marked "013" blocks.
--
-- Rules:
--   * submitted → draft only by the owning requester, only while still 'submitted'
--     (once finance gives first approval / rejects / sends back, it is no longer withdrawable).
--   * A reason is mandatory. The app passes it as the transaction-local setting
--     jetflo.withdraw_reason (set_config(..., true)) in the same transaction as the UPDATE —
--     no new column needed.
--   * The audit timeline records action 'withdrawn' with the requester as actor and the reason.
--   * Approved / paid / closed requests remain immutable (unchanged).

create or replace function public.jetflo_validate_transition()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- 013: requester withdraws a not-yet-decided request back to draft for editing
  elsif old.status = 'submitted' and new.status = 'draft' then
    if r <> 'requester' or old.requester_id <> actor then
      raise exception 'Only the owning requester can withdraw a request';
    end if;
    if coalesce(current_setting('jetflo.withdraw_reason', true), '') = '' then
      raise exception 'A reason is required to withdraw a request';
    end if;
    new.submitted_at := null;

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
end $function$;

create or replace function public.jetflo_write_audit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks)
    values (new.id, coalesce(auth.uid(), new.requester_id), 'created', null, new.status, null);
  -- 013: withdrawal gets its own action label + the requester's reason
  elsif old.status = 'submitted' and new.status = 'draft' then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks)
    values (new.id, auth.uid(), 'withdrawn', old.status, new.status,
            nullif(current_setting('jetflo.withdraw_reason', true), ''));
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
end $function$;
