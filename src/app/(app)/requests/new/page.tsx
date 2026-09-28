import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, getOpenPurchaseOrdersForPicker } from "@/lib/data";
import { withUserContext } from "@/lib/db";
import { PageTitle, Card, Alert } from "@/components/ui";
import { RequestForm } from "@/components/request-form";

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ po_id?: string; payment_type?: string }>;
}) {
  const { po_id, payment_type } = await searchParams;
  const profile = await requireProfile();
  const supabase = await getSupabase();

  if (profile.role !== "requester") {
    return <Alert kind="error">Only the ground team can raise fund requests.</Alert>;
  }

  let vendorsRes: any = await supabase.from("jetflo_vendors").select("id, name, is_foreign, country").eq("active", true).order("name");
  if (vendorsRes.error) {
    vendorsRes = await supabase.from("jetflo_vendors").select("id, name").eq("active", true).order("name");
  }

  const [{ data: heads }, { data: priorRequests }, purchaseOrders] = await Promise.all([
    supabase.from("jetflo_budget_heads").select("id, category, sub_head").eq("active", true).order("sub_head"),
    supabase.from("jetflo_fund_requests").select("id, request_no, vendor_id, amount_approved, amount_requested, item_description, status").not("status", "in", "(draft,rejected)").order("created_at", { ascending: false }),
    getOpenPurchaseOrdersForPicker(profile),
  ]);
  const vendors = vendorsRes.data ?? [];

  let prefill: any = null;
  if (po_id) {
    const po = await withUserContext(profile.id, async (client) => {
      const res = await client.query(
        `SELECT po.id, po.po_number, po.vendor_id, po.budget_head_id, po.category, po.currency, po.total_value,
           json_build_object('sub_head', bh.sub_head) AS budget_head,
           json_build_object('id', v.id, 'name', v.name) AS vendor,
           COALESCE(
             (SELECT json_agg(json_build_object(
               'item_description', i.item_description, 'product_sku', i.product_sku,
               'qty', i.qty, 'unit_rate', i.unit_rate, 'tax_percent', i.tax_percent
             ) ORDER BY i.sort_order)
             FROM jetflo_purchase_order_items i WHERE i.purchase_order_id = po.id),
             '[]'
           ) AS items
         FROM jetflo_purchase_orders po
         LEFT JOIN jetflo_budget_heads bh ON bh.id = po.budget_head_id
         LEFT JOIN jetflo_vendors v ON v.id = po.vendor_id
         WHERE po.id = $1`,
        [po_id]
      );
      return res.rows[0] ?? null;
    });

    if (po) {
      const firstItem = (po as any).items?.[0];
      prefill = {
        po_id: po.id,
        vendor: (po as any).vendor,
        vendor_id: po.vendor_id,
        budget_head: (po as any).budget_head,
        category: po.category,
        currency: po.currency,
        payment_type: payment_type ?? "against_invoice",
        item_description: firstItem?.item_description,
        product_sku: firstItem?.product_sku,
        qty: firstItem?.qty,
        unit_rate: firstItem?.unit_rate,
        tax_percent: firstItem?.tax_percent,
      };
    }
  }

  return (
    <div className="max-w-2xl">
      <PageTitle title="New fund request" sub="Coimbatore Plant Procurement & Capex — Submitted requests go to Claro Accounts for dual-control approval" />
      <Card className="p-6">
        <RequestForm
          vendors={vendors ?? []}
          budgetHeads={heads ?? []}
          priorRequests={priorRequests ?? []}
          purchaseOrders={purchaseOrders}
          existing={prefill}
        />
      </Card>
    </div>
  );
}
