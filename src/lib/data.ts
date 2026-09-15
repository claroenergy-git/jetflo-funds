import { getSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";

export async function requireProfile(): Promise<Profile> {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("jetflo_users")
    .select("id, name, email, role, plant")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  return profile as Profile;
}

export const REQUEST_COLS = `
  id, request_no, category, item_description, product_sku, qty, unit_rate,
  tax_percent, tax_amount, round_off, parent_request_id, prior_invoice_no,
  currency, currency_amended, currency_amended_at, currency_amended_by, previous_currency, previous_amount, currency_amendment_reason,
  amount_requested, amount_approved, amount_paid, urgency, need_by_date,
  payment_type, justification, status, duplicate_warning, goods_received, approval_remarks, rejection_reason,
  submitted_at, decided_at, first_paid_at, closed_at, created_at, po_id,
  budget_head:jetflo_budget_heads ( id, category, sub_head, sanctioned_amount ),
  vendor:jetflo_vendors ( id, name ),
  requester:jetflo_users!jetflo_fund_requests_requester_id_fkey ( id, name ),
  approver:jetflo_users!jetflo_fund_requests_approved_by_fkey ( id, name ),
  second_approver:jetflo_users!jetflo_fund_requests_second_approved_by_fkey ( id, name ),
  po:jetflo_purchase_orders!jetflo_fund_requests_po_id_fkey ( id, po_number, status, total_value, currency )
`;

export const REQUEST_COLS_LEGACY = `
  id, request_no, category, item_description, product_sku, qty, unit_rate,
  tax_percent, tax_amount, round_off, parent_request_id, prior_invoice_no,
  amount_requested, amount_approved, amount_paid, urgency, need_by_date,
  payment_type, justification, status, duplicate_warning, goods_received, approval_remarks, rejection_reason,
  submitted_at, decided_at, first_paid_at, closed_at, created_at,
  budget_head:jetflo_budget_heads ( id, category, sub_head, sanctioned_amount ),
  vendor:jetflo_vendors ( id, name ),
  requester:jetflo_users!jetflo_fund_requests_requester_id_fkey ( id, name ),
  approver:jetflo_users!jetflo_fund_requests_approved_by_fkey ( id, name ),
  second_approver:jetflo_users!jetflo_fund_requests_second_approved_by_fkey ( id, name )
`;

export const REQUEST_COLS_WITH_CURRENCY = REQUEST_COLS;
export const REQUEST_COLS_WITH_TAX = REQUEST_COLS;

export type PoPickerOption = {
  id: string;
  po_number: string;
  vendor_id: string;
  currency: string;
  total_value: number;
  remaining: number;
};

/** Open/partially-billed POs a requester can link a new fund request to, with a live remaining balance. */
export async function getOpenPurchaseOrdersForPicker(
  supabase: Awaited<ReturnType<typeof getSupabase>>
): Promise<PoPickerOption[]> {
  const { data: pos } = await supabase
    .from("jetflo_purchase_orders")
    .select("id, po_number, vendor_id, currency, total_value")
    .in("status", ["open", "partially_billed"]);
  if (!pos?.length) return [];

  const { data: linked } = await supabase
    .from("jetflo_fund_requests")
    .select("po_id, amount_approved")
    .in(
      "po_id",
      pos.map((p) => p.id)
    )
    .in("status", ["awaiting_second_approval", "approved", "partially_approved", "paid", "closed"]);

  const committed = new Map<string, number>();
  for (const r of linked ?? []) {
    committed.set(r.po_id, (committed.get(r.po_id) ?? 0) + Number(r.amount_approved || 0));
  }

  return pos.map((p) => ({
    id: p.id,
    po_number: p.po_number ?? "",
    vendor_id: p.vendor_id,
    currency: p.currency,
    total_value: Number(p.total_value),
    remaining: Number(p.total_value) - (committed.get(p.id) ?? 0),
  }));
}

export const PO_COLS = `
  id, po_number, category, currency, total_value, status, notes,
  source_request_id, issued_at, approved_at, created_at,
  vendor:jetflo_vendors ( id, name, trade_name, gstin, pan, address_line, city, state, pincode, contact_person, email, phone, bank_name, account_no, ifsc ),
  budget_head:jetflo_budget_heads ( id, category, sub_head ),
  created_by_user:jetflo_users!jetflo_purchase_orders_created_by_fkey ( id, name ),
  approved_by_user:jetflo_users!jetflo_purchase_orders_approved_by_fkey ( id, name ),
  items:jetflo_purchase_order_items ( id, item_description, product_sku, qty, unit_rate, tax_percent, tax_amount, round_off, line_total, sort_order )
`;

export const PO_COLS_LEGACY = PO_COLS;
