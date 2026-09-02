"use client";

import { useActionState, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRequest, updateDraft, type ActionResult } from "@/app/actions";
import { inputCls, labelCls, btnPrimary, btnSecondary, Alert } from "@/components/ui";
import { inr } from "@/lib/format";

interface Option {
  id: string;
  name?: string;
  sub_head?: string;
  category?: string;
}

interface PriorRequest {
  id: string;
  request_no: string;
  vendor_id: string;
  amount_approved?: number | null;
  amount_requested?: number;
  item_description?: string;
  status: string;
}

const SUBHEAD_OPTIONS = ["JetFlo Aqua", "JetFlo Volt", "JetFlo Reserve", "Not Applicable"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function RequestForm({
  vendors,
  budgetHeads,
  priorRequests = [],
  existing,
}: {
  vendors: Option[];
  budgetHeads: Option[];
  priorRequests?: PriorRequest[];
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
    setAttempt((a) => a + 1);
    return res;
  };

  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(wrapped, null);

  const dv = (name: string, fallback: string | number | null | undefined) =>
    saved[name] ?? (fallback ?? "");

  const [category, setCategory] = useState<string>(existing?.category ?? "capex");
  const [subHeadName, setSubHeadName] = useState<string>(
    existing?.budget_head?.sub_head ?? SUBHEAD_OPTIONS[0]
  );
  const [vendorId, setVendorId] = useState<string>(String(dv("vendor_id", existing?.vendor?.id ?? existing?.vendor_id)));
  const [paymentType, setPaymentType] = useState<string>(existing?.payment_type ?? "advance");
  const [parentReqId, setParentReqId] = useState<string>(existing?.parent_request_id ?? "");

  // Auto-calculation of Line Total from Qty × Unit Rate
  const [qty, setQty] = useState<string>(String(existing?.qty ?? ""));
  const [unitRate, setUnitRate] = useState<string>(String(existing?.unit_rate ?? ""));
  const [amount, setAmount] = useState<string>(String(existing?.amount_requested ?? ""));
  const [isManualAmount, setIsManualAmount] = useState<boolean>(false);

  useEffect(() => {
    const q = parseFloat(qty);
    const r = parseFloat(unitRate);
    if (!isNaN(q) && !isNaN(r) && q > 0 && r > 0 && !isManualAmount) {
      setAmount((q * r).toFixed(2));
    }
  }, [qty, unitRate, isManualAmount]);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <Alert kind="success">Request saved{state.warning ? "" : " successfully"}.</Alert>
        {state.warning && <Alert kind="warning">{state.warning}</Alert>}
        <button className={btnPrimary} onClick={() => router.push(`/requests/${state.id}`)}>
          View request details ➔
        </button>
      </div>
    );
  }

  // Find matching budget_head_id based on category and chosen sub-head name
  const matchingBudgetHead =
    budgetHeads.find(
      (b) => b.category === category && b.sub_head?.toLowerCase() === subHeadName.toLowerCase()
    ) || budgetHeads.find((b) => b.category === category) || budgetHeads[0];

  // Vendor prior requests for against-balance linking
  const vendorPriorRequests = priorRequests.filter((pr) => pr.vendor_id === vendorId);

  return (
    <form key={attempt} action={formAction} className="space-y-5">
      {existing && <input type="hidden" name="id" value={existing.id} />}
      <input type="hidden" name="budget_head_id" value={matchingBudgetHead?.id ?? ""} />

      {state?.error && <Alert kind="error">{state.error}</Alert>}

      {/* Category & Subhead Header */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            Expense Category <span className="text-red-600 font-bold">*</span>
          </label>
          <select
            name="category"
            required
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="capex">CAPEX — Plant Setup</option>
            <option value="raw_material">Raw Material / Components</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>
            Sub-head <span className="text-red-600 font-bold">*</span>
          </label>
          <select
            required
            className={inputCls}
            value={subHeadName}
            onChange={(e) => setSubHeadName(e.target.value)}
          >
            {SUBHEAD_OPTIONS.map((sh) => (
              <option key={sh} value={sh}>
                {sh}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Vendor & SKU Selection */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>
              Vendor / Beneficiary <span className="text-red-600 font-bold">*</span>
            </label>
            <Link
              href="/finance/vendors"
              target="_blank"
              className="text-[11px] font-bold text-[#1e3e30] hover:underline"
            >
              + Onboard new vendor
            </Link>
          </div>
          <select
            name="vendor_id"
            required
            className={inputCls}
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setParentReqId("");
            }}
          >
            <option value="" disabled>
              Select approved vendor…
            </option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {vendors.length === 0 && (
            <p className="mt-1 text-xs text-[#b45309] font-medium">
              No approved vendors found. Please onboard vendor first.
            </p>
          )}
        </div>

        {category === "raw_material" ? (
          <div>
            <label className={labelCls}>Product / SKU Code</label>
            <input
              name="product_sku"
              className={inputCls}
              placeholder="e.g. JF-SUB-1HP or JF-VOLT-INV"
              defaultValue={dv("product_sku", existing?.product_sku)}
            />
          </div>
        ) : (
          <div>
            <label className={labelCls}>Plant Location</label>
            <input
              disabled
              className={`${inputCls} opacity-70 bg-[#f0ebd9] cursor-not-allowed`}
              value="JetFlo Coimbatore Plant"
            />
          </div>
        )}
      </div>

      {/* Item Description */}
      <div>
        <label className={labelCls}>
          Item Description <span className="text-red-600 font-bold">*</span>
        </label>
        <input
          name="item_description"
          required
          className={inputCls}
          placeholder="Precise technical or procurement description"
          defaultValue={dv("item_description", existing?.item_description)}
        />
      </div>

      {/* Line Item: Qty, Unit Rate, and Auto-calculated Total */}
      <div className="rounded-xl border border-[#e2dbcc] bg-[#fbf9f4] p-4 space-y-3 shadow-xs">
        <div className="text-xs font-bold uppercase tracking-wider text-[#1e3e30] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
            Line Total Calculation
          </span>
          <span className="text-[11px] text-[#536658] font-normal normal-case">
            Auto-calculates Line Total from Qty × Rate
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className={labelCls}>Quantity</label>
            <input
              name="qty"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 100"
              className={inputCls}
              value={qty}
              onChange={(e) => {
                setQty(e.target.value);
                setIsManualAmount(false);
              }}
            />
          </div>

          <div>
            <label className={labelCls}>Unit Rate (₹)</label>
            <input
              name="unit_rate"
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 450.00"
              className={inputCls}
              value={unitRate}
              onChange={(e) => {
                setUnitRate(e.target.value);
                setIsManualAmount(false);
              }}
            />
          </div>

          <div>
            <label className={labelCls}>
              Total Amount Requested (₹) <span className="text-red-600 font-bold">*</span>
            </label>
            <input
              name="amount_requested"
              type="number"
              step="any"
              min="1"
              required
              placeholder="Total ₹"
              className={`${inputCls} font-bold text-[#14261c] bg-[#eaf3ed] border-[#cce3d4]`}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setIsManualAmount(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Payment Type & Against-Balance Prior Invoice Selector */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            Payment Type <span className="text-red-600 font-bold">*</span>
          </label>
          <select
            name="payment_type"
            required
            className={inputCls}
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
          >
            <option value="advance">Advance (against Quotation / Proforma)</option>
            <option value="against_invoice">Against Invoice</option>
            <option value="balance">Balance Payment (against Prior Invoice / PO)</option>
          </select>
        </div>

        {paymentType === "balance" ? (
          <div>
            <label className={labelCls}>
              Link Prior Request / Invoice <span className="text-red-600 font-bold">*</span>
            </label>
            {vendorPriorRequests.length > 0 ? (
              <select
                name="parent_request_id"
                required
                className={inputCls}
                value={parentReqId}
                onChange={(e) => setParentReqId(e.target.value)}
              >
                <option value="" disabled>
                  Select prior vendor request…
                </option>
                {vendorPriorRequests.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.request_no} — {pr.item_description} ({inr(pr.amount_approved || pr.amount_requested)})
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="prior_invoice_no"
                required
                className={inputCls}
                placeholder="Enter prior invoice / PO reference #"
                defaultValue={dv("prior_invoice_no", existing?.prior_invoice_no)}
              />
            )}
          </div>
        ) : (
          <div>
            <label className={labelCls}>Supporting Document Classification</label>
            <select name="doc_kind" className={inputCls} defaultValue="quotation">
              <option value="quotation">Quotation / Commercial Bid</option>
              <option value="proforma">Proforma Invoice</option>
              <option value="invoice">Tax Invoice</option>
              <option value="purchase_order">Purchase Order / Work Order</option>
              <option value="delivery_challan">Delivery Challan / GRN</option>
              <option value="other">Contract / Service Agreement</option>
            </select>
          </div>
        )}
      </div>

      {/* Mandatory Document Upload */}
      <div className="rounded-xl border border-[#d8e8dc] bg-[#f4f9f5] p-4 space-y-2 shadow-xs">
        <div className="flex items-center justify-between">
          <label className={labelCls}>
            Mandatory Supporting Document (PDF or Image){" "}
            <span className="text-red-600 font-bold">*</span>
          </label>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e3e30]">
            Mandatory for Submission
          </span>
        </div>
        <input
          name="doc_file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-[#1e3e30] file:text-white file:px-3 file:py-1.5 file:text-xs file:font-bold hover:file:bg-[#142d21] cursor-pointer`}
        />
        <p className="text-[11px] text-[#536658]">
          Attach Quotation, Proforma, Tax Invoice, or PO. Free-text justification has been replaced by verified document upload.
        </p>
      </div>

      {/* Optional Operational Notes */}
      <div>
        <label className={labelCls}>Operational Remarks / Context (Optional)</label>
        <textarea
          name="justification"
          rows={2}
          className={inputCls}
          placeholder="Any specific delivery or payment terms context for Accounts"
          defaultValue={dv("justification", existing?.justification)}
        />
      </div>

      {/* Submission Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button name="intent" value="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Submitting for Approval…" : "Submit for Approval"}
        </button>
        <button
          name="intent"
          value="draft"
          disabled={pending}
          formNoValidate
          className={btnSecondary}
        >
          {pending ? "Saving Draft…" : "Save as Draft"}
        </button>
      </div>
    </form>
  );
}
