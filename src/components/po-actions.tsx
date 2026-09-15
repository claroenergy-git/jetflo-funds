"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPurchaseOrderDraft,
  updatePoDraftHeader,
  issuePurchaseOrder,
  approvePoSecondApproval,
  cancelPurchaseOrder,
  amendPurchaseOrder,
  recordPurchaseReceive,
  type ActionResult,
} from "@/app/actions";
import { Alert, btnPrimary, btnSecondary, labelCls, inputCls } from "@/components/ui";
import { DESTINATION_PLANTS, PAYMENT_TERMS_LABEL, type PaymentTerms } from "@/lib/types";

export function PoDraftHeaderForm({
  id,
  vendors,
  vendorId,
  budgetHeadId,
  currency,
  notes,
  orderDate,
  expectedDeliveryDate,
  destinationPlant,
  referenceNo,
  paymentTerms,
  transporterName,
  lrNo,
}: {
  id: string;
  vendors: { id: string; name: string }[];
  vendorId: string;
  budgetHeadId: string;
  currency: string;
  notes: string | null;
  orderDate?: string | null;
  expectedDeliveryDate?: string | null;
  destinationPlant?: string | null;
  referenceNo?: string | null;
  paymentTerms?: string | null;
  transporterName?: string | null;
  lrNo?: string | null;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updatePoDraftHeader, null);
  const isPreset = paymentTerms && paymentTerms in PAYMENT_TERMS_LABEL;
  const [termChoice, setTermChoice] = useState<string>(
    paymentTerms ? (isPreset ? paymentTerms : "custom") : "due_on_receipt"
  );
  const [customTerm, setCustomTerm] = useState<string>(
    paymentTerms && !isPreset ? paymentTerms : ""
  );

  const isPresetPlant = destinationPlant ? DESTINATION_PLANTS.includes(destinationPlant) : true;
  const [plantChoice, setPlantChoice] = useState<string>(
    destinationPlant ? (isPresetPlant ? destinationPlant : "custom") : DESTINATION_PLANTS[0]
  );
  const [customPlant, setCustomPlant] = useState<string>(
    destinationPlant && !isPresetPlant ? destinationPlant : ""
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="budget_head_id" value={budgetHeadId} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Vendor</label>
          <select name="vendor_id" defaultValue={vendorId} className={inputCls} required>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Currency</label>
          <select name="currency" defaultValue={currency} className={inputCls}>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Order Date</label>
          <input
            type="date"
            name="order_date"
            defaultValue={orderDate ?? new Date().toISOString().slice(0, 10)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>
            Expected Delivery Date <span className="text-red-600 font-bold">*</span>
          </label>
          <input
            type="date"
            name="expected_delivery_date"
            defaultValue={expectedDeliveryDate ?? ""}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Destination Plant / Site</label>
          <input
            type="hidden"
            name="destination_plant"
            value={plantChoice === "custom" ? customPlant : plantChoice}
          />
          <select
            value={plantChoice}
            onChange={(e) => setPlantChoice(e.target.value)}
            className={inputCls}
          >
            {DESTINATION_PLANTS.map((dp) => (
              <option key={dp} value={dp}>
                {dp}
              </option>
            ))}
            <option value="custom">✏️ Other / Custom Plant or Site…</option>
          </select>
          {plantChoice === "custom" && (
            <input
              value={customPlant}
              onChange={(e) => setCustomPlant(e.target.value)}
              placeholder="e.g. Pune Assembly Unit, Site - Kolar"
              className={`${inputCls} mt-1.5`}
              required
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Payment Terms</label>
          <input
            type="hidden"
            name="payment_terms"
            value={termChoice === "custom" ? customTerm : termChoice}
          />
          <select
            value={termChoice}
            onChange={(e) => setTermChoice(e.target.value)}
            className={inputCls}
          >
            {Object.entries(PAYMENT_TERMS_LABEL).map(([val, lbl]) => (
              <option key={val} value={val}>
                {lbl}
              </option>
            ))}
            <option value="custom">✏️ Custom Payment Terms…</option>
          </select>
          {termChoice === "custom" && (
            <input
              value={customTerm}
              onChange={(e) => setCustomTerm(e.target.value)}
              placeholder="e.g. 20% Adv + 60% Dispatch + 20% Commissioning"
              className={`${inputCls} mt-1.5`}
              required
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Vendor Quote / Proforma Ref #</label>
          <input
            name="reference_no"
            defaultValue={referenceNo ?? ""}
            placeholder="e.g. QT-2026-981"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Transporter / Courier (optional)</label>
          <input
            name="transporter_name"
            defaultValue={transporterName ?? ""}
            placeholder="e.g. VRL Logistics, Blue Dart"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Docket / LR / Tracking #</label>
          <input
            name="lr_no"
            defaultValue={lrNo ?? ""}
            placeholder="e.g. LR-449102"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Notes / terms</label>
        <textarea name="notes" defaultValue={notes ?? ""} rows={2} className={inputCls} />
      </div>
      <button className={btnSecondary} disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

export function IssuePoFromRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createPurchaseOrderDraft, null);

  useEffect(() => {
    if (state?.ok && state.id) router.push(`/finance/purchase-orders/${state.id}`);
  }, [state, router]);

  return (
    <form action={action}>
      <input type="hidden" name="source_request_id" value={requestId} />
      {state?.error && <p className="mb-2 text-xs font-semibold text-red-600">{state.error}</p>}
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Creating draft…" : "Draft a Purchase Order"}
      </button>
    </form>
  );
}

export function NewBlankPoForm({
  vendors,
  budgetHeads,
}: {
  vendors: { id: string; name: string; category: string }[];
  budgetHeads: { id: string; category: string; sub_head: string }[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState<"capex" | "raw_material">("capex");
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createPurchaseOrderDraft, null);

  useEffect(() => {
    if (state?.ok && state.id) router.push(`/finance/purchase-orders/${state.id}`);
  }, [state, router]);

  const [newTermChoice, setNewTermChoice] = useState<string>("due_on_receipt");
  const [newCustomTerm, setNewCustomTerm] = useState<string>("");
  const [newPlantChoice, setNewPlantChoice] = useState<string>(DESTINATION_PLANTS[0]);
  const [newCustomPlant, setNewCustomPlant] = useState<string>("");

  const filteredVendors = vendors.filter((v) => v.category === category || v.category === "both");
  const filteredHeads = budgetHeads.filter((h) => h.category === category);

  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Category</label>
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as "capex" | "raw_material")}
            className={inputCls}
          >
            <option value="capex">CAPEX — Plant Setup</option>
            <option value="raw_material">Raw Material</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Vendor</label>
          <select name="vendor_id" className={inputCls} required defaultValue="">
            <option value="" disabled>
              Select vendor
            </option>
            {filteredVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Budget head</label>
          <select name="budget_head_id" className={inputCls} required defaultValue="">
            <option value="" disabled>
              Select budget head
            </option>
            {filteredHeads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.sub_head}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Expected Delivery Date</label>
          <input type="date" name="expected_delivery_date" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Destination Plant / Site</label>
          <input
            type="hidden"
            name="destination_plant"
            value={newPlantChoice === "custom" ? newCustomPlant : newPlantChoice}
          />
          <select
            value={newPlantChoice}
            onChange={(e) => setNewPlantChoice(e.target.value)}
            className={inputCls}
          >
            {DESTINATION_PLANTS.map((dp) => (
              <option key={dp} value={dp}>
                {dp}
              </option>
            ))}
            <option value="custom">✏️ Other / Custom Plant or Site…</option>
          </select>
          {newPlantChoice === "custom" && (
            <input
              value={newCustomPlant}
              onChange={(e) => setNewCustomPlant(e.target.value)}
              placeholder="e.g. Pune Assembly Unit, Site - Kolar"
              className={`${inputCls} mt-1.5`}
              required
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Payment Terms</label>
          <input
            type="hidden"
            name="payment_terms"
            value={newTermChoice === "custom" ? newCustomTerm : newTermChoice}
          />
          <select
            value={newTermChoice}
            onChange={(e) => setNewTermChoice(e.target.value)}
            className={inputCls}
          >
            {Object.entries(PAYMENT_TERMS_LABEL).map(([val, lbl]) => (
              <option key={val} value={val}>
                {lbl}
              </option>
            ))}
            <option value="custom">✏️ Custom Payment Terms…</option>
          </select>
          {newTermChoice === "custom" && (
            <input
              value={newCustomTerm}
              onChange={(e) => setNewCustomTerm(e.target.value)}
              placeholder="e.g. 20% Adv + 60% Dispatch + 20% Commissioning"
              className={`${inputCls} mt-1.5`}
              required
            />
          )}
        </div>
        <div>
          <label className={labelCls}>Vendor Quote / Ref #</label>
          <input name="reference_no" placeholder="e.g. QT-2026-981" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Currency</label>
          <select name="currency" className={inputCls} defaultValue="INR">
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Creating draft…" : "Create Draft"}
      </button>
    </form>
  );
}

export function IssuePoPanel({ id, totalValue, currency }: { id: string; totalValue: number; currency: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(issuePurchaseOrder, null);
  const sym = currency === "USD" ? "$" : "₹";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.warning && <Alert kind="warning">{state.warning}</Alert>}
      <p className="text-xs text-[#536658]">
        Issuing locks the {totalValue > 0 ? `${sym}${totalValue.toLocaleString("en-IN")} ` : ""}line items and assigns a
        PO number. This cannot be undone directly — further changes go through an amendment.
      </p>
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Issuing…" : "Issue Purchase Order"}
      </button>
    </form>
  );
}

export function ApprovePoSecondApprovalPanel({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(approvePoSecondApproval, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <button className={btnPrimary} disabled={pending}>
        {pending ? "Approving…" : "Approve & Open PO"}
      </button>
    </form>
  );
}

export function CancelPoPanel({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(cancelPurchaseOrder, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state?.error && <p className="mb-2 text-xs font-semibold text-red-600">{state.error}</p>}
      <button className={btnSecondary} disabled={pending}>
        {pending ? "Cancelling…" : "Cancel Purchase Order"}
      </button>
    </form>
  );
}

export type AmendableLine = {
  item_description: string;
  product_sku: string | null;
  qty: number;
  unit_rate: number;
  tax_percent: number | null;
  tax_amount: number | null;
  round_off: number | null;
};

export function AmendPoPanel({ id, items }: { id: string; items: AmendableLine[] }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<AmendableLine[]>(items);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(amendPurchaseOrder, null);

  if (!open) {
    return (
      <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
        Amend Purchase Order
      </button>
    );
  }

  const updateLine = (i: number, patch: Partial<AmendableLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { item_description: "", product_sku: null, qty: 1, unit_rate: 0, tax_percent: null, tax_amount: null, round_off: null },
    ]);

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <form action={action} className="space-y-3 rounded-xl border border-[#e5decb] bg-[#fbf9f4] p-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="items_json" value={JSON.stringify(lines)} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <h3 className="text-sm font-bold text-[#14261c]">Amend line items</h3>

      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_110px_90px] gap-2 items-end">
            <div>
              <label className={labelCls}>Item</label>
              <input
                className={inputCls}
                value={l.item_description}
                onChange={(e) => updateLine(i, { item_description: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Qty</label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={l.qty}
                onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelCls}>Unit rate</label>
              <input
                type="number"
                step="any"
                className={inputCls}
                value={l.unit_rate}
                onChange={(e) => updateLine(i, { unit_rate: Number(e.target.value) })}
              />
            </div>
            <button type="button" className={btnSecondary} onClick={() => removeLine(i)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button type="button" className={btnSecondary} onClick={addLine}>
        + Add line
      </button>

      <div>
        <label className={labelCls}>Reason for amendment</label>
        <textarea name="reason" className={inputCls} rows={2} required />
      </div>

      <div className="flex gap-2">
        <button className={btnPrimary} disabled={pending}>
          {pending ? "Saving…" : "Save Amendment"}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LogGoodsReceiptPanel({
  purchaseOrderId,
  items,
}: {
  purchaseOrderId: string;
  items: { id: string; item_description: string; qty: number; qty_received?: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(recordPurchaseReceive, null);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        📦 Record Goods Receipt (GRN)
      </button>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-xs">
      <input type="hidden" name="purchase_order_id" value={purchaseOrderId} />
      <div className="flex items-center justify-between border-b border-[#bbf7d0] pb-2">
        <h3 className="font-bold text-sm text-[#166534] flex items-center gap-1.5">
          <span>📦</span> Record Goods Receipt Note (GRN)
        </h3>
        <button
          type="button"
          className="text-xs text-[#536658] hover:text-[#14261c] font-bold"
          onClick={() => setOpen(false)}
        >
          ✕ Cancel
        </button>
      </div>

      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Goods receipt recorded successfully!</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>
            GRN / Receive # <span className="text-red-600 font-bold">*</span>
          </label>
          <input
            name="receive_no"
            required
            defaultValue={`GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Received Date</label>
          <input
            type="date"
            name="received_date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputCls}
            required
          />
        </div>
        <div>
          <label className={labelCls}>Delivery Challan / Invoice #</label>
          <input
            name="delivery_challan_no"
            placeholder="e.g. DC-9912 or INV-4401"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={`${labelCls} mb-1.5 block`}>
          Received Quantities <span className="text-red-600 font-bold">*</span>
        </label>
        <div className="divide-y divide-[#e5decb] rounded-lg border border-[#e5decb] bg-white overflow-hidden">
          {items.map((item) => {
            const pendingQty = Math.max(0, Number(item.qty) - Number(item.qty_received || 0));
            return (
              <div key={item.id} className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#14261c] truncate">{item.item_description}</div>
                  <div className="text-[11px] text-[#536658]">
                    Ordered: <span className="font-bold">{item.qty}</span> · Received to date: <span className="font-bold">{item.qty_received || 0}</span> · Remaining: <span className="font-bold text-[#b45309]">{pendingQty}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="hidden" name="po_item_id" value={item.id} />
                  <span className="text-[11px] font-bold text-[#536658]">Qty Receiving:</span>
                  <input
                    type="number"
                    name="qty_received"
                    step="any"
                    min="0"
                    max={pendingQty > 0 ? pendingQty : undefined}
                    defaultValue={pendingQty > 0 ? pendingQty : 0}
                    className="w-24 rounded-lg border border-[#d0c9b6] px-2 py-1 text-right font-bold text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelCls}>Remarks / Inspection Note (optional)</label>
        <input
          name="remarks"
          placeholder="e.g. Received at Coimbatore warehouse in good physical condition"
          className={inputCls}
        />
      </div>

      <div className="flex gap-2">
        <button className={btnPrimary} disabled={pending}>
          {pending ? "Saving GRN…" : "Save Goods Receipt"}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
