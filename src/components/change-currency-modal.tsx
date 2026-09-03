"use client";

import { useState, useActionState, useEffect } from "react";
import { updateTicketCurrency, type ActionResult } from "@/app/actions";
import { inputCls, labelCls, btnPrimary, Alert } from "@/components/ui";
import { fmtMoney, currencySymbol } from "@/lib/format";

export function ChangeCurrencyModal({
  requestId,
  requestNo,
  currentCurrency = "INR",
  currentAmount,
  disabled = false,
}: {
  requestId: string;
  requestNo: string;
  currentCurrency?: string;
  currentAmount: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState<"INR" | "USD">(
    (currentCurrency || "INR").toUpperCase() === "USD" ? "INR" : "USD"
  );
  const [amount, setAmount] = useState<string>(String(currentAmount || ""));
  const [remarks, setRemarks] = useState<string>("");

  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateTicketCurrency,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      setRemarks("");
    }
  }, [state]);

  const currSym = currencySymbol(currentCurrency);
  const targetSym = targetCurrency === "USD" ? "$" : "₹";

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setTargetCurrency(currentCurrency.toUpperCase() === "USD" ? "INR" : "USD");
          setAmount(String(currentAmount || ""));
          setRemarks("");
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f0ebd9] text-[#1e3e30] border border-[#dcd4c0] hover:bg-[#e4ddc8] hover:border-[#1e3e30] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
        title="Formally change transaction currency for this ticket"
      >
        <span>💱</span>
        <span>Change Currency ({currentCurrency.toUpperCase() === "USD" ? "Switch to ₹" : "Switch to $ USD"})</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[#cbe1d3] bg-[#fbf9f4] p-6 shadow-2xl space-y-4 text-left">
            <div className="border-b border-[#e5decb] pb-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#eaf3ed] text-[#1e3e30] border border-[#cce3d4]">
                  Formal Amendment
                </span>
                <span className="font-mono text-xs font-bold text-[#536658]">{requestNo}</span>
              </div>
              <h2 className="text-base font-bold text-[#14261c] mt-1.5">
                Amend Transaction Currency
              </h2>
              <p className="text-xs text-[#536658] mt-0.5">
                Change this ticket's transaction currency between <b>INR (₹)</b> and <b>USD ($)</b>. This formal amendment will be recorded in the audit trail and flagged on the Accounts dashboard.
              </p>
            </div>

            {state?.error && <Alert kind="error">{state.error}</Alert>}

            <form action={action} className="space-y-4">
              <input type="hidden" name="id" value={requestId} />

              {/* Current state badge */}
              <div className="rounded-xl border border-[#e5decb] bg-white p-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">
                    Current Recorded Currency
                  </div>
                  <div className="text-sm font-bold text-[#14261c] mt-0.5 flex items-center gap-1.5">
                    <span>{currentCurrency.toUpperCase()} ({currSym})</span>
                    <span className="text-xs font-normal text-[#536658]">
                      · {fmtMoney(currentAmount, currentCurrency)}
                    </span>
                  </div>
                </div>
                <div className="text-xl">➔</div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1]">
                    Amending To
                  </div>
                  <div className="text-sm font-black text-[#0369a1] mt-0.5">
                    {targetCurrency} ({targetSym})
                  </div>
                </div>
              </div>

              {/* Target Currency Selection */}
              <div>
                <label className={labelCls}>
                  Target Currency <span className="text-red-600 font-bold">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setTargetCurrency("INR")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      targetCurrency === "INR"
                        ? "bg-[#1e3e30] text-white border-[#1e3e30] shadow-sm"
                        : "bg-white text-[#415546] border-[#dcd4c0] hover:bg-[#f4f9f5]"
                    }`}
                  >
                    <span>₹</span>
                    <span>INR — Domestic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetCurrency("USD")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      targetCurrency === "USD"
                        ? "bg-[#0369a1] text-white border-[#0369a1] shadow-sm"
                        : "bg-white text-[#415546] border-[#dcd4c0] hover:bg-[#f0f9ff]"
                    }`}
                  >
                    <span>🌐 $</span>
                    <span>USD — Foreign</span>
                  </button>
                </div>
                <input type="hidden" name="currency" value={targetCurrency} />
              </div>

              {/* Amount in Target Currency */}
              <div>
                <label className={labelCls}>
                  Requested Amount in {targetCurrency} ({targetSym}){" "}
                  <span className="text-red-600 font-bold">*</span>
                </label>
                <input
                  name="amount_requested"
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Amount in ${targetSym}`}
                  className={`${inputCls} font-bold text-[#14261c] text-base bg-white`}
                />
                <p className="mt-1 text-[11px] text-[#536658]">
                  Adjust the numeric value if converting (e.g. enter equivalent {targetCurrency} figure from supplier invoice / proforma).
                </p>
              </div>

              {/* Mandatory Formal Justification */}
              <div>
                <label className={labelCls}>
                  Formal Operational Justification <span className="text-red-600 font-bold">*</span>
                </label>
                <textarea
                  name="remarks"
                  rows={2}
                  required
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Supplier invoice received in USD; payment requested via international wire transfer / foreign remittance."
                  className={`${inputCls} bg-white`}
                />
              </div>

              {/* Formal Warning Notice */}
              <div className="rounded-xl border border-[#fed7aa] bg-[#fffbeb] p-3 text-xs text-[#92400e]">
                <div className="font-bold flex items-center gap-1.5">
                  <span>🛡️</span>
                  <span>Accounts Notification & Governance Audit</span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#92400e]/90 leading-relaxed">
                  This action does not reset or revoke your request. It updates the transaction currency, displays an official amendment memorandum on the ticket, and alerts Claro Accounts on their dashboard and clearance queue.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e5decb]">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#dcd4c0] bg-white text-xs font-bold text-[#536658] hover:bg-[#f5f0e1] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !remarks.trim()}
                  className={`${btnPrimary} bg-[#0369a1] hover:bg-[#0284c7] border-[#0284c7] disabled:opacity-50`}
                >
                  {pending ? "Applying Amendment…" : "Confirm Currency Amendment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
