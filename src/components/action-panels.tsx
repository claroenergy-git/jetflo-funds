"use client";

import { useActionState } from "react";
import {
  financeDecide,
  recordPayment,
  closeRequest,
  submitRequest,
  type ActionResult,
} from "@/app/actions";
import { inputCls, labelCls, btnPrimary, btnSecondary, Alert } from "@/components/ui";
import { inr, fmtMoney, currencySymbol } from "@/lib/format";

export function DecisionPanel({
  id,
  amountRequested,
  status,
  amountApproved,
  currency = "INR",
}: {
  id: string;
  amountRequested: number;
  status: string;
  amountApproved: number | null;
  currency?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(financeDecide, null);
  const second = status === "awaiting_second_approval";
  const sym = currencySymbol(currency);

  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.warning && <Alert kind="warning">{state.warning}</Alert>}
      {second ? (
        <Alert kind="warning">
          First approval completed for {fmtMoney(amountApproved, currency)}. You are acting as the <b>second approver</b>.
        </Alert>
      ) : (
        <div>
          <label className={labelCls}>Approved amount ({sym}) — lower it for a partial approval</label>
          <input
            name="amount_approved"
            type="number"
            step="any"
            min="1"
            defaultValue={amountRequested}
            className={inputCls}
          />
        </div>
      )}
      <div>
        <label className={labelCls}>Remarks (required for partial / reject / send back)</label>
        <textarea name="remarks" rows={2} className={inputCls} placeholder="Remarks visible to the requester" />
      </div>
      <div className="flex flex-wrap gap-2.5 pt-1">
        <button name="decision" value="approve" disabled={pending} className={btnPrimary}>
          Approve
        </button>
        {!second && (
          <button name="decision" value="partial" disabled={pending} className={btnSecondary}>
            Partial Approve
          </button>
        )}
        <button
          name="decision"
          value="send_back"
          disabled={pending}
          className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-xs font-bold text-[#92400e] hover:bg-[#fef3c7] transition cursor-pointer disabled:opacity-50"
        >
          Send Back
        </button>
        <button
          name="decision"
          value="reject"
          disabled={pending}
          className="rounded-xl border border-[#fecaca] bg-[#fee2e2] px-4 py-2.5 text-xs font-bold text-[#991b1b] hover:bg-[#fecaca] transition cursor-pointer disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </form>
  );
}

export function PaymentForm({
  id,
  balance,
  currency = "INR",
}: {
  id: string;
  balance: number;
  currency?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(recordPayment, null);
  const sym = currencySymbol(currency);
  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.warning && <Alert kind="warning">{state.warning}</Alert>}
      {state?.ok && <Alert kind="success">Payment recorded successfully.</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Amount ({sym}) — balance {fmtMoney(balance, currency)}</label>
          <input name="amount_paid" type="number" step="any" min="1" max={balance} defaultValue={balance} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Paid on</label>
          <input name="paid_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mode</label>
          <select name="mode" className={inputCls} defaultValue={currency === "USD" ? "wire_swift" : "neft"}>
            <option value="neft">NEFT</option>
            <option value="rtgs">RTGS</option>
            <option value="imps">IMPS</option>
            <option value="wire_swift">Wire Transfer / SWIFT (Foreign)</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>UTR / Reference</label>
          <input name="utr_ref" className={inputCls} placeholder="Bank UTR reference" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Paying Bank Account</label>
        <input name="bank" className={inputCls} defaultValue="HDFC Bank — Claro Manufacturing Pvt. Ltd." />
      </div>
      <div>
        <label className={labelCls}>Payment Proof (optional)</label>
        <input name="proof" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-[#1e3e30] file:text-white file:px-3 file:py-1 file:text-xs file:font-bold cursor-pointer`} />
      </div>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Recording…" : "Record Payment"}
      </button>
    </form>
  );
}

export function CloseForm({ id, hasInvoice }: { id: string; hasInvoice: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(closeRequest, null);
  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Request closed successfully.</Alert>}
      <div>
        <label className={labelCls}>
          Final invoice / GRN {hasInvoice ? "(already uploaded — optional)" : "(required)"}
        </label>
        <input name="invoice" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-[#1e3e30] file:text-white file:px-3 file:py-1 file:text-xs file:font-bold cursor-pointer`} />
      </div>
      <label className="flex items-center gap-2 text-sm text-[#14261c] font-medium cursor-pointer">
        <input type="checkbox" name="goods_received" value="1" className="h-4 w-4 rounded border-[#dcd4c0] text-[#1e3e30]" />
        I confirm the goods / services have been physically received and inspected
      </label>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Closing…" : "Close Request"}
      </button>
    </form>
  );
}

export function ResubmitPanel({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitRequest, null);
  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Submitted for approval.</Alert>}
      <div>
        <label className={labelCls}>Attach Document (optional)</label>
        <div className="flex gap-2">
          <select name="kind" className={`${inputCls} w-44`}>
            <option value="quotation">Quotation</option>
            <option value="proforma">Proforma</option>
            <option value="invoice">Invoice</option>
            <option value="purchase_order">Purchase Order</option>
            <option value="other">Other</option>
          </select>
          <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-[#1e3e30] file:text-white file:px-3 file:py-1 file:text-xs file:font-bold cursor-pointer`} />
        </div>
      </div>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Submitting…" : "Submit for Approval"}
      </button>
    </form>
  );
}
