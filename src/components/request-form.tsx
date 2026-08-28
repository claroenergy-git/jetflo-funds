"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createRequest, updateDraft, type ActionResult } from "@/app/actions";
import { inputCls, labelCls, btnPrimary, btnSecondary, Alert } from "@/components/ui";

interface Option {
  id: string;
  name?: string;
  sub_head?: string;
  category?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RequestForm({
  vendors,
  budgetHeads,
  existing,
}: {
  vendors: Option[];
  budgetHeads: Option[];
  existing?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}) {
  const router = useRouter();
  const action = existing ? updateDraft : createRequest;
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const wrapped = async (prev: ActionResult | null, fd: FormData) => {
    const entries: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string") entries[k] = v;
    });
    setSaved(entries);
    const res = await action(prev, fd);
    setAttempt((a) => a + 1); // remount form so retained values re-apply after React's reset
    return res;
  };
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(wrapped, null);
  const [category, setCategory] = useState<string>(existing?.category ?? "capex");
  const dv = (name: string, fallback: string | number | null | undefined) =>
    saved[name] ?? (fallback ?? "");
  const [budgetHeadId, setBudgetHeadId] = useState<string>(String(dv("budget_head_id", existing?.budget_head?.id)));
  const [vendorId, setVendorId] = useState<string>(String(dv("vendor_id", existing?.vendor?.id)));

  if (state?.ok) {
    return (
      <div className="space-y-3">
        <Alert kind="success">Request saved{state.warning ? "" : " successfully"}.</Alert>
        {state.warning && <Alert kind="warning">{state.warning}</Alert>}
        <button className={btnPrimary} onClick={() => router.push(`/requests/${state.id}`)}>
          View request
        </button>
      </div>
    );
  }

  const heads = budgetHeads.filter((b) => b.category === category);
  const vendorOpts = vendors.filter(
    (v) => v.category === "both" || v.category === category || !v.category
  );

  return (
    <form key={attempt} action={formAction} className="space-y-4">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      {state?.error && <Alert kind="error">{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Category</label>
          <select
            name="category"
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="capex">CAPEX — Plant Setup</option>
            <option value="raw_material">Raw Material / Components</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Sub-head</label>
          <select
            name="budget_head_id"
            required
            className={inputCls}
            value={budgetHeadId}
            onChange={(e) => setBudgetHeadId(e.target.value)}
          >
            <option value="" disabled>
              Select…
            </option>
            {heads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.sub_head}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Vendor</label>
          <select
            name="vendor_id"
            required
            className={inputCls}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="" disabled>
              Select…
            </option>
            {vendorOpts.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        {category === "raw_material" && (
          <div>
            <label className={labelCls}>Product / SKU</label>
            <input name="product_sku" className={inputCls} placeholder="e.g. JF-SUB-1HP" defaultValue={dv("product_sku", existing?.product_sku)} />
          </div>
        )}
      </div>

      <div>
        <label className={labelCls}>Item description</label>
        <input
          name="item_description"
          required
          className={inputCls}
          placeholder="What is being purchased"
          defaultValue={dv("item_description", existing?.item_description)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Qty</label>
          <input name="qty" type="number" step="any" min="0" className={inputCls} defaultValue={dv("qty", existing?.qty)} />
        </div>
        <div>
          <label className={labelCls}>Unit rate (₹)</label>
          <input name="unit_rate" type="number" step="any" min="0" className={inputCls} defaultValue={dv("unit_rate", existing?.unit_rate)} />
        </div>
        <div>
          <label className={labelCls}>Amount (₹) *</label>
          <input
            name="amount_requested"
            type="number"
            step="any"
            min="1"
            required
            className={inputCls}
            defaultValue={dv("amount_requested", existing?.amount_requested)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Urgency</label>
          <select name="urgency" className={inputCls} defaultValue={dv("urgency", existing?.urgency ?? "normal")}>
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Need by</label>
          <input name="need_by_date" type="date" className={inputCls} defaultValue={dv("need_by_date", existing?.need_by_date)} />
        </div>
        <div>
          <label className={labelCls}>Payment type</label>
          <select name="payment_type" className={inputCls} defaultValue={dv("payment_type", existing?.payment_type ?? "advance")}>
            <option value="advance">Advance</option>
            <option value="against_invoice">Against invoice</option>
            <option value="balance">Balance payment</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Justification</label>
        <textarea
          name="justification"
          rows={2}
          className={inputCls}
          placeholder="Why is this needed now"
          defaultValue={dv("justification", existing?.justification)}
        />
      </div>

      <div>
        <label className={labelCls}>Quotation / proforma (PDF or image)</label>
        <input name="quotation" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs`} />
        <p className="mt-1 text-[11px] text-slate-400">Mandatory above ₹50,000</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button name="intent" value="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Submit for approval"}
        </button>
        <button name="intent" value="draft" disabled={pending} className={btnSecondary}>
          Save as draft
        </button>
      </div>
    </form>
  );
}
