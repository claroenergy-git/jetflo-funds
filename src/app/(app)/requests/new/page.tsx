import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, getOpenPurchaseOrdersForPicker } from "@/lib/data";
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
    getOpenPurchaseOrdersForPicker(supabase),
  ]);
  const vendors = vendorsRes.data ?? [];

  let prefill: any = null;
  if (po_id) {
    const { data: po } = await supabase
      .from("jetflo_purchase_orders")
      .select(`
        id, po_number, vendor_id, budget_head_id, category, currency, total_value,
        budget_head:jetflo_budget_heads ( sub_head ),
        vendor:jetflo_vendors ( id, name ),
        items:jetflo_purchase_order_items ( item_description, product_sku, qty, unit_rate, tax_percent )
      `)
      .eq("id", po_id)
      .single();

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
