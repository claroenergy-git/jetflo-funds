-- JetFlo Migration 008: USD Foreign Transactions & Formal Currency Amendment Tracking
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/wanhdvyjgjuilqdqhlzt/sql/new

alter table jetflo_fund_requests add column if not exists currency text not null default 'INR';
alter table jetflo_fund_requests drop constraint if exists jetflo_fund_requests_currency_check;
alter table jetflo_fund_requests add constraint jetflo_fund_requests_currency_check check (currency in ('INR', 'USD'));

alter table jetflo_fund_requests add column if not exists currency_amended boolean not null default false;
alter table jetflo_fund_requests add column if not exists currency_amended_at timestamptz;
alter table jetflo_fund_requests add column if not exists currency_amended_by uuid references jetflo_users(id);
alter table jetflo_fund_requests add column if not exists previous_currency text;
alter table jetflo_fund_requests add column if not exists previous_amount numeric;
alter table jetflo_fund_requests add column if not exists currency_amendment_reason text;

comment on column jetflo_fund_requests.currency is 'Transaction currency: INR for domestic, USD for foreign transactions';
comment on column jetflo_fund_requests.currency_amended is 'Flag indicating currency was formally amended after ticket creation';
comment on column jetflo_fund_requests.currency_amended_at is 'Timestamp when formal currency amendment occurred';
comment on column jetflo_fund_requests.currency_amended_by is 'User who authorized the formal currency amendment';
comment on column jetflo_fund_requests.previous_currency is 'Previous currency before the formal amendment';
comment on column jetflo_fund_requests.previous_amount is 'Previous requested amount before amendment';
comment on column jetflo_fund_requests.currency_amendment_reason is 'Formal justification / operational note for currency amendment';

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
