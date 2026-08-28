-- JetFlo demo seed: budget heads, vendors, ~30 requests across all workflow states.
-- Run scripts/seed-users.mjs FIRST (creates the demo auth users + jetflo_users profiles).
-- Applied to Supabase as migration `jetflo_seed_data` (+ a first_paid_at backfill).

select setval('jetflo_seq_cap', 1, false);
select setval('jetflo_seq_rm', 1, false);

do $seed$
declare
  u_ground uuid; u_fin1 uuid; u_fin2 uuid;
begin
  select id into u_ground from jetflo_users where email = 'ground@jetflo.in';
  select id into u_fin1 from jetflo_users where email = 'finance@claroenergy.in';
  select id into u_fin2 from jetflo_users where email = 'finance2@claroenergy.in';

  insert into jetflo_budget_heads (category, sub_head, sanctioned_amount) values
    ('capex','Machinery',12000000), ('capex','Testing Equipment',3500000),
    ('capex','Civil Work & Foundation',4000000), ('capex','Partitions & Interiors',1800000),
    ('capex','Furniture & Fixtures',800000), ('capex','Electrical & Wiring',1500000),
    ('capex','Painting & Finishing',600000), ('capex','Signage & Display Boards',400000),
    ('capex','Safety Equipment',750000), ('capex','Miscellaneous / Other',1000000),
    ('raw_material','Motors & Stators',null), ('raw_material','Impellers & Castings',null),
    ('raw_material','Controllers & Electronics',null), ('raw_material','Seals, Pipes & Fittings',null),
    ('raw_material','Fasteners & Consumables',null), ('raw_material','Packaging Material',null)
  on conflict do nothing;

  insert into jetflo_vendors (name, gstin, bank_name, ifsc, category, created_by) values
    ('Shakti Machine Tools Pvt Ltd','36AABCS1234F1Z5','HDFC Bank','HDFC0000123','capex',u_fin1),
    ('Precision Test Systems','36AAACP4321K1Z8','ICICI Bank','ICIC0000456','capex',u_fin1),
    ('BuildRight Constructions','36AADCB9876L1Z2','SBI','SBIN0000789','capex',u_fin1),
    ('Urban Interiors & Partitions','36AAECU5678M1Z9','Axis Bank','UTIB0000234','capex',u_fin1),
    ('Featherlite Workspaces','29AABCF2468N1Z4','HDFC Bank','HDFC0000567','capex',u_fin1),
    ('Sunrise Electricals','36AAFCS1357P1Z1','Kotak Bank','KKBK0000890','both',u_fin1),
    ('Hyderabad Metal Works','36AAGCH8642Q1Z6','SBI','SBIN0000321','raw_material',u_fin1),
    ('Vashi Components & Controls','27AAHCV9753R1Z3','ICICI Bank','ICIC0000654','raw_material',u_fin1),
    ('FlowSeal Polymers','36AAICF8520S1Z7','HDFC Bank','HDFC0000987','raw_material',u_fin1),
    ('Kranti Packaging Industries','36AAJCK7410T1Z0','Axis Bank','UTIB0000147','raw_material',u_fin1)
  on conflict do nothing;
end $seed$;

-- temp helpers for inserting seeded requests / payments / closures
create or replace function pg_temp.req(
  p_cat text, p_bh text, p_vend text, p_desc text, p_sku text,
  p_qty numeric, p_rate numeric, p_amt numeric, p_urg text, p_nbd date, p_ptype text,
  p_just text, p_status text, p_created timestamptz, p_submitted timestamptz,
  p_decided timestamptz, p_appr numeric, p_remarks text, p_rej text
) returns uuid language plpgsql as $$
declare
  rid uuid; u_ground uuid; u_fin1 uuid; u_fin2 uuid;
  needs2 boolean;
