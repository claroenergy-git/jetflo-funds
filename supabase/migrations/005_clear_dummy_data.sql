-- JetFlo Migration 005: Clear Dummy Test Data & Reset Sequences
-- Cleans test fund requests, test payments, attachments, audit logs, and test vendors.

-- 1. Remove all test transaction records
truncate table jetflo_payments cascade;
truncate table jetflo_attachments cascade;
truncate table jetflo_audit_log cascade;
truncate table jetflo_fund_requests cascade;

-- 2. Reset Request Number sequences so new requests start from 0001
select setval('jetflo_seq_cap', 1, false);
select setval('jetflo_seq_rm', 1, false);

-- 3. Remove test/dummy vendors created during testing
delete from jetflo_vendors
where lower(name) in ('vendor', 'yash parashar', 'test vendor', 'dummy vendor')
   or email like '%@example.com'
   or email like '%test%';
