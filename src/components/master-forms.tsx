"use client";

import { useActionState } from "react";
import { addVendor, addBudgetHead, type ActionResult } from "@/app/actions";
import { inputCls, labelCls, btnPrimary, Alert } from "@/components/ui";

export function VendorForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addVendor, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Vendor added.</Alert>}
      <div>
        <label className={labelCls}>Vendor name *</label>
        <input name="name" required className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>GSTIN</label>
          <input name="gstin" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Category</label>
          <select name="category" className={inputCls}>
            <option value="both">Both</option>
            <option value="capex">CAPEX</option>
            <option value="raw_material">Raw material</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Bank</label>
          <input name="bank_name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>IFSC</label>
          <input name="ifsc" className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Account number</label>
        <input name="account_no" className={inputCls} />
      </div>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Add vendor"}
      </button>
    </form>
  );
}

export function BudgetHeadForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addBudgetHead, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Budget head added.</Alert>}
      <div>
        <label className={labelCls}>Category</label>
        <select name="category" className={inputCls}>
          <option value="capex">CAPEX</option>
          <option value="raw_material">Raw material</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Sub-head *</label>
        <input name="sub_head" required className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Sanctioned budget (₹, optional for raw material)</label>
        <input name="sanctioned_amount" type="number" step="any" min="0" className={inputCls} />
      </div>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Add budget head"}
      </button>
    </form>
  );
}
