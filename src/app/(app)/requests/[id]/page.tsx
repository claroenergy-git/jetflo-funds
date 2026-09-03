import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, REQUEST_COLS, REQUEST_COLS_WITH_CURRENCY } from "@/lib/data";
import { Card, StatusChip, Alert } from "@/components/ui";
import { inr, fmtMoney, fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY_LABEL, STATUS_LABEL, type Status } from "@/lib/types";
import { DecisionPanel, PaymentForm, CloseForm } from "@/components/action-panels";
import { RequestForm } from "@/components/request-form";
import { ChangeCurrencyModal } from "@/components/change-currency-modal";

const ACTION_LABEL: Record<string, string> = {
  created: "Request created",
  submitted: "Submitted for approval",
  sent_back: "Sent back for changes",
  awaiting_second_approval: "First approval — awaiting second approver",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
  paid: "Payment recorded",
  closed: "Closed",
  currency_amended: "Currency & Amount Formally Amended",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const resWithCurrency = await supabase.from("jetflo_fund_requests").select(REQUEST_COLS_WITH_CURRENCY).eq("id", id).single();
  let r: any = resWithCurrency.data;
  if (resWithCurrency.error) {
    const fallbackRes = await supabase.from("jetflo_fund_requests").select(REQUEST_COLS).eq("id", id).single();
    r = fallbackRes.data;
  }
  if (!r) notFound();

  const [{ data: attachments }, { data: payments }, { data: audit }, { data: users }] = await Promise.all([
    supabase.from("jetflo_attachments").select("*").eq("request_id", id).order("created_at"),
    supabase.from("jetflo_payments").select("*").eq("request_id", id).order("paid_on"),
    supabase.from("jetflo_audit_log").select("*").eq("request_id", id).order("created_at"),
    supabase.from("jetflo_users").select("id, name"),
  ]);
  const userName = (uid: string | null) => users?.find((u) => u.id === uid)?.name ?? "System";

  const signed = await Promise.all(
    (attachments ?? []).map(async (a) => {
      const { data } = await supabase.storage.from("jetflo-docs").createSignedUrl(a.storage_path, 3600);
      return { ...a, url: data?.signedUrl ?? null };
    })
  );

  const status = r.status as Status;
  const balance = Number(r.amount_approved ?? 0) - Number(r.amount_paid ?? 0);
  const isOwner = profile.role === "requester" && r.requester?.id === profile.id;
  const isFinance = profile.role === "finance";
  const isLeadership = profile.role === "leadership";
  const editable = isOwner && (status === "draft" || status === "sent_back");

  let vendors: { id: string; name: string }[] = [];
  let heads: { id: string; category: string; sub_head: string }[] = [];
  let priorRequests: any[] = [];
  if (editable) {
    let vRes: any = await supabase.from("jetflo_vendors").select("id, name, is_foreign, country").eq("active", true).order("name");
    if (vRes.error) {
      vRes = await supabase.from("jetflo_vendors").select("id, name").eq("active", true).order("name");
    }
    const [h, pr] = await Promise.all([
      supabase.from("jetflo_budget_heads").select("id, category, sub_head").eq("active", true).order("sub_head"),
      supabase.from("jetflo_fund_requests").select("id, request_no, vendor_id, amount_approved, amount_requested, item_description, status").not("status", "in", "(draft,rejected)").order("created_at", { ascending: false }),
    ]);
    vendors = vRes.data ?? [];
    heads = h.data ?? [];
    priorRequests = pr.data ?? [];
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#14261c]">{r.request_no}</h1>
            <StatusChip status={status} />
            {r.duplicate_warning && (
              <span className="rounded-full bg-[#fef3c7] px-3 py-0.5 text-xs font-bold text-[#92400e] border border-[#fde68a]">
                ⚠ Possible duplicate within 7 days
              </span>
            )}
          </div>
          <span className="text-xs text-[#536658] font-semibold">
            Created: {fmtDate(r.created_at)}
          </span>
        </div>

        {/* Formal Currency Amendment Notice Banner */}
        {r.currency_amended && (
          <div className="rounded-2xl border-2 border-[#bae6fd] bg-gradient-to-r from-[#f0f9ff] via-[#e0f2fe] to-[#f0f9ff] p-4.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#bae6fd] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0369a1] text-white text-xs font-bold shadow-xs">
                  💱
                </span>
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0369a1]">
                    Formal Currency Amendment Notice
                  </span>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#0369a1] text-white">
                    Official Record
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#0369a1]">
                Amended: {fmtDateTime(r.currency_amended_at)}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-xl bg-white/90 p-2.5 border border-[#bae6fd]/60 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Original Recorded Value</div>
                <div className="font-bold text-[#14261c] mt-0.5 line-through decoration-red-500">
                  {fmtMoney(r.previous_amount || r.amount_requested, r.previous_currency || "INR")} ({r.previous_currency || "INR"})
                </div>
              </div>

              <div className="rounded-xl bg-white/90 p-2.5 border border-[#bae6fd]/60 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#0369a1]">Amended Value</div>
                <div className="font-black text-[#0369a1] mt-0.5">
                  {fmtMoney(r.amount_requested, r.currency)} ({r.currency || "USD"})
                </div>
              </div>

              <div className="rounded-xl bg-white/90 p-2.5 border border-[#bae6fd]/60 shadow-2xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">Authorized By</div>
                <div className="font-bold text-[#14261c] mt-0.5">
                  {userName(r.currency_amended_by)}
                </div>
              </div>
            </div>

            {r.currency_amendment_reason && (
              <div className="mt-2.5 text-xs text-[#0c4a6e] bg-white/95 p-2.5 rounded-xl border border-[#bae6fd]/60 font-medium">
                <b className="text-[#0369a1]">Operational Justification: </b>
                {r.currency_amendment_reason}
              </div>
            )}
          </div>
        )}

        {/* Primary Information Bento Card */}
        <Card variant="default">
          <div className="mb-5 pb-4 border-b border-[#e5decb] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#415546]">Item Description</span>
              <div className="text-base font-bold text-[#14261c] mt-0.5">{r.item_description}</div>
            </div>
            <div className="shrink-0">
              <ChangeCurrencyModal
                requestId={r.id}
                requestNo={r.request_no}
                currentCurrency={r.currency || "INR"}
                currentAmount={Number(r.amount_requested)}
              />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            {[
              ["Category", CATEGORY_LABEL[r.category]],
              ["Sub-head", r.budget_head?.sub_head],
              ["Vendor", r.vendor?.name + (r.vendor?.is_foreign ? " 🌐 (Foreign)" : "")],
              ...(r.product_sku ? [["Product / SKU", r.product_sku]] : []),
              ["Transaction Currency", (r.currency || "INR").toUpperCase() === "USD" ? "USD ($) — Foreign Transaction" : "INR (₹) — Domestic (India)"],
              ...(r.qty ? [["Qty × Rate", `${r.qty} × ${fmtMoney(r.unit_rate, r.currency)}`]] : []),
              ...(r.tax_percent ? [["Tax Rate", `${r.tax_percent}%`]] : []),
              ...(r.tax_amount ? [["Tax Amount", fmtMoney(r.tax_amount, r.currency)]] : []),
              ...(r.round_off ? [["Round Off", `${Number(r.round_off) > 0 ? "+" : ""}${fmtMoney(r.round_off, r.currency)}`]] : []),
              ["Requested Amount", fmtMoney(r.amount_requested, r.currency)],
              ["Approved Amount", fmtMoney(r.amount_approved, r.currency)],
              ["Disbursed to Date", fmtMoney(r.amount_paid, r.currency)],
              ...(Number(r.amount_approved) > 0 && balance > 0 && ["approved", "partially_approved", "paid"].includes(status)
                ? [["Outstanding Balance", fmtMoney(balance, r.currency)]]
                : []),
              ["Payment Type", r.payment_type === "advance" ? "Advance (against Quotation/Proforma)" : r.payment_type === "balance" ? "Balance Payment" : "Against Invoice"],
              ["Requested By", r.requester?.name],
              ...(r.approver ? [["1st Approver", r.approver.name]] : []),
              ...(r.second_approver ? [["2nd Approver", r.second_approver.name]] : []),
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">{k}</dt>
                <dd className="mt-1 font-bold text-[#14261c]">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>

          {r.justification && (
            <div className="mt-5 rounded-xl border border-[#e2dbcc] bg-[#fbf9f4] p-4 text-xs text-[#14261c]">
              <span className="font-bold text-[#1e3e30]">Operational Remarks: </span>
              {r.justification}
            </div>
          )}
        </Card>

        {status === "rejected" && (
          <Alert kind="error">
            <b>Rejection Reason:</b> {r.rejection_reason ?? "No reason recorded"}
          </Alert>
        )}
        {status === "sent_back" && (
          <Alert kind="warning">
            <b>Sent Back for Revision:</b> {r.approval_remarks ?? "Please check feedback and resubmit"}
          </Alert>
        )}

        {/* Attachments Bento Card */}
        <Card variant="default">
          <h2 className="mb-3 text-sm font-bold text-[#14261c]">Quotation & Supporting Documents</h2>
          {signed.length === 0 ? (
            <p className="text-xs text-[#536658] py-2">No attachments uploaded yet.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {signed.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e5decb] bg-[#fbf9f4] p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-full bg-[#eaf3ed] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1e3e30] border border-[#cce3d4]">
                      {a.kind.replace("_", " ")}
                    </span>
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="font-bold text-[#1e3e30] hover:underline">
                        {a.file_name} ↗
                      </a>
                    ) : (
                      <span className="text-[#14261c] font-medium">{a.file_name}</span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-[#7a8d80]">{fmtDate(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Payments Bento Table */}
        {(payments?.length ?? 0) > 0 && (
          <div className="bento-card overflow-hidden">
            <div className="border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4 font-bold text-sm text-[#14261c]">
              Payment Tranches Recorded
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Amount Paid</th>
                    <th className="px-6 py-3">Mode</th>
                    <th className="px-6 py-3">Bank UTR / Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5decb]">
                  {payments!.map((p) => (
                    <tr key={p.id} className="hover:bg-[#fbf9f4]">
                      <td className="px-6 py-3 text-xs text-[#536658] font-semibold">{fmtDate(p.paid_on)}</td>
                      <td className="px-6 py-3 text-right font-bold tabular-nums text-[#166534]">{fmtMoney(p.amount_paid, r.currency)}</td>
                      <td className="px-6 py-3 uppercase text-xs font-bold text-[#14261c]">{p.mode}</td>
                      <td className="px-6 py-3 font-mono text-xs text-[#536658] font-medium">{p.utr_ref ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit while draft / sent back */}
        {editable && (
          <Card>
            <h2 className="mb-3 text-sm font-bold text-[#14261c]">
              {status === "sent_back" ? "Revise & Resubmit Request" : "Edit Draft"}
            </h2>
            <RequestForm
              vendors={vendors}
              budgetHeads={heads}
              priorRequests={priorRequests}
              existing={r}
            />
          </Card>
        )}

        {/* Accounts / Finance Decision Panel for submitted requests */}
        {isFinance && status === "submitted" && (
          <Card variant="amber">
            <h2 className="mb-3 text-sm font-bold text-[#92400e] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#d97706]" />
              Accounts Team Sign-Off & Verification
            </h2>
            <DecisionPanel
              id={r.id}
              amountRequested={Number(r.amount_requested)}
              amountApproved={r.amount_approved ? Number(r.amount_approved) : null}
              status={status}
              currency={r.currency || "INR"}
            />
          </Card>
        )}

        {/* Leadership Sign-Off Panel (Gaurav) for High-Priority Requests */}
        {(isLeadership || isFinance) && status === "awaiting_second_approval" && (
          <Card variant="amber" className="border-2 border-[#f59e0b] shadow-md">
            <div className="mb-4 pb-3 border-b border-[#fde68a] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#92400e] flex items-center gap-2">
                  <span className="text-base">👑</span>
                  High-Priority Leadership Sign-Off (Gaurav)
                </h2>
                <p className="text-xs text-[#92400e] mt-0.5 font-medium">
                  First approval by Accounts completed ({fmtMoney(r.amount_approved, r.currency)}). Leadership authorization required.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                High Priority
              </span>
            </div>
            <DecisionPanel
              id={r.id}
              amountRequested={Number(r.amount_requested)}
              amountApproved={r.amount_approved ? Number(r.amount_approved) : null}
              status={status}
              currency={r.currency || "INR"}
            />
          </Card>
        )}

        {/* Record Payment */}
        {isFinance && ["approved", "partially_approved"].includes(status) && balance > 0 && (
          <Card variant="emerald">
            <h2 className="mb-3 text-sm font-bold text-[#166534] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#166534]" />
              Record Bank Fund Transfer
            </h2>
            <PaymentForm id={r.id} balance={balance} currency={r.currency || "INR"} />
          </Card>
        )}

        {/* Close Request */}
        {(isOwner || isFinance) && status === "paid" && (
          <Card variant="amber">
            <h2 className="mb-3 text-sm font-bold text-[#92400e]">Complete Advance Closure</h2>
            <CloseForm id={r.id} hasInvoice={(attachments ?? []).some((a) => ["invoice", "grn"].includes(a.kind))} />
          </Card>
        )}
      </div>

      {/* Right Column: Immutable Audit Timeline */}
      <div>
        <Card className="sticky top-20">
          <h2 className="mb-4 text-sm font-bold text-[#14261c] flex items-center gap-2">
            <span className="text-[#1e3e30]">🛡️</span>
            <span>Audit Trail Timeline</span>
          </h2>
          <ol className="relative space-y-4 border-l border-[#e5decb] pl-4">
            {(audit ?? []).map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1e3e30]" />
                <div className="text-xs font-bold text-[#14261c]">
                  {ACTION_LABEL[e.action] ?? STATUS_LABEL[e.action as Status] ?? e.action}
                </div>
                {e.remarks && <div className="text-xs text-[#536658] mt-0.5 font-medium">{e.remarks}</div>}
                <div className="text-[10px] text-[#7a8d80] font-semibold mt-0.5">
                  {userName(e.actor_id)} · {fmtDateTime(e.created_at)}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
