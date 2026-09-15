"use client";

import { useActionState, useState } from "react";
import { addPoLineItem, updatePoLineItem, deletePoLineItem, type ActionResult } from "@/app/actions";
import { Alert, btnPrimary, btnSecondary, labelCls, inputCls } from "@/components/ui";
import { fmtMoney } from "@/lib/format";

type PoItem = {
  id: string;
  item_description: string;
  product_sku: string | null;
  qty: number;
  qty_received?: number;
  unit_rate: number;
  tax_percent: number | null;
  tax_amount: number | null;
  round_off: number | null;
  line_total: number;
};

export function PoLineItemsEditor({
  purchaseOrderId,
  items,
  currency,
  editable,
}: {
  purchaseOrderId: string;
  items: PoItem[];
  currency: string;
  editable: boolean;
}) {
  const total = items.reduce((s, i) => s + Number(i.line_total || 0), 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
              <th className="px-4 py-2.5">Item</th>
              <th className="px-4 py-2.5 text-right">Qty</th>
              <th className="px-4 py-2.5 text-right">Unit Rate</th>
              <th className="px-4 py-2.5 text-right">Line Total</th>
              {editable && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5decb]">
            {items.length === 0 ? (
              <tr>
                <td colSpan={editable ? 5 : 4} className="px-4 py-6 text-center text-xs text-[#536658]">
                  No line items yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <PoLineItemRow key={item.id} purchaseOrderId={purchaseOrderId} item={item} currency={currency} editable={editable} />
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#e5decb] bg-[#fbf9f4] font-extrabold text-[#14261c]">
              <td className="px-4 py-2.5" colSpan={3}>
                Total
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(total, currency)}</td>
              {editable && <td className="px-4 py-2.5" />}
            </tr>
          </tfoot>
        </table>
      </div>

      {editable && <PoAddLineItemForm purchaseOrderId={purchaseOrderId} />}
    </div>
  );
}

function PoLineItemRow({
  purchaseOrderId,
  item,
  currency,
  editable,
}: {
  purchaseOrderId: string;
  item: PoItem;
  currency: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState<ActionResult | null, FormData>(updatePoLineItem, null);
  const [deleteState, deleteAction, deletePending] = useActionState<ActionResult | null, FormData>(deletePoLineItem, null);

  if (editing) {
    return (
      <tr className="bg-[#fbf9f4]">
        <td colSpan={5} className="px-4 py-3">
          <form action={updateAction} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_110px_90px_90px_auto] gap-2 items-end">
            <input type="hidden" name="item_id" value={item.id} />
            <input type="hidden" name="purchase_order_id" value={purchaseOrderId} />
            {updateState?.error && (
              <div className="sm:col-span-6">
                <Alert kind="error">{updateState.error}</Alert>
              </div>
            )}
            <div>
              <label className={labelCls}>Item</label>
              <input name="item_description" defaultValue={item.item_description} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Qty</label>
              <input name="qty" type="number" step="any" defaultValue={item.qty} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Unit rate</label>
              <input name="unit_rate" type="number" step="any" defaultValue={item.unit_rate} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Tax %</label>
              <input name="tax_percent" type="number" step="any" defaultValue={item.tax_percent ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Round off</label>
              <input name="round_off" type="number" step="any" defaultValue={item.round_off ?? ""} className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={updatePending}>
                {updatePending ? "Saving…" : "Save"}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-[#fbf9f4] transition-colors">
      <td className="px-4 py-2.5">
        <div className="font-bold text-[#14261c]">{item.item_description}</div>
        {item.product_sku && <div className="text-[11px] text-[#7a8d80]">{item.product_sku}</div>}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">
        <div className="font-bold">{item.qty}</div>
        {!editable && item.qty_received != null && (
          <div className={`text-[10px] font-bold ${Number(item.qty_received) >= Number(item.qty) ? "text-[#166534]" : "text-[#b45309]"}`}>
            Recv: {item.qty_received}
          </div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMoney(item.unit_rate, currency)}</td>
      <td className="px-4 py-2.5 text-right font-bold tabular-nums">{fmtMoney(item.line_total, currency)}</td>
      {editable && (
        <td className="px-4 py-2.5 text-right">
          <div className="flex justify-end gap-1.5">
            <button className={btnSecondary} onClick={() => setEditing(true)}>
              Edit
            </button>
            <form action={deleteAction}>
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="purchase_order_id" value={purchaseOrderId} />
              <button className={btnSecondary} disabled={deletePending}>
                {deletePending ? "…" : "Delete"}
              </button>
            </form>
          </div>
          {deleteState?.error && <p className="mt-1 text-[11px] font-semibold text-red-600">{deleteState.error}</p>}
        </td>
      )}
    </tr>
  );
}

function PoAddLineItemForm({ purchaseOrderId }: { purchaseOrderId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addPoLineItem, null);
  return (
    <form action={action} className="rounded-xl border border-dashed border-[#c8bd9f] p-4">
      <input type="hidden" name="purchase_order_id" value={purchaseOrderId} />
      {state?.error && (
        <div className="mb-2">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px_110px_90px_90px_auto] gap-2 items-end">
        <div>
          <label className={labelCls}>Item description</label>
          <input name="item_description" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Qty</label>
          <input name="qty" type="number" step="any" min="0" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Unit rate</label>
          <input name="unit_rate" type="number" step="any" min="0" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Tax %</label>
          <input name="tax_percent" type="number" step="any" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Round off</label>
          <input name="round_off" type="number" step="any" className={inputCls} />
        </div>
        <button className={btnPrimary} disabled={pending}>
          {pending ? "Adding…" : "+ Add line"}
        </button>
      </div>
    </form>
  );
}
