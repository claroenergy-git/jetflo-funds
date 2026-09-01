"use client";

import { useActionState, useState } from "react";
import { updateGovernanceSettings, type ActionResult } from "@/app/actions";
import { inputCls, labelCls, btnPrimary, Alert } from "@/components/ui";
import { inr } from "@/lib/format";

export function GovernanceSettingsForm({
  secondApproverAbove,
  quotationMandatoryAbove,
  duplicateWindowDays,
}: {
  secondApproverAbove: number;
  quotationMandatoryAbove: number;
  duplicateWindowDays: number;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    updateGovernanceSettings,
    null
  );

  const [threshold, setThreshold] = useState<number>(secondApproverAbove);
  const [quoteThreshold, setQuoteThreshold] = useState<number>(quotationMandatoryAbove);
  const [dupDays, setDupDays] = useState<number>(duplicateWindowDays);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && (
        <Alert kind="success">
          <b>Governance Thresholds Updated Successfully:</b> New limits are now active across all future requests and approval workflows.
        </Alert>
      )}

      {/* Primary Threshold: 2nd Approval Limit */}
      <div className="rounded-2xl border border-[#d8e8dc] bg-[#f4f9f5] p-5 relative overflow-hidden shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <label className={`${labelCls} text-[#1e3e30] font-bold flex items-center gap-2`}>
              <span className="h-2 w-2 rounded-full bg-[#1e3e30]" />
              Dual-Approval Threshold (2nd Approver Required Above)
            </label>
            <p className="text-xs text-[#536658]">
              Any fund request approved above this amount will automatically require a <b>second finance approver</b> before funds can be disbursed.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#536658] uppercase font-bold">Active Cap</span>
            <div className="text-xl font-extrabold text-[#166534] tabular-nums">
              {inr(threshold, { compact: false })}
            </div>
          </div>
        </div>

        <div className="relative mt-2">
          <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#1e3e30]">₹</span>
          <input
            type="number"
            name="second_approver_above"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            required
            min={0}
            step={10000}
            className={`${inputCls} pl-8 font-mono text-base font-bold text-[#14261c]`}
          />
        </div>

        {/* Quick select presets */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#536658] font-bold">Quick Presets:</span>
          {[200000, 300000, 500000, 750000, 1000000, 1500000, 2000000].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setThreshold(val)}
              className={`rounded-lg px-2.5 py-1 font-bold transition cursor-pointer ${
                threshold === val
                  ? "bg-[#1e3e30] text-white shadow-2xs"
                  : "bg-white text-[#536658] hover:bg-[#f0ebd9] hover:text-[#14261c] border border-[#dcd4c0]"
              }`}
            >
              {inr(val, { compact: true })}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary Controls: Quotation & Duplicate Detection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#e5decb] bg-white p-5 shadow-xs">
          <label className={labelCls}>Mandatory Quotation Attachment Threshold</label>
          <p className="text-xs text-[#536658] mb-3">
            Requests exceeding this amount must include a quotation/proforma invoice.
          </p>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#166534]">₹</span>
            <input
              type="number"
              name="quotation_mandatory_above"
              value={quoteThreshold}
              onChange={(e) => setQuoteThreshold(Number(e.target.value))}
              min={0}
              step={5000}
              className={`${inputCls} pl-8 font-mono text-sm font-bold text-[#14261c]`}
            />
          </div>
          <div className="mt-2 text-xs text-[#536658]">
            Preview: <span className="text-[#166534] font-bold">{inr(quoteThreshold)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5decb] bg-white p-5 shadow-xs">
          <label className={labelCls}>Duplicate Request Warning Window</label>
          <p className="text-xs text-[#536658] mb-3">
            Flags warnings if same vendor/sub-head request is raised within N days.
          </p>
          <div className="relative">
            <input
              type="number"
              name="duplicate_window_days"
              value={dupDays}
              onChange={(e) => setDupDays(Number(e.target.value))}
              min={1}
              max={90}
              className={`${inputCls} font-mono text-sm font-bold text-[#14261c]`}
            />
            <span className="absolute right-3.5 top-2.5 text-xs text-[#536658] font-bold">Days</span>
          </div>
          <div className="mt-2 text-xs text-[#536658]">
            Lookback: <span className="text-[#14261c] font-bold">{dupDays} days history</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className={`${btnPrimary} px-6 py-3 font-bold`}
        >
          {isPending ? "Saving Governance Changes..." : "Save Governance Settings"}
        </button>
      </div>
    </form>
  );
}
