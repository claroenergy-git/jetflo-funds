// In-memory mock database and Supabase emulator for JetFlo Funds Portal
import type { Profile } from "./types";

export const MOCK_USERS: (Profile & { phone: string; password?: string })[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    email: "ground@jetflo.in",
    name: "Ravi Kumar",
    role: "requester",
    plant: "JetFlo Hyderabad",
    phone: "+91 98490 11111",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    email: "finance@claroenergy.in",
    name: "Meera Shah",
    role: "finance",
    plant: "Claro Energy, Mumbai",
    phone: "+91 98200 22222",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    email: "finance2@claroenergy.in",
    name: "Arjun Nair",
    role: "finance",
    plant: "Claro Energy, Mumbai",
    phone: "+91 98200 33333",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    email: "leadership@claroenergy.in",
    name: "K Wahi",
    role: "leadership",
    plant: "Claro Energy, Mumbai",
    phone: "+91 98100 44444",
  },
];

export const MOCK_BUDGET_HEADS = [
  { id: "bh-1", category: "capex", sub_head: "Machinery", sanctioned_amount: 12000000, active: true },
  { id: "bh-2", category: "capex", sub_head: "Testing Equipment", sanctioned_amount: 3500000, active: true },
  { id: "bh-3", category: "capex", sub_head: "Civil Work & Foundation", sanctioned_amount: 4000000, active: true },
  { id: "bh-4", category: "capex", sub_head: "Partitions & Interiors", sanctioned_amount: 1800000, active: true },
  { id: "bh-5", category: "capex", sub_head: "Furniture & Fixtures", sanctioned_amount: 800000, active: true },
  { id: "bh-6", category: "capex", sub_head: "Electrical & Wiring", sanctioned_amount: 1500000, active: true },
  { id: "bh-7", category: "capex", sub_head: "Painting & Finishing", sanctioned_amount: 600000, active: true },
  { id: "bh-8", category: "capex", sub_head: "Signage & Display Boards", sanctioned_amount: 400000, active: true },
  { id: "bh-9", category: "capex", sub_head: "Safety Equipment", sanctioned_amount: 750000, active: true },
  { id: "bh-10", category: "capex", sub_head: "Miscellaneous / Other", sanctioned_amount: 1000000, active: true },
  { id: "bh-11", category: "raw_material", sub_head: "Motors & Stators", sanctioned_amount: null, active: true },
  { id: "bh-12", category: "raw_material", sub_head: "Impellers & Castings", sanctioned_amount: null, active: true },
  { id: "bh-13", category: "raw_material", sub_head: "Controllers & Electronics", sanctioned_amount: null, active: true },
  { id: "bh-14", category: "raw_material", sub_head: "Seals, Pipes & Fittings", sanctioned_amount: null, active: true },
  { id: "bh-15", category: "raw_material", sub_head: "Fasteners & Consumables", sanctioned_amount: null, active: true },
  { id: "bh-16", category: "raw_material", sub_head: "Packaging Material", sanctioned_amount: null, active: true },
];

