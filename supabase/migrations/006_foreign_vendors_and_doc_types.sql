-- JetFlo Migration 006: Foreign / Import Vendors & Bank Verification Document Types
-- Safe, non-breaking schema update

alter table jetflo_vendors add column if not exists is_foreign boolean not null default false;
alter table jetflo_vendors add column if not exists country text default 'India';
alter table jetflo_vendors add column if not exists vat_no text;
alter table jetflo_vendors add column if not exists swift_code text;
alter table jetflo_vendors add column if not exists district text;
alter table jetflo_vendors add column if not exists bank_doc_type text default 'cancelled_cheque';
