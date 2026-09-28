import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withUserContext, type PoolClient } from "@/lib/db";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth/session";
import type { Profile } from "@/lib/types";

export async function requireProfile(): Promise<Profile> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) redirect("/login");

  const profile = await withUserContext(session.userId, async (client) => {
    const res = await client.query<Profile>(
      `SELECT id, name, email, role, plant FROM jetflo_users WHERE id = $1`,
      [session.userId]
    );
    return res.rows[0] ?? null;
  });
  if (!profile) redirect("/login");
  return profile;
}

/** Same nested shape the old PostgREST embedded-select (REQUEST_COLS) produced. */
const REQUEST_SELECT = `
  fr.id, fr.request_no, fr.category, fr.item_description, fr.product_sku, fr.qty, fr.unit_rate,
  fr.tax_percent, fr.tax_amount, fr.round_off, fr.parent_request_id, fr.prior_invoice_no,
  fr.currency, fr.currency_amended, fr.currency_amended_at, fr.currency_amended_by,
  fr.previous_currency, fr.previous_amount, fr.currency_amendment_reason,
  fr.amount_requested, fr.amount_approved, fr.amount_paid, fr.urgency, fr.need_by_date,
  fr.payment_type, fr.justification, fr.status, fr.duplicate_warning, fr.goods_received,
  fr.approval_remarks, fr.rejection_reason,
  fr.submitted_at, fr.decided_at, fr.first_paid_at, fr.closed_at, fr.created_at, fr.po_id,
  CASE WHEN bh.id IS NOT NULL THEN json_build_object(
    'id', bh.id, 'category', bh.category, 'sub_head', bh.sub_head, 'sanctioned_amount', bh.sanctioned_amount
  ) END AS budget_head,
  CASE WHEN v.id IS NOT NULL THEN json_build_object('id', v.id, 'name', v.name) END AS vendor,
  CASE WHEN requester.id IS NOT NULL THEN json_build_object('id', requester.id, 'name', requester.name) END AS requester,
  CASE WHEN approver.id IS NOT NULL THEN json_build_object('id', approver.id, 'name', approver.name) END AS approver,
  CASE WHEN second_approver.id IS NOT NULL THEN json_build_object('id', second_approver.id, 'name', second_approver.name) END AS second_approver,
  CASE WHEN po.id IS NOT NULL THEN json_build_object(
    'id', po.id, 'po_number', po.po_number, 'status', po.status, 'total_value', po.total_value, 'currency', po.currency
  ) END AS po
  FROM jetflo_fund_requests fr
  LEFT JOIN jetflo_budget_heads bh ON bh.id = fr.budget_head_id
  LEFT JOIN jetflo_vendors v ON v.id = fr.vendor_id
  LEFT JOIN jetflo_users requester ON requester.id = fr.requester_id
  LEFT JOIN jetflo_users approver ON approver.id = fr.approved_by
  LEFT JOIN jetflo_users second_approver ON second_approver.id = fr.second_approved_by
  LEFT JOIN jetflo_purchase_orders po ON po.id = fr.po_id
`;

export type FundRequestFilter = {
  id?: string;
  requesterId?: string;
  statusIn?: string[];
  statusNotIn?: string[];
  orderBy?: string; // e.g. "fr.created_at DESC"
};

export async function getFundRequests(
  profile: Profile,
  filter: FundRequestFilter = {}
): Promise<Record<string, unknown>[]> {
  return withUserContext(profile.id, async (client) => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.id) {
      params.push(filter.id);
      clauses.push(`fr.id = $${params.length}`);
    }
    if (filter.requesterId) {
      params.push(filter.requesterId);
      clauses.push(`fr.requester_id = $${params.length}`);
    }
    if (filter.statusIn?.length) {
      params.push(filter.statusIn);
      clauses.push(`fr.status = ANY($${params.length})`);
    }
    if (filter.statusNotIn?.length) {
      params.push(filter.statusNotIn);
      clauses.push(`NOT (fr.status = ANY($${params.length}))`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const order = filter.orderBy ? `ORDER BY ${filter.orderBy}` : "ORDER BY fr.created_at DESC";
    const sql = `SELECT ${REQUEST_SELECT} ${where} ${order}`;
    const res = await client.query(sql, params);
    return res.rows;
  });
}

export async function getFundRequestById(
  profile: Profile,
  id: string
): Promise<Record<string, unknown> | null> {
  const rows = await getFundRequests(profile, { id });
  return rows[0] ?? null;
}