begin
  select id into u_ground from jetflo_users where email = 'ground@jetflo.in';
  select id into u_fin1 from jetflo_users where email = 'finance@claroenergy.in';
  select id into u_fin2 from jetflo_users where email = 'finance2@claroenergy.in';
  needs2 := coalesce(p_appr, 0) > 500000;

  insert into jetflo_fund_requests (
    category, budget_head_id, vendor_id, item_description, product_sku, qty, unit_rate,
    amount_requested, amount_approved, urgency, need_by_date, payment_type, justification,
    status, requester_id, approved_by, second_approved_by, approval_remarks, rejection_reason,
    submitted_at, decided_at, created_at, updated_at
  ) values (
    p_cat,
    (select id from jetflo_budget_heads where category = p_cat and sub_head = p_bh),
    (select id from jetflo_vendors where name = p_vend),
    p_desc, p_sku, p_qty, p_rate, p_amt,
    case when p_status in ('approved','partially_approved','awaiting_second_approval','paid','closed') then p_appr else null end,
    p_urg, p_nbd, p_ptype, p_just, p_status, u_ground,
    case when p_status in ('approved','partially_approved','awaiting_second_approval','paid','closed') then u_fin1 else null end,
    case when needs2 and p_status in ('approved','partially_approved','paid','closed') then u_fin2 else null end,
    p_remarks, p_rej, p_submitted, p_decided, p_created, coalesce(p_decided, p_submitted, p_created)
  ) returning id into rid;

  if p_submitted is not null then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, created_at)
    values (rid, u_ground, 'submitted', 'draft', 'submitted', p_submitted);
  end if;
  if p_status in ('approved','partially_approved','paid','closed') then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks, created_at)
    values (rid, u_fin1, case when p_status='partially_approved' then 'partially_approved' else 'approved' end,
            'submitted', case when p_status='partially_approved' then 'partially_approved' else 'approved' end,
            p_remarks, p_decided);
  elsif p_status = 'rejected' then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks, created_at)
    values (rid, u_fin1, 'rejected', 'submitted', 'rejected', p_rej, p_decided);
  elsif p_status = 'sent_back' then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks, created_at)
    values (rid, u_fin1, 'sent_back', 'submitted', 'sent_back', p_remarks, p_decided);
  elsif p_status = 'awaiting_second_approval' then
    insert into jetflo_audit_log (request_id, actor_id, action, old_status, new_status, remarks, created_at)
    values (rid, u_fin1, 'awaiting_second_approval', 'submitted', 'awaiting_second_approval', p_remarks, p_decided);
  end if;
  return rid;
end $$;

create or replace function pg_temp.pay(p_rid uuid, p_amt numeric, p_dt date, p_mode text, p_utr text)
returns void language plpgsql as $$
declare u_fin1 uuid;
begin
  select id into u_fin1 from jetflo_users where email = 'finance@claroenergy.in';
  insert into jetflo_payments (request_id, amount_paid, paid_on, mode, bank, utr_ref, recorded_by, created_at)
  values (p_rid, p_amt, p_dt, p_mode, 'HDFC Bank — Claro Energy Ltd', p_utr, u_fin1, p_dt::timestamptz + interval '11 hours');
end $$;

create or replace function pg_temp.close_req(p_rid uuid, p_closed timestamptz) returns void
language plpgsql as $$
declare u_ground uuid;
begin
  select id into u_ground from jetflo_users where email = 'ground@jetflo.in';
  insert into jetflo_attachments (request_id, kind, storage_path, file_name, uploaded_by, created_at)
  values (p_rid, 'invoice', 'seed/final-invoice.pdf', 'final-invoice.pdf', u_ground, p_closed - interval '2 hours');
  update jetflo_fund_requests set status='closed', goods_received=true, closed_at=p_closed, updated_at=p_closed
   where id = p_rid;
end $$;

