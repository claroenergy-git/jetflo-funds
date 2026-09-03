-- Migration: 006_add_tax_and_round_off.sql
-- Add optional tax and round-off calculation fields to jetflo_fund_requests

alter table jetflo_fund_requests add column if not exists tax_percent numeric;
alter table jetflo_fund_requests add column if not exists tax_amount numeric;
alter table jetflo_fund_requests add column if not exists round_off numeric;

comment on column jetflo_fund_requests.tax_percent is 'Applicable tax percentage (e.g. 18 for 18% GST)';
comment on column jetflo_fund_requests.tax_amount is 'Calculated or specified tax amount in INR';
comment on column jetflo_fund_requests.round_off is 'Rounding adjustment amount in INR (+/-)';
