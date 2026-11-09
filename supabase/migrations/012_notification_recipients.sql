-- 012: Extra notification recipients per team.
-- Employees without a portal login who should still be copied on workflow emails:
--   ground   → approved / partially approved / rejected / sent back / payment recorded
--   accounts → submitted / needs second approver / currency amended
-- Portal users (the requester, finance logins) are notified as before; this list is additive.

create table if not exists jetflo_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  team text not null check (team in ('ground', 'accounts')),
  name text,
  email text not null check (email = lower(email) and email like '%_@_%._%'),
  created_by uuid references jetflo_users(id),
  created_at timestamptz not null default now(),
  unique (team, email)
);

alter table jetflo_notification_recipients enable row level security;

-- The app connects as jetflo_app (RLS) and jetflo_service (bypass). Default privileges cover
-- tables created by `postgres`; grant explicitly in case another owner runs this.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'jetflo_app') then
    grant select, insert, update, delete on jetflo_notification_recipients to jetflo_app;
  end if;
  if exists (select 1 from pg_roles where rolname = 'jetflo_service') then
    grant select, insert, update, delete on jetflo_notification_recipients to jetflo_service;
  end if;
end $$;

-- Managed from the leadership Settings page. Writes go through the service role after an
-- app-level leadership check (same as jetflo_settings), so there is deliberately no write policy.
drop policy if exists jetflo_notif_recipients_select on jetflo_notification_recipients;
create policy jetflo_notif_recipients_select on jetflo_notification_recipients for select
  using (jetflo_role() = 'leadership');