export const MOCK_VENDORS = [
  { id: "v-1", name: "Shakti Machine Tools Pvt Ltd", gstin: "36AABCS1234F1Z5", bank_name: "HDFC Bank", ifsc: "HDFC0000123", category: "capex", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-2", name: "Precision Test Systems", gstin: "36AAACP4321K1Z8", bank_name: "ICICI Bank", ifsc: "ICIC0000456", category: "capex", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-3", name: "BuildRight Constructions", gstin: "36AADCB9876L1Z2", bank_name: "SBI", ifsc: "SBIN0000789", category: "capex", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-4", name: "Urban Interiors & Partitions", gstin: "36AAECU5678M1Z9", bank_name: "Axis Bank", ifsc: "UTIB0000234", category: "capex", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-5", name: "Featherlite Workspaces", gstin: "29AABCF2468N1Z4", bank_name: "HDFC Bank", ifsc: "HDFC0000567", category: "capex", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-6", name: "Sunrise Electricals", gstin: "36AAFCS1357P1Z1", bank_name: "Kotak Bank", ifsc: "KKBK0000890", category: "both", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-7", name: "Hyderabad Metal Works", gstin: "36AAGCH8642Q1Z6", bank_name: "SBI", ifsc: "SBIN0000321", category: "raw_material", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-8", name: "Vashi Components & Controls", gstin: "27AAHCV9753R1Z3", bank_name: "ICICI Bank", ifsc: "ICIC0000654", category: "raw_material", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-9", name: "FlowSeal Polymers", gstin: "36AAICF8520S1Z7", bank_name: "HDFC Bank", ifsc: "HDFC0000987", category: "raw_material", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
  { id: "v-10", name: "Kranti Packaging Industries", gstin: "36AAJCK7410T1Z0", bank_name: "Axis Bank", ifsc: "UTIB0000147", category: "raw_material", active: true, created_by: "22222222-2222-2222-2222-222222222222" },
];

export const MOCK_SETTINGS = [
  { key: "second_approver_above", value: "500000" },
  { key: "quotation_mandatory_above", value: "50000" },
  { key: "duplicate_window_days", value: "7" },
];

export interface MockFundRequest {
  id: string;
  request_no: string;
  category: "capex" | "raw_material";
  budget_head_id: string;
  vendor_id: string;
  item_description: string;
  product_sku: string | null;
  qty: number | null;
  unit_rate: number | null;
  amount_requested: number;
  amount_approved: number | null;
  amount_paid: number;
  urgency: "normal" | "urgent" | "critical";
  need_by_date: string;
  payment_type: "advance" | "against_invoice" | "reimbursement";
  justification: string;
  status: string;
  requester_id: string;
  approved_by: string | null;
  second_approved_by: string | null;
  approval_remarks: string | null;
  rejection_reason: string | null;
  duplicate_warning?: boolean;
  goods_received?: boolean;
  submitted_at: string | null;
  decided_at: string | null;
  first_paid_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockPayment {
  id: string;
  request_id: string;
  amount_paid: number;
  paid_on: string;
  mode: "neft" | "rtgs" | "upi" | "cheque";
  bank: string;
  utr_ref: string;
  recorded_by: string;
  created_at: string;
}

export interface MockAttachment {
  id: string;
  request_id: string;
  kind: string;
  storage_path: string;
  file_name: string;
  uploaded_by: string;
  created_at: string;
}

export interface MockAuditLog {
  id: string;
  request_id: string;
  actor_id: string;
  action: string;
  old_status?: string;
  new_status?: string;
  remarks?: string;
  created_at: string;
}

// Initial Seed Dataset
const u_ground = "11111111-1111-1111-1111-111111111111";
const u_fin1 = "22222222-2222-2222-2222-222222222222";
const u_fin2 = "33333333-3333-3333-3333-333333333333";

function findBh(cat: string, sub: string) {
  return MOCK_BUDGET_HEADS.find((b) => b.category === cat && b.sub_head === sub)?.id ?? "bh-1";
}
function findVend(name: string) {
  return MOCK_VENDORS.find((v) => v.name === name)?.id ?? "v-1";
}

let reqSeq = 100;
function createMockReq(params: {
  id: string;
  no: string;
  cat: "capex" | "raw_material";
  bh: string;
  vend: string;
  desc: string;
  sku?: string | null;
  qty?: number | null;
  rate?: number | null;
  amt: number;
  urg: "normal" | "urgent" | "critical";
  nbd: string;
  ptype: "advance" | "against_invoice" | "reimbursement";
  just: string;
  status: string;
  created: string;
  submitted?: string | null;
  decided?: string | null;
  appr?: number | null;
  remarks?: string | null;
  rej?: string | null;
  paid?: number;
  closed?: string | null;
  first_paid?: string | null;
}): MockFundRequest {
  const needs2 = (params.appr ?? 0) > 500000;
  return {
    id: params.id,
    request_no: params.no,
    category: params.cat,
    budget_head_id: findBh(params.cat, params.bh),
    vendor_id: findVend(params.vend),
    item_description: params.desc,
    product_sku: params.sku ?? null,
    qty: params.qty ?? null,
    unit_rate: params.rate ?? null,
    amount_requested: params.amt,
    amount_approved: ["approved", "partially_approved", "awaiting_second_approval", "paid", "closed"].includes(params.status) ? (params.appr ?? params.amt) : null,
    amount_paid: params.paid ?? 0,
    urgency: params.urg,
    need_by_date: params.nbd,
    payment_type: params.ptype,
    justification: params.just,
    status: params.status,
    requester_id: u_ground,
    approved_by: ["approved", "partially_approved", "awaiting_second_approval", "paid", "closed"].includes(params.status) ? u_fin1 : null,
    second_approved_by: needs2 && ["approved", "partially_approved", "paid", "closed"].includes(params.status) ? u_fin2 : null,
    approval_remarks: params.remarks ?? null,
    rejection_reason: params.rej ?? null,
    goods_received: params.status === "closed",
    submitted_at: params.submitted ?? null,
    decided_at: params.decided ?? null,
    first_paid_at: params.first_paid ?? null,
    closed_at: params.closed ?? null,
    created_at: params.created,
    updated_at: params.closed ?? params.decided ?? params.submitted ?? params.created,
  };
}

export const INITIAL_REQUESTS: MockFundRequest[] = [
  createMockReq({
    id: "req-1", no: "CAP-001", cat: "capex", bh: "Civil Work & Foundation", vend: "BuildRight Constructions",
    desc: "Plant civil foundation — machine beds, flooring & drainage", amt: 2650000, urg: "critical", nbd: "2026-05-15", ptype: "advance",
    just: "Foundation work must finish before machinery arrives", status: "closed", created: "2026-04-06T03:50:00Z", submitted: "2026-04-06T05:30:00Z",
    decided: "2026-04-07T10:00:00Z", appr: 2650000, remarks: "Approved per plant setup plan", paid: 2650000, first_paid: "2026-04-10T11:00:00Z", closed: "2026-05-28T08:30:00Z",
  }),
  createMockReq({
    id: "req-2", no: "CAP-002", cat: "capex", bh: "Machinery", vend: "Shakti Machine Tools Pvt Ltd",
    desc: "CNC winding machine — 2 units", qty: 2, rate: 1875000, amt: 3750000, urg: "critical", nbd: "2026-06-01", ptype: "advance",
    just: "Core production machinery for pump assembly line", status: "closed", created: "2026-04-14T04:35:00Z", submitted: "2026-04-14T07:00:00Z",
    decided: "2026-04-16T11:30:00Z", appr: 3750000, remarks: "Approved; second approval by AN", paid: 3750000, first_paid: "2026-04-20T11:00:00Z", closed: "2026-06-15T05:30:00Z",
  }),
  createMockReq({
    id: "req-3", no: "CAP-003", cat: "capex", bh: "Testing Equipment", vend: "Precision Test Systems",
    desc: "Pump performance test rig with flow meters", amt: 1420000, urg: "urgent", nbd: "2026-06-20", ptype: "against_invoice",
    just: "Required for QC before first dispatch", status: "closed", created: "2026-05-04T04:15:00Z", submitted: "2026-05-04T04:45:00Z",
    decided: "2026-05-06T06:30:00Z", appr: 1420000, remarks: "Approved with 10% retention", paid: 1420000, first_paid: "2026-06-25T11:00:00Z", closed: "2026-07-02T11:00:00Z",
  }),
  createMockReq({
    id: "req-4", no: "CAP-004", cat: "capex", bh: "Partitions & Interiors", vend: "Urban Interiors & Partitions",
    desc: "Gypsum partitions for office & QC cabin, incl. glass panels", amt: 680000, urg: "normal", nbd: "2026-06-10", ptype: "advance",
    just: "Office block partitioning as per layout", status: "closed", created: "2026-05-11T08:50:00Z", submitted: "2026-05-11T09:30:00Z",
    decided: "2026-05-13T06:00:00Z", appr: 650000, remarks: "Approved ₹6.5L — glass panel spec downgraded to standard", paid: 650000, first_paid: "2026-05-20T11:00:00Z", closed: "2026-06-18T04:30:00Z",
  }),
  createMockReq({
    id: "req-5", no: "CAP-005", cat: "capex", bh: "Furniture & Fixtures", vend: "Featherlite Workspaces",
    desc: "Workstations x12, chairs x20, storage cabinets x6", amt: 485000, urg: "normal", nbd: "2026-06-15", ptype: "against_invoice",
    just: "Office furniture for admin and engineering team", status: "closed", created: "2026-05-18T05:30:00Z", submitted: "2026-05-18T06:10:00Z",
    decided: "2026-05-19T04:00:00Z", appr: 485000, remarks: "Approved", paid: 485000, first_paid: "2026-06-18T11:00:00Z", closed: "2026-06-25T06:30:00Z",
  }),
  createMockReq({
    id: "req-6", no: "CAP-006", cat: "capex", bh: "Electrical & Wiring", vend: "Sunrise Electricals",
    desc: "HT panel, cabling & earthing for shop floor", amt: 980000, urg: "urgent", nbd: "2026-07-10", ptype: "advance",
    just: "Power infrastructure for machinery commissioning", status: "paid", created: "2026-06-08T05:00:00Z", submitted: "2026-06-08T05:30:00Z",
    decided: "2026-06-10T08:30:00Z", appr: 980000, remarks: "Approved; second approval by AN", paid: 980000, first_paid: "2026-06-14T11:00:00Z",
  }),
  createMockReq({
    id: "req-7", no: "CAP-007", cat: "capex", bh: "Painting & Finishing", vend: "BuildRight Constructions",
    desc: "Epoxy floor coating + wall painting, full plant", amt: 420000, urg: "normal", nbd: "2026-08-05", ptype: "advance",
    just: "Floor coating before line commissioning", status: "paid", created: "2026-07-06T03:30:00Z", submitted: "2026-07-06T04:00:00Z",
    decided: "2026-07-08T04:30:00Z", appr: 420000, remarks: "Approved", paid: 420000, first_paid: "2026-07-12T11:00:00Z",
  }),
  createMockReq({
    id: "req-8", no: "CAP-008", cat: "capex", bh: "Safety Equipment", vend: "Sunrise Electricals",
    desc: "Fire extinguishers, smoke detectors, safety signage", amt: 265000, urg: "urgent", nbd: "2026-08-01", ptype: "against_invoice",
    just: "Statutory fire-safety compliance", status: "paid", created: "2026-07-14T09:30:00Z", submitted: "2026-07-14T09:50:00Z",
    decided: "2026-07-15T05:30:00Z", appr: 265000, remarks: "Approved", paid: 265000, first_paid: "2026-08-02T11:00:00Z",
  }),
  createMockReq({
    id: "req-9", no: "CAP-009", cat: "capex", bh: "Machinery", vend: "Shakti Machine Tools Pvt Ltd",
    desc: "Hydraulic press for impeller assembly", amt: 890000, urg: "urgent", nbd: "2026-09-10", ptype: "advance",
    just: "Second-stage assembly machinery", status: "approved", created: "2026-08-10T04:30:00Z", submitted: "2026-08-10T05:15:00Z",
    decided: "2026-08-12T10:30:00Z", appr: 890000, remarks: "Approved; second approval by AN", paid: 0,
  }),
  createMockReq({
    id: "req-10", no: "CAP-010", cat: "capex", bh: "Signage & Display Boards", vend: "Urban Interiors & Partitions",
    desc: "Factory signage, safety display boards, KPI boards", amt: 180000, urg: "normal", nbd: "2026-09-15", ptype: "against_invoice",
    just: "Shop floor visual management boards", status: "partially_approved", created: "2026-08-14T06:00:00Z", submitted: "2026-08-14T06:30:00Z",
    decided: "2026-08-17T05:00:00Z", appr: 165000, remarks: "Approved ₹1.65L — dropped LED board, use printed", paid: 0,
  }),
  createMockReq({
    id: "req-11", no: "CAP-011", cat: "capex", bh: "Testing Equipment", vend: "Precision Test Systems",
    desc: "Endurance test bench — 8 station", amt: 760000, urg: "normal", nbd: "2026-09-30", ptype: "advance",
    just: "Long-cycle endurance testing for warranty claims reduction", status: "awaiting_second_approval", created: "2026-08-19T03:45:00Z", submitted: "2026-08-19T04:30:00Z",
    decided: "2026-08-20T09:00:00Z", appr: 760000, remarks: "First approval done — above ₹5L, needs second approver", paid: 0,
  }),
  createMockReq({
    id: "req-12", no: "CAP-012", cat: "capex", bh: "Electrical & Wiring", vend: "Sunrise Electricals",
    desc: "DG set 125 kVA backup power", amt: 1150000, urg: "urgent", nbd: "2026-09-20", ptype: "advance",
    just: "Power backup — grid outages disrupting trial runs", status: "submitted", created: "2026-08-22T04:30:00Z", submitted: "2026-08-22T05:00:00Z",
  }),
  createMockReq({
    id: "req-13", no: "CAP-013", cat: "capex", bh: "Partitions & Interiors", vend: "Urban Interiors & Partitions",
    desc: "Canteen area furnishing & modular kitchen", amt: 340000, urg: "normal", nbd: "2026-10-01", ptype: "advance",
    just: "Worker canteen setup", status: "submitted", created: "2026-08-24T08:30:00Z", submitted: "2026-08-24T09:00:00Z",
  }),
  createMockReq({
    id: "req-14", no: "CAP-014", cat: "capex", bh: "Machinery", vend: "Shakti Machine Tools Pvt Ltd",
    desc: "Pick-and-place robot arm for packing line", amt: 2200000, urg: "normal", nbd: "2026-11-30", ptype: "advance",
    just: "Automation of packing line", status: "sent_back", created: "2026-08-11T10:30:00Z", submitted: "2026-08-11T11:00:00Z",
    decided: "2026-08-13T06:30:00Z", remarks: "Need 3 comparative quotes and ROI working before this size of spend",
  }),
  createMockReq({
    id: "req-15", no: "CAP-015", cat: "capex", bh: "Miscellaneous / Other", vend: "Featherlite Workspaces",
    desc: "Recreation room — TT table, seating", amt: 145000, urg: "normal", nbd: "2026-10-15", ptype: "against_invoice",
    just: "Employee welfare", status: "rejected", created: "2026-08-05T05:30:00Z", submitted: "2026-08-05T05:50:00Z",
    decided: "2026-08-06T04:15:00Z", rej: "Deferred to Q4 — not critical for plant commissioning",
  }),
  createMockReq({
    id: "req-16", no: "CAP-016", cat: "capex", bh: "Safety Equipment", vend: "Sunrise Electricals",
    desc: "PPE kits — helmets, shoes, gloves x50 sets", qty: 50, rate: 2400, amt: 120000, urg: "normal", nbd: "2026-09-05", ptype: "against_invoice",
    just: "PPE for production workers", status: "draft", created: "2026-08-25T11:30:00Z",
  }),

  // RAW MATERIAL
  createMockReq({
    id: "req-17", no: "RM-001", cat: "raw_material", bh: "Motors & Stators", vend: "Vashi Components & Controls",
    desc: "1HP submersible motor stators — batch 1", sku: "JF-SUB-1HP", qty: 200, rate: 2150, amt: 430000, urg: "critical", nbd: "2026-06-05", ptype: "advance",
    just: "First production batch of 200 pumps", status: "closed", created: "2026-05-20T04:00:00Z", submitted: "2026-05-20T04:30:00Z",
    decided: "2026-05-21T05:30:00Z", appr: 430000, remarks: "Approved", paid: 430000, first_paid: "2026-05-25T11:00:00Z", closed: "2026-06-10T09:30:00Z",
  }),
  createMockReq({
    id: "req-18", no: "RM-002", cat: "raw_material", bh: "Impellers & Castings", vend: "Hyderabad Metal Works",
    desc: "SS impeller castings — 400 pcs", sku: "JF-SUB-1HP", qty: 400, rate: 385, amt: 154000, urg: "urgent", nbd: "2026-06-08", ptype: "against_invoice",
    just: "Castings for batch 1 & 2", status: "closed", created: "2026-05-22T04:45:00Z", submitted: "2026-05-22T05:30:00Z",
    decided: "2026-05-23T04:00:00Z", appr: 154000, remarks: "Approved", paid: 154000, first_paid: "2026-06-12T11:00:00Z", closed: "2026-06-20T06:00:00Z",
  }),
  createMockReq({
    id: "req-19", no: "RM-003", cat: "raw_material", bh: "Controllers & Electronics", vend: "Vashi Components & Controls",
    desc: "Pump controllers with dry-run protection — 200 units", sku: "JF-SUB-1HP", qty: 200, rate: 1240, amt: 248000, urg: "urgent", nbd: "2026-06-15", ptype: "advance",
    just: "Controllers for batch 1", status: "closed", created: "2026-05-28T08:30:00Z", submitted: "2026-05-28T09:00:00Z",
    decided: "2026-05-29T04:30:00Z", appr: 248000, remarks: "Approved", paid: 248000, first_paid: "2026-06-03T11:00:00Z", closed: "2026-06-22T03:30:00Z",
  }),
  createMockReq({
    id: "req-20", no: "RM-004", cat: "raw_material", bh: "Motors & Stators", vend: "Vashi Components & Controls",
    desc: "1.5HP motor stators — batch 2", sku: "JF-SUB-1.5HP", qty: 300, rate: 2680, amt: 804000, urg: "critical", nbd: "2026-07-20", ptype: "advance",
    just: "Batch 2 production — 300 units of 1.5HP variant", status: "paid", created: "2026-07-01T03:30:00Z", submitted: "2026-07-01T04:10:00Z",
    decided: "2026-07-03T09:30:00Z", appr: 804000, remarks: "Approved; second approval by AN", paid: 804000, first_paid: "2026-07-08T11:00:00Z",
  }),
  createMockReq({
    id: "req-21", no: "RM-005", cat: "raw_material", bh: "Seals, Pipes & Fittings", vend: "FlowSeal Polymers",
    desc: "Mechanical seals & O-ring kits — 500 sets", qty: 500, rate: 165, amt: 82500, urg: "normal", nbd: "2026-07-25", ptype: "against_invoice",
    just: "Seals for batches 2 and 3", status: "paid", created: "2026-07-05T06:00:00Z", submitted: "2026-07-05T06:30:00Z",
    decided: "2026-07-06T04:30:00Z", appr: 82500, remarks: "Approved", paid: 82500, first_paid: "2026-07-28T11:00:00Z",
  }),
  createMockReq({
    id: "req-22", no: "RM-006", cat: "raw_material", bh: "Packaging Material", vend: "Kranti Packaging Industries",
    desc: "Corrugated boxes + foam inserts — 600 sets", qty: 600, rate: 95, amt: 57000, urg: "normal", nbd: "2026-08-01", ptype: "against_invoice",
    just: "Packaging for batches 1–3", status: "paid", created: "2026-07-12T09:30:00Z", submitted: "2026-07-12T10:00:00Z",
    decided: "2026-07-13T05:30:00Z", appr: 57000, remarks: "Approved", paid: 57000, first_paid: "2026-08-05T11:00:00Z",
  }),
  createMockReq({
    id: "req-23", no: "RM-007", cat: "raw_material", bh: "Impellers & Castings", vend: "Hyderabad Metal Works",
    desc: "Bronze impeller castings — 300 pcs", sku: "JF-SUB-1.5HP", qty: 300, rate: 512, amt: 153600, urg: "urgent", nbd: "2026-08-20", ptype: "advance",
    just: "Castings for 1.5HP batch", status: "approved", created: "2026-08-08T04:30:00Z", submitted: "2026-08-08T05:00:00Z",
    decided: "2026-08-10T04:00:00Z", appr: 153600, remarks: "Approved", paid: 76800, first_paid: "2026-08-14T11:00:00Z",
  }),
  createMockReq({
    id: "req-24", no: "RM-008", cat: "raw_material", bh: "Fasteners & Consumables", vend: "Hyderabad Metal Works",
    desc: "SS fasteners, welding consumables — monthly stock", amt: 68000, urg: "normal", nbd: "2026-08-25", ptype: "against_invoice",
    just: "Monthly consumables replenishment", status: "approved", created: "2026-08-16T04:00:00Z", submitted: "2026-08-16T04:30:00Z",
    decided: "2026-08-17T08:30:00Z", appr: 68000, remarks: "Approved", paid: 0,
  }),
  createMockReq({
    id: "req-25", no: "RM-009", cat: "raw_material", bh: "Controllers & Electronics", vend: "Vashi Components & Controls",
    desc: "Control panels 1.5HP — 300 units", sku: "JF-SUB-1.5HP", qty: 300, rate: 1385, amt: 415500, urg: "urgent", nbd: "2026-09-05", ptype: "advance",
    just: "Controllers for batch 2", status: "approved", created: "2026-08-18T05:30:00Z", submitted: "2026-08-18T06:00:00Z",
    decided: "2026-08-20T04:30:00Z", appr: 415500, remarks: "Approved", paid: 0,
  }),
  createMockReq({
    id: "req-26", no: "RM-010", cat: "raw_material", bh: "Motors & Stators", vend: "Vashi Components & Controls",
    desc: "2HP motor stators — pilot batch 50", sku: "JF-SUB-2HP", qty: 50, rate: 3150, amt: 157500, urg: "normal", nbd: "2026-09-25", ptype: "advance",
    just: "Pilot run of 2HP variant", status: "submitted", created: "2026-08-23T04:30:00Z", submitted: "2026-08-23T04:50:00Z",
  }),
  createMockReq({
    id: "req-27", no: "RM-011", cat: "raw_material", bh: "Seals, Pipes & Fittings", vend: "FlowSeal Polymers",
    desc: "HDPE pipe adapters — 1000 pcs", qty: 1000, rate: 42, amt: 42000, urg: "normal", nbd: "2026-09-15", ptype: "against_invoice",
    just: "Adapters for retail kit", status: "submitted", created: "2026-08-25T10:30:00Z", submitted: "2026-08-25T10:45:00Z",
  }),
  createMockReq({
    id: "req-28", no: "RM-012", cat: "raw_material", bh: "Impellers & Castings", vend: "Hyderabad Metal Works",
    desc: "SS impeller castings — 2HP, 100 pcs", sku: "JF-SUB-2HP", qty: 100, rate: 610, amt: 61000, urg: "normal", nbd: "2026-09-20", ptype: "advance",
    just: "Castings for 2HP pilot", status: "sent_back", created: "2026-08-20T06:30:00Z", submitted: "2026-08-20T07:00:00Z",
    decided: "2026-08-21T04:30:00Z", remarks: "Attach the revised quotation — rate differs from last PO",
  }),
  createMockReq({
    id: "req-29", no: "RM-013", cat: "raw_material", bh: "Packaging Material", vend: "Kranti Packaging Industries",
    desc: "Printed premium cartons — 1000 pcs", qty: 1000, rate: 118, amt: 118000, urg: "normal", nbd: "2026-09-30", ptype: "against_invoice",
    just: "New retail packaging design", status: "rejected", created: "2026-08-12T09:00:00Z", submitted: "2026-08-12T09:30:00Z",
    decided: "2026-08-13T06:00:00Z", rej: "Use existing carton stock first; revisit in October",
  }),
  createMockReq({
    id: "req-30", no: "RM-014", cat: "raw_material", bh: "Fasteners & Consumables", vend: "Hyderabad Metal Works",
    desc: "Thread-locker & assembly adhesives", amt: 23500, urg: "normal", nbd: "2026-09-10", ptype: "against_invoice",
    just: "Assembly line consumables", status: "draft", created: "2026-08-26T03:30:00Z",
  }),
];

export const INITIAL_PAYMENTS: MockPayment[] = [
  { id: "p-1", request_id: "req-1", amount_paid: 1500000, paid_on: "2026-04-10", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26041012345", recorded_by: u_fin1, created_at: "2026-04-10T11:00:00Z" },
  { id: "p-2", request_id: "req-1", amount_paid: 1150000, paid_on: "2026-05-18", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26051867890", recorded_by: u_fin1, created_at: "2026-05-18T11:00:00Z" },
  { id: "p-3", request_id: "req-2", amount_paid: 1875000, paid_on: "2026-04-20", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26042022334", recorded_by: u_fin1, created_at: "2026-04-20T11:00:00Z" },
  { id: "p-4", request_id: "req-2", amount_paid: 1875000, paid_on: "2026-06-05", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26060533445", recorded_by: u_fin1, created_at: "2026-06-05T11:00:00Z" },
  { id: "p-5", request_id: "req-3", amount_paid: 1420000, paid_on: "2026-06-25", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26062544556", recorded_by: u_fin1, created_at: "2026-06-25T11:00:00Z" },
  { id: "p-6", request_id: "req-4", amount_paid: 650000, paid_on: "2026-05-20", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26052055667", recorded_by: u_fin1, created_at: "2026-05-20T11:00:00Z" },
  { id: "p-7", request_id: "req-5", amount_paid: 485000, paid_on: "2026-06-18", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26061866778", recorded_by: u_fin1, created_at: "2026-06-18T11:00:00Z" },
  { id: "p-8", request_id: "req-6", amount_paid: 980000, paid_on: "2026-06-14", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26061477889", recorded_by: u_fin1, created_at: "2026-06-14T11:00:00Z" },
  { id: "p-9", request_id: "req-7", amount_paid: 420000, paid_on: "2026-07-12", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26071288990", recorded_by: u_fin1, created_at: "2026-07-12T11:00:00Z" },
  { id: "p-10", request_id: "req-8", amount_paid: 265000, paid_on: "2026-08-02", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26080299001", recorded_by: u_fin1, created_at: "2026-08-02T11:00:00Z" },
  { id: "p-11", request_id: "req-17", amount_paid: 430000, paid_on: "2026-05-25", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26052511223", recorded_by: u_fin1, created_at: "2026-05-25T11:00:00Z" },
  { id: "p-12", request_id: "req-18", amount_paid: 154000, paid_on: "2026-06-12", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26061222334", recorded_by: u_fin1, created_at: "2026-06-12T11:00:00Z" },
  { id: "p-13", request_id: "req-19", amount_paid: 248000, paid_on: "2026-06-03", mode: "upi", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "UPIH2606031829", recorded_by: u_fin1, created_at: "2026-06-03T11:00:00Z" },
  { id: "p-14", request_id: "req-20", amount_paid: 400000, paid_on: "2026-07-08", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26070833445", recorded_by: u_fin1, created_at: "2026-07-08T11:00:00Z" },
  { id: "p-15", request_id: "req-20", amount_paid: 404000, paid_on: "2026-08-01", mode: "rtgs", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "RTGSH26080144556", recorded_by: u_fin1, created_at: "2026-08-01T11:00:00Z" },
  { id: "p-16", request_id: "req-21", amount_paid: 82500, paid_on: "2026-07-28", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26072855667", recorded_by: u_fin1, created_at: "2026-07-28T11:00:00Z" },
  { id: "p-17", request_id: "req-22", amount_paid: 57000, paid_on: "2026-08-05", mode: "upi", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "UPIH2608051042", recorded_by: u_fin1, created_at: "2026-08-05T11:00:00Z" },
  { id: "p-18", request_id: "req-23", amount_paid: 76800, paid_on: "2026-08-14", mode: "neft", bank: "HDFC Bank — Claro Energy Ltd", utr_ref: "NEFTH26081466778", recorded_by: u_fin1, created_at: "2026-08-14T11:00:00Z" },
];

export const INITIAL_ATTACHMENTS: MockAttachment[] = [
  { id: "att-1", request_id: "req-1", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-05-28T06:30:00Z" },
  { id: "att-2", request_id: "req-2", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-06-15T03:30:00Z" },
  { id: "att-3", request_id: "req-3", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-07-02T09:00:00Z" },
  { id: "att-4", request_id: "req-4", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-06-18T02:30:00Z" },
  { id: "att-5", request_id: "req-5", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-06-25T04:30:00Z" },
  { id: "att-17", request_id: "req-17", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-06-10T07:30:00Z" },
  { id: "att-18", request_id: "req-18", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-06-20T04:00:00Z" },
  { id: "att-19", request_id: "req-19", kind: "invoice", storage_path: "seed/final-invoice.pdf", file_name: "final-invoice.pdf", uploaded_by: u_ground, created_at: "2026-06-22T01:30:00Z" },
];

export const INITIAL_AUDIT: MockAuditLog[] = [
  { id: "aud-1", request_id: "req-1", actor_id: u_ground, action: "submitted", old_status: "draft", new_status: "submitted", created_at: "2026-04-06T05:30:00Z" },
  { id: "aud-2", request_id: "req-1", actor_id: u_fin1, action: "approved", old_status: "submitted", new_status: "approved", remarks: "Approved per plant setup plan", created_at: "2026-04-07T10:00:00Z" },
  { id: "aud-3", request_id: "req-1", actor_id: u_fin1, action: "payment_recorded", remarks: "Recorded ₹15,00,000 via RTGS (RTGSH26041012345)", created_at: "2026-04-10T11:00:00Z" },
  { id: "aud-4", request_id: "req-1", actor_id: u_fin1, action: "payment_recorded", remarks: "Recorded ₹11,50,000 via RTGS (RTGSH26051867890)", created_at: "2026-05-18T11:00:00Z" },
  { id: "aud-5", request_id: "req-1", actor_id: u_ground, action: "closed", old_status: "paid", new_status: "closed", remarks: "Invoice uploaded and goods receipt confirmed", created_at: "2026-05-28T08:30:00Z" },
];

// Global in-memory store
declare global {
  var __jetflo_mock_db: {
    users: typeof MOCK_USERS;
    budget_heads: typeof MOCK_BUDGET_HEADS;
    vendors: typeof MOCK_VENDORS;
    requests: MockFundRequest[];
    payments: MockPayment[];
    attachments: MockAttachment[];
    audit: MockAuditLog[];
    settings: typeof MOCK_SETTINGS;
    activeUserId: string;
  } | undefined;
}

if (!globalThis.__jetflo_mock_db) {
  globalThis.__jetflo_mock_db = {
    users: [...MOCK_USERS],
    budget_heads: [...MOCK_BUDGET_HEADS],
    vendors: [...MOCK_VENDORS],
    requests: [...INITIAL_REQUESTS],
    payments: [...INITIAL_PAYMENTS],
    attachments: [...INITIAL_ATTACHMENTS],
    audit: [...INITIAL_AUDIT],
    settings: [...MOCK_SETTINGS],
    activeUserId: "44444444-4444-4444-4444-444444444444", // default to leadership
  };
}

export const db = globalThis.__jetflo_mock_db!;

// Mock Supabase Query Engine
export function createMockSupabaseClient(activeUser?: Profile | null) {
  const currentUser = activeUser || db.users.find((u) => u.id === db.activeUserId) || db.users[3];

  return {
    auth: {
      async getUser() {
        return { data: { user: { id: currentUser.id, email: currentUser.email } }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password?: string }) {
        const found = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!found) return { data: { user: null }, error: { message: "Invalid login credentials" } };
        db.activeUserId = found.id;
        return { data: { user: { id: found.id, email: found.email } }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    storage: {
      from(_bucket: string) {
        return {
          async upload(path: string, _file: any) {
            return { data: { path }, error: null };
          },
          async createSignedUrl(path: string, _expiresIn: number) {
            return { data: { signedUrl: `/seed/${path.split("/").pop() || "sample.pdf"}` }, error: null };
          },
        };
      },
    },
    from(table: string) {
      let filterFn = (_row: any) => true;
      let sortFn: ((a: any, b: any) => number) | null = null;
      let limitCount: number | null = null;
      let isSingle = false;

      const builder: any = {
        select(_projection?: string) {
          return builder;
        },
        eq(col: string, val: any) {
          const prev = filterFn;
          filterFn = (r: any) => prev(r) && r[col] === val;
          return builder;
        },
        gte(col: string, val: any) {
          const prev = filterFn;
          filterFn = (r: any) => prev(r) && (r[col] != null && r[col] >= val);
          return builder;
        },
        lte(col: string, val: any) {
          const prev = filterFn;
          filterFn = (r: any) => prev(r) && (r[col] != null && r[col] <= val);
          return builder;
        },
        in(col: string, arr: any[]) {
          const prev = filterFn;
          filterFn = (r: any) => prev(r) && arr.includes(r[col]);
          return builder;
        },
        not(col: string, op: string, val: any) {
          const prev = filterFn;
          if (op === "in") {
            const list = String(val).replace(/^\(|\)$/g, "").split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
            filterFn = (r: any) => prev(r) && !list.includes(r[col]);
          }
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          const asc = opts?.ascending ?? true;
          sortFn = (a: any, b: any) => {
            const valA = a[col] ?? "";
            const valB = b[col] ?? "";
            return asc ? (valA > valB ? 1 : valA < valB ? -1 : 0) : (valA < valB ? 1 : valA > valB ? -1 : 0);
          };
          return builder;
        },
        limit(n: number) {
          limitCount = n;
          return builder;
        },
        single() {
          isSingle = true;
          return builder.then((res: any) => ({
            data: res.data ? (Array.isArray(res.data) ? res.data[0] || null : res.data) : null,
            error: null,
          }));
        },
        async insert(payload: any) {
          const items = Array.isArray(payload) ? payload : [payload];
          const results: any[] = [];
          for (const item of items) {
            const newId = item.id || `gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const row = {
              ...item,
              id: newId,
              created_at: item.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            if (table === "jetflo_fund_requests") {
              if (!row.request_no) {
                const prefix = row.category === "capex" ? "CAP" : "RM";
                row.request_no = `${prefix}-${String(++reqSeq).padStart(3, "0")}`;
              }
              db.requests.unshift(row as MockFundRequest);
              db.audit.push({
                id: `aud-${Date.now()}`,
                request_id: row.id,
                actor_id: currentUser.id,
                action: row.status === "submitted" ? "submitted" : "created",
                old_status: "draft",
                new_status: row.status,
                created_at: new Date().toISOString(),
              });
            } else if (table === "jetflo_payments") {
              db.payments.push(row as MockPayment);
              const targetReq = db.requests.find((r) => r.id === row.request_id);
              if (targetReq) {
                targetReq.amount_paid = (targetReq.amount_paid || 0) + Number(row.amount_paid);
                if (!targetReq.first_paid_at) targetReq.first_paid_at = row.paid_on;
                if (targetReq.amount_paid >= (targetReq.amount_approved || targetReq.amount_requested)) {
                  targetReq.status = "paid";
                }
              }
              db.audit.push({
                id: `aud-${Date.now()}`,
                request_id: row.request_id,
                actor_id: currentUser.id,
                action: "payment_recorded",
                remarks: `Recorded ₹${Number(row.amount_paid).toLocaleString("en-IN")} via ${String(row.mode).toUpperCase()} (${row.utr_ref})`,
                created_at: new Date().toISOString(),
              });
            } else if (table === "jetflo_attachments") {
              db.attachments.push(row as MockAttachment);
            } else if (table === "jetflo_vendors") {
              db.vendors.push(row);
            } else if (table === "jetflo_budget_heads") {
              db.budget_heads.push(row);
            }
            results.push(row);
          }
          return { data: isSingle || !Array.isArray(payload) ? results[0] : results, error: null };
        },
        async update(updatePayload: any) {
          let updatedRows: any[] = [];
          if (table === "jetflo_fund_requests") {
            db.requests = db.requests.map((r) => {
              if (filterFn(r)) {
                const next = { ...r, ...updatePayload, updated_at: new Date().toISOString() };
                updatedRows.push(next);
                return next;
              }
              return r;
            });
          } else if (table === "jetflo_vendors") {
            db.vendors = db.vendors.map((v) => (filterFn(v) ? { ...v, ...updatePayload } : v));
          } else if (table === "jetflo_budget_heads") {
            db.budget_heads = db.budget_heads.map((b) => (filterFn(b) ? { ...b, ...updatePayload } : b));
          }
          return { data: updatedRows, error: null };
        },
        then(resolve: (res: { data: any; error: null }) => any) {
          let rawData: any[] = [];
          if (table === "jetflo_users") rawData = db.users;
          else if (table === "jetflo_budget_heads") rawData = db.budget_heads;
          else if (table === "jetflo_vendors") rawData = db.vendors;
          else if (table === "jetflo_payments") {
            rawData = db.payments.map((p) => {
              const req = db.requests.find((r) => r.id === p.request_id);
              const vend = req ? db.vendors.find((v) => v.id === req.vendor_id) : null;
              const bh = req ? db.budget_heads.find((b) => b.id === req.budget_head_id) : null;
              return {
                ...p,
                request: req ? { request_no: req.request_no, category: req.category, product_sku: req.product_sku, vendor: vend ? { name: vend.name } : null, budget_head: bh ? { sub_head: bh.sub_head } : null } : null,
              };
            });
          } else if (table === "jetflo_attachments") rawData = db.attachments;
          else if (table === "jetflo_audit_log") rawData = db.audit;
          else if (table === "jetflo_settings") rawData = db.settings;
          else if (table === "jetflo_fund_requests") {
            rawData = db.requests.map((r) => {
              const bh = db.budget_heads.find((b) => b.id === r.budget_head_id);
              const vend = db.vendors.find((v) => v.id === r.vendor_id);
              const reqUser = db.users.find((u) => u.id === r.requester_id);
              const appUser = db.users.find((u) => u.id === r.approved_by);
              const secUser = db.users.find((u) => u.id === r.second_approved_by);
              return {
                ...r,
                budget_head: bh ? { id: bh.id, category: bh.category, sub_head: bh.sub_head, sanctioned_amount: bh.sanctioned_amount } : null,
                vendor: vend ? { id: vend.id, name: vend.name } : null,
                requester: reqUser ? { id: reqUser.id, name: reqUser.name } : null,
                approver: appUser ? { id: appUser.id, name: appUser.name } : null,
                second_approver: secUser ? { id: secUser.id, name: secUser.name } : null,
              };
            });
          }

          let results = rawData.filter(filterFn);
          if (sortFn) results.sort(sortFn);
          if (limitCount !== null) results = results.slice(0, limitCount);

          return Promise.resolve(resolve({ data: isSingle ? (results[0] || null) : results, error: null }));
        },
      };

      return builder;
    },
  };
}
