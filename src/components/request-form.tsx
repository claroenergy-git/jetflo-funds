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
  const [fileError, setFileError] = useState<string | null>(null);

  const wrapped = async (prev: ActionResult | null, fd: FormData) => {
    const file = fd.get("doc_file") as File | null;
    if (file && file.size > 4.5 * 1024 * 1024) {
      return {
        ok: false,
        error: `Selected document (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 4.5 MB server upload limit. Please compress or optimize the PDF/image before uploading.`,
      };
    }

    const entries: Record<string, string> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string") entries[k] = v;
    });
    setSaved(entries);

    try {
      const res = await action(prev, fd);
      setAttempt((a) => a + 1);
      return res;
    } catch (err: any) {
      console.error("Submission error:", err);
      return {
        ok: false,
        error:
          err?.message ||
          "A network or server error occurred while saving the request. If you uploaded a large document, please ensure it is under 4 MB.",
      };
    }
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

  // Auto-calculation of Line Total: Qty × Unit Rate + Tax% + Round Off
  const [qty, setQty] = useState<string>(String(existing?.qty ?? ""));
  const [unitRate, setUnitRate] = useState<string>(String(existing?.unit_rate ?? ""));
  const [taxPercent, setTaxPercent] = useState<string>(
    existing?.tax_percent !== undefined && existing?.tax_percent !== null ? String(existing.tax_percent) : ""
  );
  const [taxAmount, setTaxAmount] = useState<string>(
    existing?.tax_amount !== undefined && existing?.tax_amount !== null ? String(existing.tax_amount) : ""
  );
  const [roundOff, setRoundOff] = useState<string>(
    existing?.round_off !== undefined && existing?.round_off !== null ? String(existing.round_off) : ""
  );
  const [amount, setAmount] = useState<string>(String(existing?.amount_requested ?? ""));
  const [isManualAmount, setIsManualAmount] = useState<boolean>(false);

  const isAdvance = paymentType === "advance";
  const parsedQty = parseFloat(qty);
  const parsedRate = parseFloat(unitRate);
  const taxableValue =
    !isNaN(parsedQty) && !isNaN(parsedRate) && parsedQty > 0 && parsedRate > 0
      ? Number((parsedQty * parsedRate).toFixed(2))
      : 0;

  useEffect(() => {
    if (isAdvance || isManualAmount) return;

    if (taxableValue > 0) {
      let tAmt = 0;
      if (taxPercent !== "") {
        const tp = parseFloat(taxPercent);
        if (!isNaN(tp) && tp >= 0) {
          tAmt = Number((taxableValue * (tp / 100)).toFixed(2));
          setTaxAmount(tAmt > 0 ? tAmt.toFixed(2) : "0.00");
        }
      } else if (taxAmount !== "") {
        const parsedTax = parseFloat(taxAmount);
        if (!isNaN(parsedTax) && parsedTax >= 0) tAmt = parsedTax;
      }

      let ro = 0;
      if (roundOff !== "") {
        const parsedRo = parseFloat(roundOff);
        if (!isNaN(parsedRo)) ro = parsedRo;
      }

      const finalTotal = (taxableValue + tAmt + ro).toFixed(2);
      setAmount(finalTotal);
    }
  }, [qty, unitRate, taxPercent, roundOff, isManualAmount, isAdvance, taxableValue]);

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
            onChange={(e) => {
              const newType = e.target.value;
              setPaymentType(newType);
              if (newType === "advance") {
                setIsManualAmount(false);
              }
            }}
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
            <select
              name="doc_kind"
              className={inputCls}
              defaultValue={paymentType === "advance" ? "quotation" : "invoice"}
            >
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

      {/* Amount / Line Total Calculation Section */}
      {isAdvance ? (
        /* Advance Payment Mode: Only Total Amount Requested is required */
        <div className="rounded-xl border border-[#d8e8dc] bg-[#f4f9f5] p-4 space-y-3 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-[#1e3e30] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
              Advance Amount Requested
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#e0eee3] text-[#1e3e30]">
              Advance Payment Mode
            </span>
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
              placeholder="e.g. 50000"
              className={`${inputCls} font-bold text-[#14261c] bg-[#eaf3ed] border-[#cce3d4] text-lg`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-[#536658]">
              Advance payments against quotations / proforma are lump-sum; line-item quantity, tax rate, and round-off breakdowns are not required.
            </p>
          </div>
        </div>
      ) : (
        /* Against Invoice / Balance Mode: Full Aligned Line Total Calculation */
        <div className="rounded-xl border border-[#e2dbcc] bg-[#fbf9f4] p-4 space-y-4 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-[#1e3e30] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
              Line Total Calculation
            </span>
            <span className="text-[11px] text-[#536658] font-normal normal-case">
              Auto-calculates Line Total from Qty × Rate + Tax% + Round Off
            </span>
          </div>

          {/* Row 1: Quantity, Unit Rate, Taxable Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className={labelCls}>Quantity</label>
              <input
                name="qty"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 6.630"
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
                placeholder="e.g. 1500.00"
                className={inputCls}
                value={unitRate}
                onChange={(e) => {
                  setUnitRate(e.target.value);
                  setIsManualAmount(false);
                }}
              />
            </div>

            <div>
              <label className={labelCls}>Taxable Value (₹)</label>
              <div className="flex items-center h-[42px] px-3.5 rounded-lg bg-[#f0ebd9] border border-[#dcd4c0] text-sm font-semibold text-[#14261c]">
                {taxableValue > 0 ? inr(taxableValue) : "—"}
              </div>
            </div>
          </div>

          {/* Row 2: Tax %, Tax Amount, Round Off Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1 border-t border-[#e8e2d4]">
            <div>
              <label className={labelCls}>
                TAX % <span className="text-[11px] text-[#536658] font-normal normal-case">(optional)</span>
              </label>
              <input
                name="tax_percent"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 18"
                className={inputCls}
                value={taxPercent}
                onChange={(e) => {
                  setTaxPercent(e.target.value);
                  setIsManualAmount(false);
                }}
              />
            </div>

            <div>
              <label className={labelCls}>
                TAX AMOUNT (₹) <span className="text-[11px] text-[#536658] font-normal normal-case">(optional)</span>
              </label>
              <input
                name="tax_amount"
                type="number"
                step="any"
                min="0"
                placeholder="Auto / ₹"
                className={inputCls}
                value={taxAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setTaxAmount(val);
                  setIsManualAmount(false);
                  const parsedT = parseFloat(val);
                  if (!isNaN(parsedT) && taxableValue > 0) {
                    setTaxPercent(Number(((parsedT / taxableValue) * 100).toFixed(2)).toString());
                  }
                }}
              />
            </div>

            <div>
              <label className={labelCls}>
                ROUND OFF RATE (+/-){" "}
                <span className="text-[11px] text-[#536658] font-normal normal-case">(optional)</span>
              </label>
              <input
                name="round_off"
                type="number"
                step="any"
                placeholder="e.g. -0.10"
                className={inputCls}
                value={roundOff}
                onChange={(e) => {
                  setRoundOff(e.target.value);
                  setIsManualAmount(false);
                }}
              />
            </div>
          </div>

          {/* Row 3: Total Amount Requested with live breakdown hint */}
          <div className="pt-2 border-t border-[#e8e2d4]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className={labelCls}>
                  Total Amount Requested (₹) <span className="text-red-600 font-bold">*</span>
                </label>
                <p className="text-[11px] text-[#536658]">
                  {taxableValue > 0
                    ? `Base: ${inr(taxableValue)} + Tax: ${inr(parseFloat(taxAmount) || 0)} ${roundOff ? `+ Round-off: ${roundOff}` : ""}`
                    : "Auto-calculated total payable amount"}
                </p>
              </div>
              <div className="sm:w-1/2">
                <input
                  name="amount_requested"
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="Total ₹"
                  className={`${inputCls} font-bold text-[#14261c] bg-[#eaf3ed] border-[#cce3d4] text-base`}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setIsManualAmount(true);
                    // Automatically deduce tax rate if total is entered and taxable value is known
                    const enteredTotal = parseFloat(e.target.value);
                    const ro = parseFloat(roundOff) || 0;
                    if (!isNaN(enteredTotal) && taxableValue > 0 && enteredTotal > taxableValue) {
                      const deducedTax = Number((enteredTotal - ro - taxableValue).toFixed(2));
                      if (deducedTax >= 0) {
                        setTaxAmount(deducedTax.toString());
                        setTaxPercent(Number(((deducedTax / taxableValue) * 100).toFixed(2)).toString());
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

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
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.size > 4.5 * 1024 * 1024) {
              setFileError(
                `Selected file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Vercel limits file uploads to 4.5 MB. Please upload a compressed PDF or image.`
              );
            } else {
              setFileError(null);
            }
          }}
        />
        {fileError && (
          <p className="text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
            ⚠️ {fileError}
          </p>
        )}
        <p className="text-[11px] text-[#536658]">
          Attach Quotation, Proforma, Tax Invoice, or PO (max 4.5 MB). Free-text justification has been replaced by verified document upload.
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
