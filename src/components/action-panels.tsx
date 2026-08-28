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
import { inr } from "@/lib/format";

export function DecisionPanel({
  id,
  amountRequested,
  status,
  amountApproved,
}: {
  id: string;
  amountRequested: number;
  status: string;
  amountApproved: number | null;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(financeDecide, null);
  const second = status === "awaiting_second_approval";

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.warning && <Alert kind="warning">{state.warning}</Alert>}
      {second ? (
        <Alert kind="warning">
          First approval done for {inr(amountApproved)}. You are acting as the <b>second approver</b>.
        </Alert>
      ) : (
        <div>
          <label className={labelCls}>Approved amount (₹) — lower it for a partial approval</label>
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
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="approve" disabled={pending} className={btnPrimary}>
          Approve
        </button>
        {!second && (
          <button name="decision" value="partial" disabled={pending} className={btnSecondary}>
            Partial approve
          </button>
        )}
        <button
          name="decision"
          value="send_back"
          disabled={pending}
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
        >
          Send back
        </button>
        <button
          name="decision"
          value="reject"
          disabled={pending}
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </form>
  );
}

export function PaymentForm({ id, balance }: { id: string; balance: number }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(recordPayment, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.warning && <Alert kind="warning">{state.warning}</Alert>}
      {state?.ok && <Alert kind="success">Payment recorded.</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Amount (₹) — balance {inr(balance)}</label>
          <input name="amount_paid" type="number" step="any" min="1" max={balance} defaultValue={balance} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Paid on</label>
          <input name="paid_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Mode</label>
          <select name="mode" className={inputCls}>
            <option value="neft">NEFT</option>
            <option value="rtgs">RTGS</option>
            <option value="imps">IMPS</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>UTR / reference</label>
          <input name="utr_ref" className={inputCls} placeholder="UTR number" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Paying bank</label>
        <input name="bank" className={inputCls} defaultValue="HDFC Bank — Claro Energy Ltd" />
      </div>
      <div>
        <label className={labelCls}>Payment proof (optional)</label>
        <input name="proof" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={inputCls} />
      </div>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}

export function CloseForm({ id, hasInvoice }: { id: string; hasInvoice: boolean }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(closeRequest, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Request closed.</Alert>}
      <div>
        <label className={labelCls}>
          Final invoice / GRN {hasInvoice ? "(already uploaded — optional)" : "(required)"}
        </label>
        <input name="invoice" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={inputCls} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="goods_received" value="1" className="h-4 w-4" />
        I confirm the goods / services have been received
      </label>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Closing…" : "Close request"}
      </button>
    </form>
  );
}

export function ResubmitPanel({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(submitRequest, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && <Alert kind="success">Submitted for approval.</Alert>}
      <div>
        <label className={labelCls}>Attach document (optional)</label>
        <div className="flex gap-2">
          <select name="kind" className={`${inputCls} w-40`}>
            <option value="quotation">Quotation</option>
            <option value="proforma">Proforma</option>
            <option value="other">Other</option>
          </select>
          <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className={inputCls} />
        </div>
      </div>
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Submitting…" : "Submit for approval"}
      </button>
    </form>
  );
}