do $seed2$
declare rid uuid;
begin
  -- CAPEX: paid & closed
  rid := pg_temp.req('capex','Civil Work & Foundation','BuildRight Constructions',
    'Plant civil foundation — machine beds, flooring & drainage', null, 1, 2650000, 2650000,
    'critical', '2026-05-15', 'advance', 'Foundation work must finish before machinery arrives',
    'approved', '2026-04-06 09:20+05:30', '2026-04-06 11:00+05:30', '2026-04-07 15:30+05:30', 2650000, 'Approved per plant setup plan', null);
  perform pg_temp.pay(rid, 1500000, '2026-04-10', 'rtgs', 'RTGSH26041012345');
  perform pg_temp.pay(rid, 1150000, '2026-05-18', 'rtgs', 'RTGSH26051867890');
  perform pg_temp.close_req(rid, '2026-05-28 14:00+05:30');

  rid := pg_temp.req('capex','Machinery','Shakti Machine Tools Pvt Ltd',
    'CNC winding machine — 2 units', null, 2, 1875000, 3750000,
    'critical', '2026-06-01', 'advance', 'Core production machinery for pump assembly line',
    'approved', '2026-04-14 10:05+05:30', '2026-04-14 12:30+05:30', '2026-04-16 17:00+05:30', 3750000, 'Approved; second approval by AN', null);
  perform pg_temp.pay(rid, 1875000, '2026-04-20', 'rtgs', 'RTGSH26042022334');
  perform pg_temp.pay(rid, 1875000, '2026-06-05', 'rtgs', 'RTGSH26060533445');
  perform pg_temp.close_req(rid, '2026-06-15 11:00+05:30');

  rid := pg_temp.req('capex','Testing Equipment','Precision Test Systems',
    'Pump performance test rig with flow meters', null, 1, 1420000, 1420000,
    'urgent', '2026-06-20', 'against_invoice', 'Required for QC before first dispatch',
    'approved', '2026-05-04 09:45+05:30', '2026-05-04 10:15+05:30', '2026-05-06 12:00+05:30', 1420000, 'Approved with 10% retention', null);
  perform pg_temp.pay(rid, 1420000, '2026-06-25', 'rtgs', 'RTGSH26062544556');
  perform pg_temp.close_req(rid, '2026-07-02 16:30+05:30');

  rid := pg_temp.req('capex','Partitions & Interiors','Urban Interiors & Partitions',
    'Gypsum partitions for office & QC cabin, incl. glass panels', null, 1, 680000, 680000,
    'normal', '2026-06-10', 'advance', 'Office block partitioning as per layout',
    'partially_approved', '2026-05-11 14:20+05:30', '2026-05-11 15:00+05:30', '2026-05-13 11:30+05:30', 650000, 'Approved ₹6.5L — glass panel spec downgraded to standard', null);
  perform pg_temp.pay(rid, 650000, '2026-05-20', 'neft', 'NEFTH26052055667');
  perform pg_temp.close_req(rid, '2026-06-18 10:00+05:30');

  rid := pg_temp.req('capex','Furniture & Fixtures','Featherlite Workspaces',
    'Workstations x12, chairs x20, storage cabinets x6', null, 1, 485000, 485000,
    'normal', '2026-06-15', 'against_invoice', 'Office furniture for admin and engineering team',
    'approved', '2026-05-18 11:00+05:30', '2026-05-18 11:40+05:30', '2026-05-19 09:30+05:30', 485000, 'Approved', null);
  perform pg_temp.pay(rid, 485000, '2026-06-18', 'neft', 'NEFTH26061866778');
  perform pg_temp.close_req(rid, '2026-06-25 12:00+05:30');

  -- CAPEX: paid, not closed (unclosed advances for aging)
  rid := pg_temp.req('capex','Electrical & Wiring','Sunrise Electricals',
    'HT panel, cabling & earthing for shop floor', null, 1, 980000, 980000,
    'urgent', '2026-07-10', 'advance', 'Power infrastructure for machinery commissioning',
    'approved', '2026-06-08 10:30+05:30', '2026-06-08 11:00+05:30', '2026-06-10 14:00+05:30', 980000, 'Approved; second approval by AN', null);
  perform pg_temp.pay(rid, 980000, '2026-06-14', 'rtgs', 'RTGSH26061477889');

  rid := pg_temp.req('capex','Painting & Finishing','BuildRight Constructions',
    'Epoxy floor coating + wall painting, full plant', null, 1, 420000, 420000,
    'normal', '2026-08-05', 'advance', 'Floor coating before line commissioning',
    'approved', '2026-07-06 09:00+05:30', '2026-07-06 09:30+05:30', '2026-07-08 10:00+05:30', 420000, 'Approved', null);
  perform pg_temp.pay(rid, 420000, '2026-07-12', 'neft', 'NEFTH26071288990');

  rid := pg_temp.req('capex','Safety Equipment','Sunrise Electricals',
    'Fire extinguishers, smoke detectors, safety signage', null, 1, 265000, 265000,
    'urgent', '2026-08-01', 'against_invoice', 'Statutory fire-safety compliance',
    'approved', '2026-07-14 15:00+05:30', '2026-07-14 15:20+05:30', '2026-07-15 11:00+05:30', 265000, 'Approved', null);
  perform pg_temp.pay(rid, 265000, '2026-08-02', 'neft', 'NEFTH26080299001');

  -- CAPEX: approved not yet paid
  rid := pg_temp.req('capex','Machinery','Shakti Machine Tools Pvt Ltd',
    'Hydraulic press for impeller assembly', null, 1, 890000, 890000,
    'urgent', '2026-09-10', 'advance', 'Second-stage assembly machinery',
    'approved', '2026-08-10 10:00+05:30', '2026-08-10 10:45+05:30', '2026-08-12 16:00+05:30', 890000, 'Approved; second approval by AN', null);

  rid := pg_temp.req('capex','Signage & Display Boards','Urban Interiors & Partitions',
    'Factory signage, safety display boards, KPI boards', null, 1, 180000, 180000,
    'normal', '2026-09-15', 'against_invoice', 'Shop floor visual management boards',
    'partially_approved', '2026-08-14 11:30+05:30', '2026-08-14 12:00+05:30', '2026-08-17 10:30+05:30', 165000, 'Approved ₹1.65L — dropped LED board, use printed', null);

  -- CAPEX: awaiting second approval
  rid := pg_temp.req('capex','Testing Equipment','Precision Test Systems',
    'Endurance test bench — 8 station', null, 1, 760000, 760000,
    'normal', '2026-09-30', 'advance', 'Long-cycle endurance testing for warranty claims reduction',
    'awaiting_second_approval', '2026-08-19 09:15+05:30', '2026-08-19 10:00+05:30', '2026-08-20 14:30+05:30', 760000, 'First approval done — above ₹5L, needs second approver', null);

  -- CAPEX: submitted / sent back / rejected / draft
  rid := pg_temp.req('capex','Electrical & Wiring','Sunrise Electricals',
    'DG set 125 kVA backup power', null, 1, 1150000, 1150000,
    'urgent', '2026-09-20', 'advance', 'Power backup — grid outages disrupting trial runs',
    'submitted', '2026-08-22 10:00+05:30', '2026-08-22 10:30+05:30', null, null, null, null);

  rid := pg_temp.req('capex','Partitions & Interiors','Urban Interiors & Partitions',
    'Canteen area furnishing & modular kitchen', null, 1, 340000, 340000,
    'normal', '2026-10-01', 'advance', 'Worker canteen setup',
    'submitted', '2026-08-24 14:00+05:30', '2026-08-24 14:30+05:30', null, null, null, null);

  rid := pg_temp.req('capex','Machinery','Shakti Machine Tools Pvt Ltd',
    'Pick-and-place robot arm for packing line', null, 1, 2200000, 2200000,
    'normal', '2026-11-30', 'advance', 'Automation of packing line',
    'sent_back', '2026-08-11 16:00+05:30', '2026-08-11 16:30+05:30', '2026-08-13 12:00+05:30', null, 'Need 3 comparative quotes and ROI working before this size of spend', null);

  rid := pg_temp.req('capex','Miscellaneous / Other','Featherlite Workspaces',
    'Recreation room — TT table, seating', null, 1, 145000, 145000,
    'normal', '2026-10-15', 'against_invoice', 'Employee welfare',
    'rejected', '2026-08-05 11:00+05:30', '2026-08-05 11:20+05:30', '2026-08-06 09:45+05:30', null, null, 'Deferred to Q4 — not critical for plant commissioning');

  rid := pg_temp.req('capex','Safety Equipment','Sunrise Electricals',
    'PPE kits — helmets, shoes, gloves x50 sets', null, 50, 2400, 120000,
    'normal', '2026-09-05', 'against_invoice', 'PPE for production workers',
    'draft', '2026-08-25 17:00+05:30', null, null, null, null, null);

  -- RAW MATERIAL
  rid := pg_temp.req('raw_material','Motors & Stators','Vashi Components & Controls',
    '1HP submersible motor stators — batch 1', 'JF-SUB-1HP', 200, 2150, 430000,
    'critical', '2026-06-05', 'advance', 'First production batch of 200 pumps',
    'approved', '2026-05-20 09:30+05:30', '2026-05-20 10:00+05:30', '2026-05-21 11:00+05:30', 430000, 'Approved', null);
  perform pg_temp.pay(rid, 430000, '2026-05-25', 'neft', 'NEFTH26052511223');
  perform pg_temp.close_req(rid, '2026-06-10 15:00+05:30');

  rid := pg_temp.req('raw_material','Impellers & Castings','Hyderabad Metal Works',
    'SS impeller castings — 400 pcs', 'JF-SUB-1HP', 400, 385, 154000,
    'urgent', '2026-06-08', 'against_invoice', 'Castings for batch 1 & 2',
    'approved', '2026-05-22 10:15+05:30', '2026-05-22 11:00+05:30', '2026-05-23 09:30+05:30', 154000, 'Approved', null);
  perform pg_temp.pay(rid, 154000, '2026-06-12', 'neft', 'NEFTH26061222334');
  perform pg_temp.close_req(rid, '2026-06-20 11:30+05:30');

  rid := pg_temp.req('raw_material','Controllers & Electronics','Vashi Components & Controls',
    'Pump controllers with dry-run protection — 200 units', 'JF-SUB-1HP', 200, 1240, 248000,
    'urgent', '2026-06-15', 'advance', 'Controllers for batch 1',
    'approved', '2026-05-28 14:00+05:30', '2026-05-28 14:30+05:30', '2026-05-29 10:00+05:30', 248000, 'Approved', null);
  perform pg_temp.pay(rid, 248000, '2026-06-03', 'upi', 'UPIH2606031829');
  perform pg_temp.close_req(rid, '2026-06-22 09:00+05:30');

  rid := pg_temp.req('raw_material','Motors & Stators','Vashi Components & Controls',
    '1.5HP motor stators — batch 2', 'JF-SUB-1.5HP', 300, 2680, 804000,
    'critical', '2026-07-20', 'advance', 'Batch 2 production — 300 units of 1.5HP variant',
    'approved', '2026-07-01 09:00+05:30', '2026-07-01 09:40+05:30', '2026-07-03 15:00+05:30', 804000, 'Approved; second approval by AN', null);
  perform pg_temp.pay(rid, 400000, '2026-07-08', 'rtgs', 'RTGSH26070833445');
  perform pg_temp.pay(rid, 404000, '2026-08-01', 'rtgs', 'RTGSH26080144556');

  rid := pg_temp.req('raw_material','Seals, Pipes & Fittings','FlowSeal Polymers',
    'Mechanical seals & O-ring kits — 500 sets', null, 500, 165, 82500,
    'normal', '2026-07-25', 'against_invoice', 'Seals for batches 2 and 3',
    'approved', '2026-07-05 11:30+05:30', '2026-07-05 12:00+05:30', '2026-07-06 10:00+05:30', 82500, 'Approved', null);
  perform pg_temp.pay(rid, 82500, '2026-07-28', 'neft', 'NEFTH26072855667');

  rid := pg_temp.req('raw_material','Packaging Material','Kranti Packaging Industries',
    'Corrugated boxes + foam inserts — 600 sets', null, 600, 95, 57000,
    'normal', '2026-08-01', 'against_invoice', 'Packaging for batches 1–3',
    'approved', '2026-07-12 15:00+05:30', '2026-07-12 15:30+05:30', '2026-07-13 11:00+05:30', 57000, 'Approved', null);
  perform pg_temp.pay(rid, 57000, '2026-08-05', 'upi', 'UPIH2608051042');

  rid := pg_temp.req('raw_material','Impellers & Castings','Hyderabad Metal Works',
    'Bronze impeller castings — 300 pcs', 'JF-SUB-1.5HP', 300, 512, 153600,
    'urgent', '2026-08-20', 'advance', 'Castings for 1.5HP batch',
    'approved', '2026-08-08 10:00+05:30', '2026-08-08 10:30+05:30', '2026-08-10 09:30+05:30', 153600, 'Approved', null);
  perform pg_temp.pay(rid, 76800, '2026-08-14', 'neft', 'NEFTH26081466778');

  rid := pg_temp.req('raw_material','Fasteners & Consumables','Hyderabad Metal Works',
    'SS fasteners, welding consumables — monthly stock', null, 1, 68000, 68000,
    'normal', '2026-08-25', 'against_invoice', 'Monthly consumables replenishment',
    'approved', '2026-08-16 09:30+05:30', '2026-08-16 10:00+05:30', '2026-08-17 14:00+05:30', 68000, 'Approved', null);

  rid := pg_temp.req('raw_material','Controllers & Electronics','Vashi Components & Controls',
    'Control panels 1.5HP — 300 units', 'JF-SUB-1.5HP', 300, 1385, 415500,
    'urgent', '2026-09-05', 'advance', 'Controllers for batch 2',
    'approved', '2026-08-18 11:00+05:30', '2026-08-18 11:30+05:30', '2026-08-20 10:00+05:30', 415500, 'Approved', null);

  rid := pg_temp.req('raw_material','Motors & Stators','Vashi Components & Controls',
    '2HP motor stators — pilot batch 50', 'JF-SUB-2HP', 50, 3150, 157500,
    'normal', '2026-09-25', 'advance', 'Pilot run of 2HP variant',
    'submitted', '2026-08-23 10:00+05:30', '2026-08-23 10:20+05:30', null, null, null, null);

  rid := pg_temp.req('raw_material','Seals, Pipes & Fittings','FlowSeal Polymers',
    'HDPE pipe adapters — 1000 pcs', null, 1000, 42, 42000,
    'normal', '2026-09-15', 'against_invoice', 'Adapters for retail kit',
    'submitted', '2026-08-25 16:00+05:30', '2026-08-25 16:15+05:30', null, null, null, null);

  rid := pg_temp.req('raw_material','Impellers & Castings','Hyderabad Metal Works',
    'SS impeller castings — 2HP, 100 pcs', 'JF-SUB-2HP', 100, 610, 61000,
    'normal', '2026-09-20', 'advance', 'Castings for 2HP pilot',
    'sent_back', '2026-08-20 12:00+05:30', '2026-08-20 12:30+05:30', '2026-08-21 10:00+05:30', null, 'Attach the revised quotation — rate differs from last PO', null);

  rid := pg_temp.req('raw_material','Packaging Material','Kranti Packaging Industries',
    'Printed premium cartons — 1000 pcs', null, 1000, 118, 118000,
    'normal', '2026-09-30', 'against_invoice', 'New retail packaging design',
    'rejected', '2026-08-12 14:30+05:30', '2026-08-12 15:00+05:30', '2026-08-13 11:30+05:30', null, null, 'Use existing carton stock first; revisit in October');

  rid := pg_temp.req('raw_material','Fasteners & Consumables','Hyderabad Metal Works',
    'Thread-locker & assembly adhesives', null, 1, 23500, 23500,
    'normal', '2026-09-10', 'against_invoice', 'Assembly line consumables',
    'draft', '2026-08-26 09:00+05:30', null, null, null, null, null);
end $seed2$;

-- align audit rows with seeded timestamps/actors
update jetflo_audit_log a
   set created_at = r.created_at, actor_id = r.requester_id
  from jetflo_fund_requests r
 where a.request_id = r.id and a.action = 'created';

update jetflo_audit_log a
   set actor_id = (select id from jetflo_users where email='finance@claroenergy.in'),
       created_at = p.created_at
  from jetflo_payments p
 where a.request_id = p.request_id and a.action = 'payment_recorded'
   and a.remarks like '%' || p.utr_ref || '%';

update jetflo_audit_log a
   set actor_id = r.requester_id, created_at = r.closed_at
  from jetflo_fund_requests r
 where a.request_id = r.id and a.action = 'closed' and r.closed_at is not null;

-- backfill first_paid_at from actual payment dates (the trigger stamps now() during seeding)
update jetflo_fund_requests r
   set first_paid_at = p.first_paid
  from (select request_id, min(paid_on)::timestamptz + interval '11 hours' as first_paid
          from jetflo_payments group by request_id) p
 where r.id = p.request_id;