const PO_SELECT = `
  po.id, po.po_number, po.category, po.currency, po.total_value, po.status, po.notes,
  po.source_request_id, po.issued_at, po.approved_at, po.created_at,
  CASE WHEN v.id IS NOT NULL THEN json_build_object(
    'id', v.id, 'name', v.name, 'trade_name', v.trade_name, 'gstin', v.gstin, 'pan', v.pan,
    'address_line', v.address_line, 'city', v.city, 'state', v.state, 'pincode', v.pincode,
    'contact_person', v.contact_person, 'email', v.email, 'phone', v.phone,
    'bank_name', v.bank_name, 'account_no', v.account_no, 'ifsc', v.ifsc
  ) END AS vendor,
  CASE WHEN bh.id IS NOT NULL THEN json_build_object('id', bh.id, 'category', bh.category, 'sub_head', bh.sub_head) END AS budget_head,
  CASE WHEN created_by_user.id IS NOT NULL THEN json_build_object('id', created_by_user.id, 'name', created_by_user.name) END AS created_by_user,
  CASE WHEN approved_by_user.id IS NOT NULL THEN json_build_object('id', approved_by_user.id, 'name', approved_by_user.name) END AS approved_by_user,
  COALESCE(
    (SELECT json_agg(json_build_object(
      'id', i.id, 'item_description', i.item_description, 'product_sku', i.product_sku,
      'qty', i.qty, 'unit_rate', i.unit_rate, 'tax_percent', i.tax_percent, 'tax_amount', i.tax_amount,
      'round_off', i.round_off, 'line_total', i.line_total, 'sort_order', i.sort_order
    ) ORDER BY i.sort_order)
    FROM jetflo_purchase_order_items i WHERE i.purchase_order_id = po.id),
    '[]'
  ) AS items
  FROM jetflo_purchase_orders po
  LEFT JOIN jetflo_vendors v ON v.id = po.vendor_id
  LEFT JOIN jetflo_budget_heads bh ON bh.id = po.budget_head_id
  LEFT JOIN jetflo_users created_by_user ON created_by_user.id = po.created_by
  LEFT JOIN jetflo_users approved_by_user ON approved_by_user.id = po.approved_by
`;

export type PoFilter = {
  id?: string;
  statusIn?: string[];
  orderBy?: string;
};

export async function getPurchaseOrders(
  profile: Profile,
  filter: PoFilter = {}
): Promise<Record<string, unknown>[]> {
  return withUserContext(profile.id, async (client) => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.id) {
      params.push(filter.id);
      clauses.push(`po.id = $${params.length}`);
    }
    if (filter.statusIn?.length) {
      params.push(filter.statusIn);
      clauses.push(`po.status = ANY($${params.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const order = filter.orderBy ? `ORDER BY ${filter.orderBy}` : "ORDER BY po.created_at DESC";
    const sql = `SELECT ${PO_SELECT} ${where} ${order}`;
    const res = await client.query(sql, params);
    return res.rows;
  });
}

export async function getPurchaseOrderById(
  profile: Profile,
  id: string
): Promise<Record<string, unknown> | null> {
  const rows = await getPurchaseOrders(profile, { id });
  return rows[0] ?? null;
}

export type PoPickerOption = {
  id: string;
  po_number: string;
  vendor_id: string;
  currency: string;
  total_value: number;
  remaining: number;
};

/** Open/partially-billed POs a requester can link a new fund request to, with a live remaining balance. */
export async function getOpenPurchaseOrdersForPicker(profile: Profile): Promise<PoPickerOption[]> {
  return withUserContext(profile.id, async (client) => {
    const posRes = await client.query<{
      id: string;
      po_number: string | null;
      vendor_id: string;
      currency: string;
      total_value: string;
    }>(
      `SELECT id, po_number, vendor_id, currency, total_value FROM jetflo_purchase_orders WHERE status = ANY($1)`,
      [["open", "partially_billed"]]
    );
    const pos = posRes.rows;
    if (!pos.length) return [];

    const linkedRes = await client.query<{ po_id: string; amount_approved: string | null }>(
      `SELECT po_id, amount_approved FROM jetflo_fund_requests
       WHERE po_id = ANY($1) AND status = ANY($2)`,
      [pos.map((p) => p.id), ["awaiting_second_approval", "approved", "partially_approved", "paid", "closed"]]
    );

    const committed = new Map<string, number>();
    for (const r of linkedRes.rows) {
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
  });
}

export type { PoolClient };
