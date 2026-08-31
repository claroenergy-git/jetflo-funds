"use client";

import { useActionState, useState } from "react";
import {
  onboardVendor,
  approveVendor,
  rejectVendor,
  addBudgetHead,
  type ActionResult,
} from "@/app/actions";
import { inputCls, labelCls, btnPrimary, btnSecondary, Alert, Card } from "@/components/ui";

export function VendorOnboardingForm({ isFinance = false }: { isFinance?: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(onboardVendor, null);

  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [isUnregistered, setIsUnregistered] = useState(false);
  const [accountNo, setAccountNo] = useState("");
  const [confirmAccountNo, setConfirmAccountNo] = useState("");
  const [ifsc, setIfsc] = useState("");

  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15);
    setGstin(clean);
    if (clean.length >= 12) {
      setPan(clean.slice(2, 12));
    }
  };

  const accountMismatch = confirmAccountNo.length > 0 && confirmAccountNo !== accountNo;

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.warning && <Alert kind="warning">{state.warning}</Alert>}
      {state?.ok && (
        <Alert kind="success">
          {isFinance
            ? "Vendor added and activated in master directory."
            : "Vendor onboarding request submitted to accounts@claroenergy.in for dual-control approval."}
        </Alert>
      )}

      {/* Basic Vendor Info */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>
            Legal Business Name <span className="text-amber-400 font-bold">*</span>
          </label>
          <input
            name="name"
            required
            className={inputCls}
            placeholder="e.g. Shakti Machine Tools Pvt Ltd"
          />
        </div>
        <div>
          <label className={labelCls}>Trade Name / Brand Alias</label>
          <input name="trade_name" className={inputCls} placeholder="Optional trade alias" />
        </div>
      </div>

      {/* Statutory / Tax Section */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            GSTIN & PAN Verification
          </span>
          <label className="flex items-center gap-1.5 text-xs text-[#8E9CA6] cursor-pointer">
            <input
              type="checkbox"
              name="is_unregistered"
              value="true"
              checked={isUnregistered}
              onChange={(e) => setIsUnregistered(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-amber-400 focus:ring-0"
            />
            <span>GST Exempt / Unregistered</span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {!isUnregistered && (
            <div>
              <label className={labelCls}>
                15-Digit GSTIN <span className="text-amber-400 font-bold">*</span>
              </label>
              <input
                name="gstin"
                required={!isUnregistered}
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                placeholder="e.g. 33AABCS1234F1Z5"
                maxLength={15}
                className={`${inputCls} font-mono uppercase`}
              />
              {gstin && gstin.length !== 15 && (
                <p className="mt-1 text-[11px] text-amber-400">Must be 15 alphanumeric characters</p>
              )}
            </div>
          )}

          <div>
            <label className={labelCls}>
              10-Digit PAN <span className="text-amber-400 font-bold">*</span>
            </label>
            <input
              name="pan"
              required
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase().slice(0, 10))}
              placeholder="e.g. AABCS1234F"
              maxLength={10}
              className={`${inputCls} font-mono uppercase`}
            />
          </div>
        </div>
      </div>

      {/* Point of Contact */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>
            Contact Person <span className="text-amber-400 font-bold">*</span>
          </label>
          <input name="contact_person" required className={inputCls} placeholder="Key person name" />
        </div>
        <div>
          <label className={labelCls}>Accounts Email</label>
          <input
            name="email"
            type="email"
            className={inputCls}
            placeholder="billing@vendor.com"
          />
        </div>
        <div>
          <label className={labelCls}>
            Mobile / Phone <span className="text-amber-400 font-bold">*</span>
          </label>
          <input
            name="phone"
            required
            type="tel"
            className={inputCls}
            placeholder="10-digit mobile"
          />
        </div>
      </div>

      {/* Address */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={labelCls}>Registered Office Address</label>
          <input name="address_line" className={inputCls} placeholder="Street / Industrial Area" />
        </div>
        <div>
          <label className={labelCls}>City / District</label>
          <input name="city" className={inputCls} placeholder="e.g. Coimbatore" />
        </div>
        <div>
          <label className={labelCls}>PIN Code</label>
          <input
            name="pincode"
            maxLength={6}
            className={`${inputCls} font-mono`}
            placeholder="6-digit PIN"
          />
        </div>
      </div>

      {/* Banking Details */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Bank Transfer & Disbursement Details
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Bank Name <span className="text-amber-400 font-bold">*</span>
            </label>
            <input
              name="bank_name"
              required
              className={inputCls}
              placeholder="e.g. HDFC Bank / ICICI Bank / SBI"
            />
          </div>
          <div>
            <label className={labelCls}>
              IFSC Code <span className="text-amber-400 font-bold">*</span>
            </label>
            <input
              name="ifsc"
              required
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))}
              placeholder="e.g. HDFC0000123"
              maxLength={11}
              className={`${inputCls} font-mono uppercase`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Bank Account Number <span className="text-amber-400 font-bold">*</span>
            </label>
            <input
              name="account_no"
              type="password"
              required
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value.trim())}
              className={`${inputCls} font-mono`}
              placeholder="Enter account number"
            />
          </div>
          <div>
            <label className={labelCls}>
              Confirm Account Number <span className="text-amber-400 font-bold">*</span>
            </label>
            <input
              name="confirm_account_no"
              required
              value={confirmAccountNo}
              onChange={(e) => setConfirmAccountNo(e.target.value.trim())}
              className={`${inputCls} font-mono ${accountMismatch ? "border-red-500 focus:border-red-500" : ""}`}
              placeholder="Re-enter to confirm"
            />
            {accountMismatch && (
              <p className="mt-1 text-[11px] text-red-400">Account numbers do not match!</p>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Document Proofs */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3.5 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Verification Attachments
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Cancelled Cheque / Passbook <span className="text-amber-400 font-bold">*</span>
            </label>
            <input
              name="bank_proof"
              type="file"
              required={!isFinance}
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className={`${inputCls} file:mr-2 file:rounded file:border-0 file:bg-amber-500/20 file:text-amber-300 file:px-2.5 file:py-1 file:text-xs file:font-bold`}
            />
            <p className="mt-1 text-[10px] text-[#8E9CA6]">Mandatory for accounts validation</p>
          </div>

          <div>
            <label className={labelCls}>GST Certificate / REG-06</label>
            <input
              name="gst_cert"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className={`${inputCls} file:mr-2 file:rounded file:border-0 file:bg-white/10 file:text-slate-200 file:px-2.5 file:py-1 file:text-xs file:font-bold`}
            />
            <p className="mt-1 text-[10px] text-[#8E9CA6]">Optional if GSTIN verified</p>
          </div>
        </div>
      </div>

      <button disabled={pending || accountMismatch} className={`${btnPrimary} w-full py-2.5`}>
        {pending ? "Submitting Onboarding Request…" : isFinance ? "Onboard & Activate Vendor" : "Submit Onboarding Request to Accounts"}
      </button>
    </form>
  );
}

export function VendorApprovalActions({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const [approveState, approveAction, approvePending] = useActionState<ActionResult | null, FormData>(
    approveVendor,
    null
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<ActionResult | null, FormData>(
    rejectVendor,
    null
  );

  return (
    <div className="flex items-center gap-2">
      {approveState?.error && <span className="text-xs text-red-400">{approveState.error}</span>}
      {rejectState?.error && <span className="text-xs text-red-400">{rejectState.error}</span>}

      <form action={approveAction}>
        <input type="hidden" name="vendor_id" value={vendorId} />
        <button
          disabled={approvePending || rejectPending}
          className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all"
        >
          {approvePending ? "Approving…" : "Approve & Activate"}
        </button>
      </form>

      <form action={rejectAction}>
        <input type="hidden" name="vendor_id" value={vendorId} />
        <button
          disabled={approvePending || rejectPending}
          className="rounded-lg bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-all"
        >
          {rejectPending ? "Rejecting…" : "Reject"}
        </button>
      </form>
    </div>
  );
}

export function BudgetHeadForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(addBudgetHead, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Budget head added.</Alert>}
      <div>
        <label className={labelCls}>Expense Category</label>
        <select name="category" className={inputCls}>
          <option value="capex">CAPEX — Plant Setup</option>
          <option value="raw_material">Raw Material / Components</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Sub-head Name *</label>
        <input
          name="sub_head"
          required
          className={inputCls}
          placeholder="e.g. JetFlo Aqua, JetFlo Volt"
        />
      </div>
      <div>
        <label className={labelCls}>Sanctioned Budget (₹, optional)</label>
        <input name="sanctioned_amount" type="number" step="any" min="0" className={inputCls} />
      </div>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Add Budget Head"}
      </button>
    </form>
  );
}
