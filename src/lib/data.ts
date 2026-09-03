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
  submitted_at, decided_at, first_paid_at, closed_at, created_at,
  budget_head:jetflo_budget_heads ( id, category, sub_head, sanctioned_amount ),
  vendor:jetflo_vendors ( id, name, is_foreign, country ),
  requester:jetflo_users!jetflo_fund_requests_requester_id_fkey ( id, name ),
  approver:jetflo_users!jetflo_fund_requests_approved_by_fkey ( id, name ),
  second_approver:jetflo_users!jetflo_fund_requests_second_approved_by_fkey ( id, name )
`;

export const REQUEST_COLS_LEGACY = `
  id, request_no, category, item_description, product_sku, qty, unit_rate,
  amount_requested, amount_approved, amount_paid, urgency, need_by_date,
  payment_type, justification, status, duplicate_warning, goods_received, approval_remarks, rejection_reason,
  submitted_at, decided_at, first_paid_at, closed_at, created_at,
  budget_head:jetflo_budget_heads ( id, category, sub_head, sanctioned_amount ),
  vendor:jetflo_vendors ( id, name ),
  requester:jetflo_users!jetflo_fund_requests_requester_id_fkey ( id, name ),
  approver:jetflo_users!jetflo_fund_requests_approved_by_fkey ( id, name ),
  second_approver:jetflo_users!jetflo_fund_requests_second_approved_by_fkey ( id, name )
`;

export const REQUEST_COLS_WITH_TAX = REQUEST_COLS;
