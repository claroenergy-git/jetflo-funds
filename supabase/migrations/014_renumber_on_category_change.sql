-- 014: Renumber a request when its category changes while it is still editable.
--
-- Must be run as the owner of the jetflo_* functions (postgres). Based on the LIVE definitions of
-- jetflo_assign_request_no and jetflo_write_audit (013 version) as of 2026-11-21; changes are
-- marked "014".
--
-- Why: the JF-CAP / JF-RM prefix is assigned once at creation. If a requester later edits the
-- category (draft / sent back / withdrawn-for-edits), the number kept the old prefix — e.g.
-- JF-RM-0022 became a CAPEX request. Reports always used the category column, so totals were
-- right, but finance reads the prefix.
--
-- Rules:
--   * Only while editable (old status 'draft' or 'sent_back'), and only when the current prefix
--     doesn't match the new category → next number in the new series. Old number is retired.
--   * jetflo_trg_request_no fires before jetflo_trg_transition (alphabetical), and the transition
--     trigger already permits request_no changes in draft/sent_back — no change needed there.
--   * Audit timeline records 'renumbered' with old → new number.
--   * One-off: JF-RM-0022 (category capex, already resubmitted) gets the next JF-CAP number.
--   * Files/links use the request id, not the number, so nothing else is affected.

create or replace function public.jetflo_assign_request_no()
 returns trigger
 language plpgsql
as $function$
declare
  expected_prefix text;
begin
  if tg_op = 'INSERT' then
    if new.request_no is null then
      if new.category = 'capex' then
        new.request_no := 'JF-CAP-' || lpad(nextval('jetflo_seq_cap')::text, 4, '0');
      else
        new.request_no := 'JF-RM-' || lpad(nextval('jetflo_seq_rm')::text, 4, '0');
      end if;
    end if;

  -- 014: category edited while still editable → move to the matching number series
  elsif new.category is distinct from old.category and old.status in ('draft', 'sent_back') then
    expected_prefix := case when new.category = 'capex' then 'JF-CAP-' else 'JF-RM-' end;
    if new.request_no is null or new.request_no not like expected_prefix || '%' then
      if new.category = 'capex' then
        new.request_no := 'JF-CAP-' || lpad(nextval('jetflo_seq_cap')::text, 4, '0');
      else
        new.request_no := 'JF-RM-' || lpad(nextval('jetflo_seq_rm')::text, 4, '0');
      end if;
    end if;
  end if;
  return new;
end $function$;

-- 014: was BEFORE INSERT only
drop trigger if exists jetflo_trg_request_no on public.jetflo_fund_requests;
create trigger jetflo_trg_request_no
  before insert or update of category on public.jetflo_fund_requests
  for each row execute function public.jetflo_assign_request_no();

create or replace function public.jetflo_write_audit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- 014: record renumbering (independent of any status change in the same update)
  if tg_op = 'UPDATE' and new.request_no is distinct from old.request_no then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks)
    values (new.id, auth.uid(), 'renumbered', old.status, new.status,
            'Renumbered from ' || coalesce(old.request_no, '—') || ' to ' || new.request_no ||
            ' (category: ' || case when new.category = 'capex' then 'CAPEX' else 'Raw Material' end || ')');
  end if;

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

-- 014 one-off: JF-RM-0022 is a CAPEX request (category changed during withdraw-and-edit on
-- 2026-11-21, before this migration). Runs without a user context, so the transition trigger's
-- service bypass applies; the audit trigger above records 'renumbered' as a system action.
update public.jetflo_fund_requests
   set request_no = 'JF-CAP-' || lpad(nextval('jetflo_seq_cap')::text, 4, '0')
 where request_no = 'JF-RM-0022'
   and category = 'capex';
