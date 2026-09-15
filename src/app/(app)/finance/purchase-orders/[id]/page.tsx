import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, PO_COLS, PO_COLS_LEGACY } from "@/lib/data";
import { Card, PageTitle, PoStatusChip, StatusChip } from "@/components/ui";
import { fmtMoney, fmtDate, fmtDateTime, daysSince } from "@/lib/format";
import {
  CATEGORY_LABEL,
  PAYMENT_TERMS_LABEL,
  RECEIVE_STATUS_LABEL,
  RECEIVE_STATUS_STYLE,
  formatPaymentTerms,
  type Status,
  type PoStatus,
  type ReceiveStatus,
  type PaymentTerms,
} from "@/lib/types";
import { PoLineItemsEditor } from "@/components/po-line-items-editor";
import {
  PoDraftHeaderForm,
  IssuePoPanel,
  ApprovePoSecondApprovalPanel,
  CancelPoPanel,
  AmendPoPanel,
  LogGoodsReceiptPanel,
} from "@/components/po-actions";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function PurchaseOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const isFinance = profile.role === "finance";
  const supabase = await getSupabase();

  let poRes = await supabase.from("jetflo_purchase_orders").select(PO_COLS).eq("id", id).single();
  if (poRes.error) {
    poRes = await supabase.from("jetflo_purchase_orders").select(PO_COLS_LEGACY).eq("id", id).single();
  }
  if (!poRes.data) notFound();
  const p = poRes.data as any;
  const status = p.status as PoStatus;
  const isDraft = status === "draft";
  const items = (p.items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  const [{ data: linkedRequests }, { data: audit }, { data: vendors }] = await Promise.all([
    supabase
      .from("jetflo_fund_requests")
      .select("id, request_no, item_description, amount_requested, amount_approved, amount_paid, status, currency, payment_type")
      .eq("po_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("jetflo_audit_log").select("*").eq("purchase_order_id", id).order("created_at"),
    isDraft ? supabase.from("jetflo_vendors").select("id, name").eq("active", true).order("name") : Promise.resolve({ data: [] }),
  ]);

  const receives: any[] = [];

  const committed = (linkedRequests ?? [])
    .filter((r) => ["awaiting_second_approval", "approved", "partially_approved", "paid", "closed"].includes(r.status))
    .reduce((s, r) => s + Number(r.amount_approved || 0), 0);
  const paid = (linkedRequests ?? []).reduce((s, r) => s + Number(r.amount_paid || 0), 0);
  const remaining = Number(p.total_value) - committed;

  const totalOrdered = items.reduce((s: number, i: any) => s + Number(i.qty || 0), 0);
  const totalReceived = items.reduce((s: number, i: any) => s + Number(i.qty_received || 0), 0);
  const isOverdue =
    p.expected_delivery_date &&
    new Date(p.expected_delivery_date).getTime() < new Date().setHours(0, 0, 0, 0) &&
    (totalReceived < totalOrdered || totalOrdered === 0);

  const receiveStatus: ReceiveStatus = (p.receive_status as ReceiveStatus) ?? (totalReceived >= totalOrdered && totalOrdered > 0 ? "received" : totalReceived > 0 ? "partially_received" : "pending");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageTitle title={p.po_number ?? "Draft Purchase Order"} sub={`${CATEGORY_LABEL[p.category]} · ${p.vendor?.name ?? ""}`} />
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`/api/purchase-orders/${p.id}/pdf`}
              download={`PO_${(p.po_number || "Draft-PO").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1e3e30] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[#2d5a44] transition cursor-pointer"
              title="Directly download official JetFlo Purchase Order PDF file"
            >
              <span>📥</span> Download PDF
            </a>
            <Link
              href={`/finance/purchase-orders/${p.id}/download`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d5cbba] bg-[#fbf9f4] px-3 py-1.5 text-xs font-bold text-[#1e3e30] hover:bg-[#efe9dc] transition"
              title="Preview Official Purchase Order Document"
            >
              <span>👁️</span> Preview
            </Link>
            {!isDraft && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold ${RECEIVE_STATUS_STYLE[receiveStatus]}`}>
                {RECEIVE_STATUS_LABEL[receiveStatus]}
              </span>
            )}
            <PoStatusChip status={status} />
          </div>
        </div>

        {/* Prominent Issue Banner for Drafts */}
        {isDraft && (
          <div className="rounded-2xl border-2 border-[#166534] bg-gradient-to-r from-[#f0fdf4] to-[#eaf7ee] p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚀</span>
                  <h2 className="text-base font-extrabold text-[#166534]">Draft Purchase Order: Ready to Issue</h2>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#dcfce7] text-[#166534] border border-[#bbf7d0]">
                    Action Required
                  </span>
                </div>
                <p className="text-xs text-[#536658] mt-1 max-w-xl font-medium">
                  Review and edit the line items below. Clicking <strong>Issue Purchase Order</strong> assigns the official sequential PO number, locks the order, and enables official PDF downloading and billing.
                </p>
              </div>
              <div className="shrink-0">
                {isFinance ? (
                  <IssuePoPanel id={p.id} totalValue={Number(p.total_value)} currency={p.currency} />
                ) : (
                  <span className="text-xs text-[#92400e] font-semibold bg-[#fef3c7] px-3 py-2 rounded-xl border border-[#fde68a]">
                    Accounts (Finance) role required to issue
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PO Timeline & Aging Lifecycle Tracker */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#14261c] flex items-center gap-2">
              <span className="text-[#1e3e30]">⏱️</span>
              <span>PO Timeline & Aging Lifecycle</span>
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-[#1e3e30] bg-[#eaf3ed] px-3 py-1 rounded-full border border-[#cce3d4]">
                Current Age: {daysSince(p.created_at)} day{daysSince(p.created_at) === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#fbf9f4] border border-[#e5decb]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">1. Draft Created</div>
              <div className="font-extrabold text-xs text-[#14261c] mt-1">{fmtDate(p.created_at)}</div>
              <div className="text-[11px] text-[#7a8d80] mt-0.5">By {p.created_by_user?.name || "Accounts Team"}</div>
              <div className="text-[10px] font-bold text-[#166534] mt-1 flex items-center gap-1">
                <span>✓</span> Completed ({daysSince(p.created_at)}d ago)
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border ${p.issued_at ? "bg-[#f0fdf4] border-[#bbf7d0]" : "bg-[#fffbeb] border-[#fde68a]"}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">2. PO Issuance</div>
              <div className="font-extrabold text-xs text-[#14261c] mt-1">
                {p.issued_at ? fmtDate(p.issued_at) : "Pending Issuance"}
              </div>
              <div className="text-[11px] text-[#7a8d80] mt-0.5">
                {p.issued_at ? (p.po_number || "Numbered") : "Click Issue to finalize"}
              </div>
              <div className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${p.issued_at ? "text-[#166534]" : "text-[#d97706]"}`}>
                {p.issued_at ? "✓ Issued" : "⏳ Action Needed"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#fbf9f4] border border-[#e5decb]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">3. Delivery Schedule</div>
              <div className="font-extrabold text-xs text-[#14261c] mt-1">
                {p.expected_delivery_date ? fmtDate(p.expected_delivery_date) : "Not Specified"}
              </div>
              <div className="text-[11px] text-[#7a8d80] mt-0.5">
                {p.destination_plant || "Hyderabad Plant"}
              </div>
              <div className="text-[10px] font-bold mt-1">
                {isOverdue ? (
                  <span className="text-[#991b1b]">⚠️ Delivery Overdue</span>
                ) : p.expected_delivery_date ? (
                  <span className="text-[#166534]">📅 On Schedule</span>
                ) : (
                  <span className="text-[#7a8d80]">Editable in draft</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#fbf9f4] border border-[#e5decb]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">4. Billed vs Remaining</div>
              <div className="font-extrabold text-xs text-[#166534] mt-1">
                {fmtMoney(remaining, p.currency)}
              </div>
              <div className="text-[11px] text-[#7a8d80] mt-0.5">
                Balance of {fmtMoney(p.total_value, p.currency)}
              </div>
              <div className="text-[10px] font-bold text-[#536658] mt-1">
                {committed > 0 ? `${fmtMoney(committed, p.currency)} committed` : "No requests linked yet"}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            {[
              ["Vendor", p.vendor?.name],
              ["Vendor GSTIN & PAN", `${p.vendor?.gstin || "—"} · ${p.vendor?.pan || "—"}`],
              ["Vendor Contact", `${p.vendor?.contact_person || "—"} (${p.vendor?.phone || p.vendor?.email || "—"})`],
              ["Budget head", p.budget_head?.sub_head],
              ["Destination Plant", p.destination_plant ?? "Hyderabad Plant"],
              ["Currency", p.currency],
              ["Total value", fmtMoney(p.total_value, p.currency)],
              ["Billed (approved)", fmtMoney(committed, p.currency)],
              ["Paid to date", fmtMoney(paid, p.currency)],
              ...(!isDraft ? [["Remaining balance", fmtMoney(remaining, p.currency)]] : []),
              [
                "Delivery Due Date",
                <div key="deliv-due" className="flex items-center gap-1.5 flex-wrap">
                  <span>{p.expected_delivery_date ? fmtDate(p.expected_delivery_date) : "—"}</span>
                  {isOverdue && (
                    <span className="text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] px-2 py-0.5 rounded-full border border-[#fecaca]">
                      ⚠️ Overdue
                    </span>
                  )}
                </div>,
              ],
              ["Payment Terms", formatPaymentTerms(p.payment_terms)],
              ["Vendor Quote / Ref #", p.reference_no ?? "—"],
              ...(!isDraft
                ? [
                    [
                      "Physical GRN",
                      <div key="grn-stat" className="flex items-center gap-1.5 font-bold">
                        <span>
                          {totalReceived} / {totalOrdered} items
                        </span>
                        <span className="text-xs text-[#536658]">({totalOrdered ? Math.round((totalReceived / totalOrdered) * 100) : 0}%)</span>
                      </div>,
                    ],
                  ]
                : []),
              ["Created by", p.created_by_user?.name],
              ...(p.approved_by_user ? [["2nd approver", p.approved_by_user.name]] : []),
              ...(p.issued_at ? [["Issued", fmtDate(p.issued_at)]] : []),
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl bg-[#fbf9f4] p-3 border border-[#e5decb]">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-[#536658]">{k}</dt>
                <dd className="mt-1 font-bold text-[#14261c]">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {p.notes && (
            <div className="mt-4 rounded-xl border border-[#e2dbcc] bg-[#fbf9f4] p-4 text-xs text-[#14261c]">
              <span className="font-bold text-[#1e3e30]">Notes: </span>
              {p.notes}
            </div>
          )}
        </Card>

        {isDraft && isFinance && (
          <Card variant="amber">
            <h2 className="mb-3 text-sm font-bold text-[#92400e]">Edit Draft</h2>
            <PoDraftHeaderForm
              id={p.id}
              vendors={vendors ?? []}
              vendorId={p.vendor?.id}
              budgetHeadId={p.budget_head?.id}
              currency={p.currency}
              notes={p.notes}
              orderDate={p.order_date}
              expectedDeliveryDate={p.expected_delivery_date}
              destinationPlant={p.destination_plant}
              referenceNo={p.reference_no}
              paymentTerms={p.payment_terms}
              transporterName={p.transporter_name}
              lrNo={p.lr_no}
            />
          </Card>
        )}

        {/* 3-Way Match Action Bar: GRN Recording & Raise Fund Request */}
        {!isDraft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card variant="emerald">
              <div className="flex flex-col justify-between h-full space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-[#166534] flex items-center gap-1.5">
                    <span>📦</span> Goods Receipt (Plant Ground Team)
                  </h3>
                  <p className="text-xs text-[#536658] mt-1">
                    Record delivered quantities when physical shipments arrive with a Delivery Challan.
                  </p>
                </div>
                <div>
                  <LogGoodsReceiptPanel purchaseOrderId={p.id} items={items} />
                </div>
              </div>
            </Card>

            <Card variant="amber">
              <div className="flex flex-col justify-between h-full space-y-3">
                <div>
                  <h3 className="font-bold text-sm text-[#92400e] flex items-center gap-1.5">
                    <span>📄</span> Financial Billing (Fund Request)
                  </h3>
                  <p className="text-xs text-[#536658] mt-1">
                    Raise an advance or invoice disbursement request against this PO.
                  </p>
                </div>
                <div>
                  <Link
                    href={`/requests/new?po_id=${p.id}`}
                    className="inline-flex items-center justify-center rounded-xl bg-[#1e3e30] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-[#2d5a44] transition"
                  >
                    + Raise Fund Request from this PO
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-[#14261c]">Line Items & Physical Fulfillment</h2>
            {!isDraft && (
              <span className="text-xs text-[#536658] font-semibold">
                Delivered: <strong className="text-[#166534]">{totalReceived}</strong> of <strong>{totalOrdered}</strong>
              </span>
            )}
          </div>
          <PoLineItemsEditor purchaseOrderId={p.id} items={items} currency={p.currency} editable={isDraft && isFinance} />
        </Card>

        {/* Goods Receipts (GRN) History Table */}
        {receives.length > 0 && (
          <div className="bento-card overflow-hidden">
            <div className="border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4 font-bold text-sm text-[#14261c] flex items-center justify-between">
              <span>📦 Recorded Goods Receipts (GRN Log)</span>
              <span className="text-xs text-[#536658] font-semibold">{receives.length} delivery record(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                    <th className="px-6 py-3">GRN #</th>
                    <th className="px-6 py-3">Received Date</th>
                    <th className="px-6 py-3">Challan / Inv #</th>
                    <th className="px-6 py-3">Received By</th>
                    <th className="px-6 py-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5decb]">
                  {receives.map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#fbf9f4] transition-colors">
                      <td className="px-6 py-3 font-mono font-bold text-[#1e3e30]">{r.receive_no}</td>
                      <td className="px-6 py-3 text-xs text-[#536658] font-semibold">{fmtDate(r.received_date)}</td>
                      <td className="px-6 py-3 font-mono text-xs text-[#14261c]">{r.delivery_challan_no ?? "—"}</td>
                      <td className="px-6 py-3 text-xs text-[#14261c] font-medium">{r.received_by_user?.name ?? "Plant Team"}</td>
                      <td className="px-6 py-3 text-xs text-[#536658]">{r.remarks ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isDraft && isFinance && (
          <Card variant="emerald">
            <h2 className="mb-3 text-sm font-bold text-[#166534]">Issue</h2>
            <IssuePoPanel id={p.id} totalValue={Number(p.total_value)} currency={p.currency} />
          </Card>
        )}

        {status === "pending_second_approval" && isFinance && profile.id !== p.created_by_user?.id && (
          <Card variant="amber" className="border-2 border-[#f59e0b] shadow-md">
            <h2 className="mb-3 text-sm font-bold text-[#92400e]">Second Approval Required</h2>
            <p className="mb-3 text-xs text-[#92400e]">
              {p.created_by_user?.name} drafted this purchase order above the second-approval threshold. Approve to open it for billing.
            </p>
            <ApprovePoSecondApprovalPanel id={p.id} />
          </Card>
        )}

        {isFinance && ["open", "pending_second_approval"].includes(status) && (linkedRequests ?? []).length === 0 && (
          <Card>
            <CancelPoPanel id={p.id} />
          </Card>
        )}

        {isFinance && ["open", "partially_billed", "fully_billed"].includes(status) && (
          <Card>
            <h2 className="mb-3 text-sm font-bold text-[#14261c]">Amendment</h2>
            <AmendPoPanel
              id={p.id}
              items={items.map((i: any) => ({
                item_description: i.item_description,
                product_sku: i.product_sku,
                qty: Number(i.qty),
                unit_rate: Number(i.unit_rate),
                tax_percent: i.tax_percent != null ? Number(i.tax_percent) : null,
                tax_amount: i.tax_amount != null ? Number(i.tax_amount) : null,
                round_off: i.round_off != null ? Number(i.round_off) : null,
              }))}
            />
          </Card>
        )}

        <div className="bento-card overflow-hidden">
          <div className="border-b border-[#e5decb] bg-[#fbf9f4] px-6 py-4 font-bold text-sm text-[#14261c]">
            Linked Fund Requests
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[#e5decb] bg-[#fbf9f4] text-left text-xs font-bold uppercase tracking-wider text-[#415546]">
                  <th className="px-6 py-3">Request</th>
                  <th className="px-6 py-3 text-right">Requested</th>
                  <th className="px-6 py-3 text-right">Approved</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5decb]">
                {(linkedRequests ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-xs text-[#536658]">
                      No fund requests linked to this purchase order yet.
                    </td>
                  </tr>
                ) : (
                  (linkedRequests ?? []).map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#fbf9f4] transition-colors">
                      <td className="px-6 py-3">
                        <Link href={`/requests/${r.id}`} className="font-mono font-bold text-[#1e3e30] hover:underline">
                          {r.request_no}
                        </Link>
                        <div className="text-xs text-[#536658]">{r.item_description}</div>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">{fmtMoney(r.amount_requested, r.currency)}</td>
                      <td className="px-6 py-3 text-right font-bold tabular-nums">{fmtMoney(r.amount_approved, r.currency)}</td>
                      <td className="px-6 py-3">
                        <StatusChip status={r.status as Status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <Card className="sticky top-20">
          <h2 className="mb-4 text-sm font-bold text-[#14261c] flex items-center gap-2">
            <span className="text-[#1e3e30]">🛡️</span>
            <span>Audit Trail</span>
          </h2>
          <ol className="relative space-y-4 border-l border-[#e5decb] pl-4">
            {(audit ?? []).length === 0 ? (
              <li className="text-xs text-[#536658]">No events recorded yet.</li>
            ) : (
              (audit ?? []).map((e: any) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21.5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#1e3e30]" />
                  <div className="text-xs font-bold text-[#14261c]">{e.action}</div>
                  {e.remarks && <div className="text-xs text-[#536658] mt-0.5 font-medium">{e.remarks}</div>}
                  <div className="text-[10px] text-[#7a8d80] font-semibold mt-0.5">{fmtDateTime(e.created_at)}</div>
                </li>
              ))
            )}
          </ol>
        </Card>
      </div>
    </div>
  );
}
