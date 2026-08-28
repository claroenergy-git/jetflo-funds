import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, REQUEST_COLS } from "@/lib/data";
import { Card, StatusChip, Alert } from "@/components/ui";
import { inr, fmtDate, fmtDateTime } from "@/lib/format";
import { CATEGORY_LABEL, STATUS_LABEL, type Status } from "@/lib/types";
import { DecisionPanel, PaymentForm, CloseForm } from "@/components/action-panels";
import { RequestForm } from "@/components/request-form";

const ACTION_LABEL: Record<string, string> = {
  created: "Request created",
  submitted: "Submitted for approval",
  sent_back: "Sent back for changes",
  awaiting_second_approval: "First approval — awaiting second approver",
  approved: "Approved",
  partially_approved: "Partially approved",
  rejected: "Rejected",
  payment_recorded: "Payment recorded",
  paid: "Fully paid",
  closed: "Closed",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await getSupabase();

  const { data } = await supabase.from("jetflo_fund_requests").select(REQUEST_COLS).eq("id", id).single();
  if (!data) notFound();
  const r = data as any;

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
  const editable = isOwner && (status === "draft" || status === "sent_back");

  let vendors: { id: string; name: string; category: string }[] = [];
  let heads: { id: string; category: string; sub_head: string }[] = [];
  if (editable) {
    const [v, h] = await Promise.all([
      supabase.from("jetflo_vendors").select("id, name, category").eq("active", true).order("name"),
      supabase.from("jetflo_budget_heads").select("id, category, sub_head").eq("active", true).order("sub_head"),
    ]);
    vendors = v.data ?? [];
    heads = h.data ?? [];
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">{r.request_no}</h1>
            <StatusChip status={status} />
            {r.duplicate_warning && (
              <span className="rounded-full bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                ⚠ Possible duplicate within 7 days
              </span>
            )}
          </div>
          <span className="text-xs text-[#8E9CA6] font-medium">
            Created: {fmtDate(r.created_at)}
          </span>
        </div>

        {/* Primary Information Bento Card */}
        <Card variant="default">
          <div className="mb-5 pb-4 border-b border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E9CA6]">Item Description</span>
            <div className="text-base font-bold text-white mt-1">{r.item_description}</div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            {[
              ["Category", CATEGORY_LABEL[r.category]],
              ["Sub-head", r.budget_head?.sub_head],
              ["Vendor", r.vendor?.name],
              ...(r.product_sku ? [["Product / SKU", r.product_sku]] : []),
              ...(r.qty ? [["Qty × Rate", `${r.qty} × ${inr(r.unit_rate)}`]] : []),
              ["Requested Amount", inr(r.amount_requested)],
              ["Approved Amount", inr(r.amount_approved)],
              ["Disbursed to Date", inr(r.amount_paid)],
              ...(Number(r.amount_approved) > 0 && balance > 0 && ["approved", "partially_approved", "paid"].includes(status)
                ? [["Outstanding Balance", inr(balance)]]
                : []),
              ["Urgency Level", r.urgency],
              ["Target Delivery Date", fmtDate(r.need_by_date)],
              ["Payment Mode", r.payment_type?.replace("_", " ")],
              ["Requested By", r.requester?.name],
              ...(r.approver ? [["1st Approver", r.approver.name]] : []),
              ...(r.second_approver ? [["2nd Approver", r.second_approver.name]] : []),
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-white/[0.03] p-3 border border-white/5">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[#8E9CA6]">{k}</dt>
                <dd className="mt-1 font-bold text-slate-100 capitalize">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>

          {r.justification && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-300">
              <span className="font-bold text-amber-400">Business Justification: </span>
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
          <h2 className="mb-3 text-sm font-bold text-white">Quotation & Supporting Documents</h2>
          {signed.length === 0 ? (
            <p className="text-xs text-[#8E9CA6] py-2">No attachments uploaded yet.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {signed.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
                      {a.kind.replace("_", " ")}
                    </span>
                    {a.url ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="font-bold text-amber-400 hover:text-amber-300 hover:underline">
                        {a.file_name} ↗
                      </a>
                    ) : (
                      <span className="text-slate-300">{a.file_name}</span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-[#8E9CA6]">{fmtDate(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Payments Bento Table */}
        {(payments?.length ?? 0) > 0 && (
          <div className="bento-card overflow-hidden">
            <div className="border-b border-white/10 bg-white/[0.02] px-6 py-4 font-bold text-sm text-white">
              Payment Tranches Recorded
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01] text-left text-xs font-bold uppercase tracking-wider text-[#8E9CA6]">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Amount Paid</th>
                    <th className="px-6 py-3">Mode</th>
                    <th className="px-6 py-3">Bank UTR / Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments!.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-3 text-xs text-[#8E9CA6] font-medium">{fmtDate(p.paid_on)}</td>
                      <td className="px-6 py-3 text-right font-bold tabular-nums text-emerald-300">{inr(p.amount_paid)}</td>
                      <td className="px-6 py-3 uppercase text-xs font-bold text-slate-300">{p.mode}</td>
                      <td className="px-6 py-3 font-mono text-xs text-[#8E9CA6]">{p.utr_ref ?? "—"}</td>
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
            <h2 className="mb-3 text-sm font-bold text-white">
              {status === "sent_back" ? "Revise & Resubmit Request" : "Edit Draft"}
            </h2>
            <RequestForm vendors={vendors} budgetHeads={heads} existing={r} />
          </Card>
        )}

        {/* Finance Decision Panel */}
        {isFinance && (status === "submitted" || status === "awaiting_second_approval") && (
          <Card variant="amber">
            <h2 className="mb-3 text-sm font-bold text-amber-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f5a623]" />
              Finance Sign-Off & Approval
            </h2>
            <DecisionPanel
              id={r.id}
              amountRequested={Number(r.amount_requested)}
              amountApproved={r.amount_approved ? Number(r.amount_approved) : null}
              status={status}
            />
          </Card>
        )}

        {/* Record Payment */}
        {isFinance && ["approved", "partially_approved"].includes(status) && balance > 0 && (
          <Card variant="emerald">
            <h2 className="mb-3 text-sm font-bold text-emerald-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              Record Bank Fund Transfer
            </h2>
            <PaymentForm id={r.id} balance={balance} />
          </Card>
        )}

        {/* Close Request */}
        {(isOwner || isFinance) && status === "paid" && (
          <Card variant="amber">
            <h2 className="mb-3 text-sm font-bold text-amber-300">Complete Advance Closure</h2>
            <CloseForm id={r.id} hasInvoice={(attachments ?? []).some((a) => ["invoice", "grn"].includes(a.kind))} />
          </Card>
        )}
      </div>

      {/* Right Column: Immutable Audit Timeline */}
      <div>
        <Card className="sticky top-20">
          <h2 className="mb-4 text-sm font-bold text-white flex items-center gap-2">
            <span className="text-amber-400">🛡️</span>
            <span>Audit Trail Timeline</span>
          </h2>
          <ol className="relative space-y-4 border-l border-white/10 pl-4">
            {(audit ?? []).map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#090C10] bg-amber-400 shadow-[0_0_8px_#f5a623]" />
                <div className="text-xs font-bold text-white">
                  {ACTION_LABEL[e.action] ?? STATUS_LABEL[e.action as Status] ?? e.action}
                </div>
                {e.remarks && <div className="text-xs text-[#8E9CA6] mt-0.5">{e.remarks}</div>}
                <div className="text-[10px] text-[#5F6E77] mt-0.5">
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
