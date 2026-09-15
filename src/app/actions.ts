"use server";

import { getSupabase, getSupabaseAdmin } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notify, siteUrl } from "@/lib/mailer";

export type ActionResult = { ok: boolean; error?: string; warning?: string; id?: string };

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

async function financeEmails(admin: AdminClient, excludeUserId?: string): Promise<string[]> {
  let query = admin.from("jetflo_users").select("email, id").eq("role", "finance").eq("active", true);
  const { data } = await query;
  return (data ?? []).filter((u) => u.id !== excludeUserId).map((u) => u.email).filter(Boolean);
}

/**
 * App-layer mirror of the jetflo_check_po_balance() DB function. Needed because
 * financeDecide writes via the admin/service-role client (auth.uid() is null there),
 * which is exactly the condition under which jetflo_validate_transition's own PO check
 * bypasses itself — so this is the check that actually runs on the real approval path;
 * the DB-side version stays in place as defense-in-depth against direct API access.
 * Returns an error string, or null if the approval is within bounds.
 */
async function checkPoBalance(
  admin: AdminClient,
  opts: { poId: string; excludeRequestId: string; amount: number; currency: string }
): Promise<string | null> {
  const { data: po } = await admin
    .from("jetflo_purchase_orders")
    .select("po_number, status, currency, total_value")
    .eq("id", opts.poId)
    .single();
  if (!po) return "Linked purchase order not found.";
  if (!["open", "partially_billed"].includes(po.status)) {
    return `Purchase order ${po.po_number} is not open for billing (status: ${po.status}).`;
  }
  if (po.currency !== opts.currency) {
    return `Request currency (${opts.currency}) must match its purchase order currency (${po.currency}).`;
  }
  const { data: linked } = await admin
    .from("jetflo_fund_requests")
    .select("amount_approved")
    .eq("po_id", opts.poId)
    .neq("id", opts.excludeRequestId)
    .in("status", ["awaiting_second_approval", "approved", "partially_approved", "paid", "closed"]);
  const committed = (linked ?? []).reduce((s, r) => s + Number(r.amount_approved || 0), 0);
  if (committed + opts.amount > Number(po.total_value)) {
    return `This approval (₹${opts.amount.toLocaleString("en-IN")}) would exceed purchase order ${po.po_number}'s remaining balance of ₹${(Number(po.total_value) - committed).toLocaleString("en-IN")}.`;
  }
  return null;
}

async function ctx() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session has expired. Please refresh the page and sign in again.");
  return { supabase, userId: user.id };
}

async function setting(supabase: Awaited<ReturnType<typeof getSupabase>>, key: string): Promise<number> {
  const { data } = await supabase.from("jetflo_settings").select("value").eq("key", key).single();
  return Number(data?.value ?? 0);
}

async function uploadAttachment(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  userId: string,
  requestId: string,
  kind: string,
  file: File
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  try {
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${requestId}/${kind}-${Date.now()}-${safe}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { error } = await supabase.storage.from("jetflo-docs").upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
    if (error) {
      console.error("Supabase storage upload error:", error);
      return `Upload failed: ${error.message}`;
    }
    const { error: e2 } = await supabase.from("jetflo_attachments").insert({
      request_id: requestId,
      kind,
      storage_path: path,
      file_name: file.name,
      uploaded_by: userId,
    });
    if (e2) {
      console.error("Supabase attachment record error:", e2);
      return `Attachment record failed: ${e2.message}`;
    }
    return null;
  } catch (err: any) {
    console.error("Attachment upload exception:", err);
    return `Upload failed: ${err?.message || "Storage error"}`;
  }
}

function computeLineTotal(
  qty: number,
  unitRate: number,
  taxPercent: number | null,
  taxAmount: number | null,
  roundOff: number | null
): number {
  const taxable = qty * unitRate;
  const calcTax = taxPercent ? Number((taxable * (taxPercent / 100)).toFixed(2)) : (taxAmount ?? 0);
  return Number((taxable + calcTax + (roundOff ?? 0)).toFixed(2));
}

/**
 * Auto-generates a draft PO (unissued) from an "against invoice" request the moment it's
 * submitted — pre-filled with the request's vendor/item/qty/rate, but still requires
 * finance to review and click Issue, same as the manual "Draft a Purchase Order" button.
 * No-ops (never throws) for any other payment type, a request that already has a po_id,
 * or a request that already has a source-linked PO (submit/resubmit is idempotent).
 */
async function autoGenerateInvoicePoDraft(admin: AdminClient, requestId: string): Promise<void> {
  try {
    const { data: req } = await admin
      .from("jetflo_fund_requests")
      .select(
        "payment_type, po_id, vendor_id, budget_head_id, category, currency, item_description, product_sku, qty, unit_rate, tax_percent, tax_amount, round_off, amount_requested, requester_id, request_no"
      )
      .eq("id", requestId)
      .single();
    if (!req || req.payment_type !== "against_invoice" || req.po_id) return;

    const { count: existing } = await admin
      .from("jetflo_purchase_orders")
      .select("id", { count: "exact", head: true })
      .eq("source_request_id", requestId);
    if (existing) return;

    const qty = req.qty ? Number(req.qty) : 1;
    const unitRate = req.unit_rate ? Number(req.unit_rate) : Number(req.amount_requested);
    const taxPercent = req.tax_percent != null ? Number(req.tax_percent) : null;
    const taxAmount = req.tax_amount != null ? Number(req.tax_amount) : null;
    const roundOff = req.round_off != null ? Number(req.round_off) : null;
    const lineTotal =
      req.qty && req.unit_rate ? computeLineTotal(qty, unitRate, taxPercent, taxAmount, roundOff) : Number(req.amount_requested);

    const { data: po, error: poErr } = await admin
      .from("jetflo_purchase_orders")
      .insert({
        vendor_id: req.vendor_id,
        budget_head_id: req.budget_head_id,
        category: req.category,
        currency: req.currency || "INR",
        source_request_id: requestId,
        created_by: req.requester_id,
        status: "draft",
        notes: `Auto-generated from ${req.request_no} at submission (against invoice).`,
      })
      .select("id")
      .single();
    if (poErr || !po) return;

    await admin.from("jetflo_purchase_order_items").insert({
      purchase_order_id: po.id,
      item_description: req.item_description,
      product_sku: req.product_sku,
      qty,
      unit_rate: unitRate,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      round_off: roundOff,
      line_total: lineTotal,
      sort_order: 0,
    });

    await admin.from("jetflo_audit_log").insert({
      purchase_order_id: po.id,
      actor_id: req.requester_id,
      action: "po_auto_generated",
      remarks: `Draft PO auto-generated from ${req.request_no} at submission — awaiting finance review and issue.`,
    });
  } catch (err) {
    console.error("autoGenerateInvoicePoDraft failed:", err);
  }
}

async function safeDbInsert(
  client: any,
  table: string,
  payload: Record<string, unknown>
): Promise<{ data: any; error: any }> {
  const current = { ...payload };
  while (true) {
    const res = await client.from(table).insert(current).select("id, request_no").single();
    if (res.error) {
      const match = res.error.message?.match(/Could not find the '([^']+)' column of/i);
      if (match && match[1] && match[1] in current) {
        delete current[match[1]];
        continue;
      }
    }
    return res;
  }
}

async function safeDbUpdate(
  client: any,
  table: string,
  payload: Record<string, unknown>,
  id: string
): Promise<{ error: any }> {
  const current = { ...payload };
  while (true) {
    const res = await client.from(table).update(current).eq("id", id);
    if (res.error) {
      const match = res.error.message?.match(/Could not find the '([^']+)' column of/i);
      if (match && match[1] && match[1] in current) {
        delete current[match[1]];
        continue;
      }
    }
    return res;
  }
}

// ---------- auth ----------

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { ok: false, error: "Please provide both email and password." };
  }

  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { ok: false, error: error.message };
  redirect("/");
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}


// ---------- requests ----------

export async function createRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, userId } = await ctx();
    const intent = String(formData.get("intent")); // draft | submit
    const category = String(formData.get("category") || "").trim();
    const budgetHeadId = String(formData.get("budget_head_id") || "").trim();
    const vendorId = String(formData.get("vendor_id") || "").trim();
    const itemDescription = String(formData.get("item_description") || "").trim();
    const paymentType = String(formData.get("payment_type") || "advance");

    if (!category) return { ok: false, error: "Category is mandatory." };
    if (!budgetHeadId) return { ok: false, error: "Budget sub-head is mandatory." };
    if (!vendorId) return { ok: false, error: "Vendor selection is mandatory." };
    if (!itemDescription) return { ok: false, error: "Item description is mandatory." };

    const isAdvance = paymentType === "advance";
    const qty = (!isAdvance && formData.get("qty")) ? Number(formData.get("qty")) : null;
    const rate = (!isAdvance && formData.get("unit_rate")) ? Number(formData.get("unit_rate")) : null;
    const taxPercent = (!isAdvance && formData.get("tax_percent")) ? Number(formData.get("tax_percent")) : null;
    const taxAmount = (!isAdvance && formData.get("tax_amount")) ? Number(formData.get("tax_amount")) : null;
    const roundOff = (!isAdvance && formData.get("round_off") !== null && formData.get("round_off") !== "") ? Number(formData.get("round_off")) : null;
    const currency = String(formData.get("currency") || "INR").toUpperCase() === "USD" ? "USD" : "INR";
    const sym = currency === "USD" ? "$" : "₹";
    let amount = Number(formData.get("amount_requested"));

    // Auto-calculate line total if qty and unit rate are provided and amount not manually specified
    if (!isAdvance && (!amount || isNaN(amount)) && qty && rate) {
      const taxable = qty * rate;
      const calcTax = taxPercent ? Number((taxable * (taxPercent / 100)).toFixed(2)) : (taxAmount ?? 0);
      amount = Number((taxable + calcTax + (roundOff ?? 0)).toFixed(2));
    }
    if (!amount || amount <= 0) return { ok: false, error: `Please enter a valid requested amount (${sym}).` };

    const docFile = (formData.get("doc_file") || formData.get("quotation")) as File | null;
    const docKind = String(formData.get("doc_kind") || "quotation");

    if (intent === "submit") {
      if (!docFile || docFile.size === 0) {
        return {
          ok: false,
          error: "A supporting document (Quotation / Proforma / Tax Invoice / PO) is mandatory to submit for approval.",
        };
      }
    }

    // duplicate check: same vendor, ±10% amount, within window
    const windowDays = await setting(supabase, "duplicate_window_days");
    const since = new Date(Date.now() - windowDays * 86400000).toISOString();
    const { data: dupes } = await supabase
      .from("jetflo_fund_requests")
      .select("request_no, amount_requested")
      .eq("vendor_id", vendorId)
      .gte("created_at", since)
      .not("status", "in", "(rejected)")
      .gte("amount_requested", amount * 0.9)
      .lte("amount_requested", amount * 1.1);
    const isDupe = (dupes?.length ?? 0) > 0;

    const notes = String(formData.get("justification") || formData.get("notes") || "").trim();
    const parentRequestId = String(formData.get("parent_request_id") || "").trim() || null;
    const priorInvoiceNo = String(formData.get("prior_invoice_no") || "").trim() || null;
    const poId = String(formData.get("po_id") || "").trim() || null;

    // soft warning only — the DB trigger + financeDecide's own check enforce the real
    // balance limit at approval time; this just lets the requester see it up front.
    let poWarning: string | undefined;
    if (poId) {
      const { data: po } = await supabase
        .from("jetflo_purchase_orders")
        .select("po_number, total_value, currency")
        .eq("id", poId)
        .single();
      if (po) {
        const { data: linked } = await supabase
          .from("jetflo_fund_requests")
          .select("amount_requested")
          .eq("po_id", poId)
          .not("status", "in", "(rejected,sent_back)");
        const committed = (linked ?? []).reduce((s, r) => s + Number(r.amount_requested || 0), 0);
        if (po.currency !== currency) {
          poWarning = `Currency mismatch: ${po.po_number} is in ${po.currency}, this request is in ${currency}. This will be blocked at approval.`;
        } else if (committed + amount > Number(po.total_value)) {
          poWarning = `This request would push ${po.po_number}'s billed total past its remaining balance of ${sym}${(Number(po.total_value) - committed).toLocaleString("en-IN")}. Finance will see this flagged at approval.`;
        }
      }
    }

    const insertPayload: Record<string, unknown> = {
      category,
      budget_head_id: budgetHeadId,
      vendor_id: vendorId,
      item_description: itemDescription,
      product_sku: String(formData.get("product_sku") || "") || null,
      qty,
      unit_rate: rate,
      currency,
      amount_requested: amount,
      urgency: "normal",
      need_by_date: null,
      payment_type: paymentType,
      justification: notes || null,
      status: "draft",
      requester_id: userId,
      duplicate_warning: isDupe,
    };

    if (taxPercent !== null && !isNaN(taxPercent)) insertPayload.tax_percent = taxPercent;
    if (taxAmount !== null && !isNaN(taxAmount)) insertPayload.tax_amount = taxAmount;
    if (roundOff !== null && !isNaN(roundOff)) insertPayload.round_off = roundOff;
    if (parentRequestId) insertPayload.parent_request_id = parentRequestId;
    if (priorInvoiceNo) insertPayload.prior_invoice_no = priorInvoiceNo;
    if (poId) insertPayload.po_id = poId;

    const existingId = String(formData.get("id") || "").trim();
    let requestId = existingId;

    const admin = getSupabaseAdmin();

    if (existingId) {
      const { error: upErr } = await safeDbUpdate(admin, "jetflo_fund_requests", insertPayload, existingId);
      if (upErr) return { ok: false, error: upErr.message };
    } else {
      const { data: inserted, error } = await safeDbInsert(admin, "jetflo_fund_requests", insertPayload);
      if (error) return { ok: false, error: error.message };
      requestId = inserted.id;
    }

    if (docFile && docFile.size > 0) {
      const upErr = await uploadAttachment(supabase, userId, requestId, docKind, docFile);
      if (upErr) return { ok: false, error: upErr };
    }

    if (intent === "submit") {
      const { data: updated, error: e2 } = await admin
        .from("jetflo_fund_requests")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", requestId)
        .select("request_no")
        .single();
      if (e2) return { ok: false, error: e2.message };
      const finance = await financeEmails(admin);
      notify({
        to: finance,
        subject: `New request ${updated?.request_no ?? ""} submitted for approval`,
        html: `<p>${itemDescription} — ${sym}${amount.toLocaleString("en-IN")} — needs your review.</p><p><a href="${siteUrl("/finance/queue")}">Open the approval queue</a></p>`,
      });
      // PO process is shifted strictly to Accounts team review/issuance (optional)
    }

    const dupeWarning = isDupe
      ? `Possible duplicate: a similar request to this vendor was raised in the last ${windowDays} days (${dupes!.map((d) => d.request_no).join(", ")}). Finance will see this flag.`
      : undefined;

    revalidatePath("/", "layout");
    return {
      ok: true,
      id: requestId,
      warning: [dupeWarning, poWarning].filter(Boolean).join(" ") || undefined,
    };
  } catch (err: any) {
    console.error("createRequest error:", err);
    return {
      ok: false,
      error: err?.message || "Failed to process request. Please check your connection and try again.",
    };
  }
}

export async function submitRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, userId } = await ctx();
    const id = String(formData.get("id"));

    const { data: req } = await supabase
      .from("jetflo_fund_requests")
      .select("amount_requested")
      .eq("id", id)
      .single();
    if (req) {
      const quotationAbove = await setting(supabase, "quotation_mandatory_above");
      if (Number(req.amount_requested) > quotationAbove) {
        const { data: atts } = await supabase
          .from("jetflo_attachments")
          .select("id")
          .eq("request_id", id)
          .in("kind", ["quotation", "proforma"]);
        if (!atts?.length)
          return { ok: false, error: "Attach a quotation/proforma before submitting (mandatory above threshold)." };
      }
    }

    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const upErr = await uploadAttachment(supabase, userId, id, String(formData.get("kind") || "quotation"), file);
      if (upErr) return { ok: false, error: upErr };
    }

    const admin = getSupabaseAdmin();
    const { data: updated, error } = await admin
      .from("jetflo_fund_requests")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", id)
      .select("request_no, item_description, amount_requested, currency")
      .single();
    if (error) return { ok: false, error: error.message };
    const finance = await financeEmails(admin);
    notify({
      to: finance,
      subject: `Request ${updated?.request_no ?? ""} submitted for approval`,
      html: `<p>${updated?.item_description ?? ""} — ${updated?.currency === "USD" ? "$" : "₹"}${Number(updated?.amount_requested ?? 0).toLocaleString("en-IN")} — needs your review.</p><p><a href="${siteUrl("/finance/queue")}">Open the approval queue</a></p>`,
    });
    // PO creation is handled by Accounts team
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err: any) {
    console.error("submitRequest error:", err);
    return {
      ok: false,
      error: err?.message || "Failed to submit request.",
    };
  }
}

export async function financeDecide(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: userProfile } = await supabase.from("jetflo_users").select("role, name").eq("id", userId).single();
  const isFinance = userProfile?.role === "finance";
  const isLeadership = userProfile?.role === "leadership";

  if (!isFinance && !isLeadership) {
    return { ok: false, error: "Access Denied: Only Accounts or Leadership can approve fund requests." };
  }

  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")); // approve | partial | reject | send_back
  const remarks = String(formData.get("remarks") || "").trim();

  const admin = getSupabaseAdmin();

  const { data: req } = await admin
    .from("jetflo_fund_requests")
    .select("status, amount_requested, amount_approved, approved_by, po_id, currency")
    .eq("id", id)
    .single();
  if (!req) return { ok: false, error: "Request not found" };

  let update: Record<string, unknown> = {};

  if (decision === "reject") {
    if (!remarks) return { ok: false, error: "A rejection reason is required." };
    update = { status: "rejected", rejection_reason: remarks, decided_at: new Date().toISOString() };
  } else if (decision === "send_back") {
    if (!remarks) return { ok: false, error: "Remarks are required when sending back." };
    update = { status: "sent_back", approval_remarks: remarks, decided_at: new Date().toISOString() };
  } else {
    const amount =
      req.status === "awaiting_second_approval"
        ? Number(req.amount_approved || req.amount_requested)
        : Number(formData.get("amount_approved") || req.amount_requested);
    if (!amount || amount <= 0) return { ok: false, error: "Enter a valid approved amount." };
    const isPartial = decision === "partial" || amount < Number(req.amount_requested);
    if (isPartial && !remarks) return { ok: false, error: "Remarks are required for partial approval." };

    const threshold = await setting(supabase, "second_approver_above") || 1000000;

    if (req.status === "submitted" && amount >= threshold) {
      // High-priority request >= threshold: Moves to Leadership Sign-Off (Gaurav)
      update = {
        status: "awaiting_second_approval",
        amount_approved: amount,
        approved_by: userId,
        decided_at: new Date().toISOString(),
        approval_remarks: remarks || `High-Priority (≥ ₹${threshold.toLocaleString("en-IN")}) — Leadership sign-off (Gaurav) required`,
      };
    } else if (req.status === "awaiting_second_approval") {
      // Leadership final approval
      update = {
        status: "approved",
        amount_approved: amount,
        second_approved_by: userId,
        decided_at: new Date().toISOString(),
        approval_remarks: remarks ? `${remarks} (Leadership Approved by ${userProfile?.name || "Leadership"})` : `Leadership Approved by ${userProfile?.name || "Leadership"}`,
      };
    } else {
      // Standard approval below threshold
      update = {
        status: isPartial ? "partially_approved" : "approved",
        amount_approved: amount,
        approved_by: userId,
        decided_at: new Date().toISOString(),
        approval_remarks: remarks || null,
      };
    }
  }

  if (update.amount_approved && req.po_id) {
    const poErr = await checkPoBalance(admin, {
      poId: req.po_id,
      excludeRequestId: id,
      amount: Number(update.amount_approved),
      currency: req.currency || "INR",
    });
    if (poErr) return { ok: false, error: poErr };
  }

  const { data: decided, error } = await admin
    .from("jetflo_fund_requests")
    .update(update)
    .eq("id", id)
    .select("request_no, item_description")
    .single();
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  if (update.status === "awaiting_second_approval") {
    const otherFinance = await financeEmails(admin, userId);
    notify({
      to: otherFinance,
      subject: `Request ${decided?.request_no ?? ""} needs a second approver`,
      html: `<p>${decided?.item_description ?? ""} has crossed the second-approval threshold and is waiting on a different finance user to sign off.</p><p><a href="${siteUrl("/finance/queue")}">Open the approval queue</a></p>`,
    });
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    warning:
      update.status === "awaiting_second_approval"
        ? "High-Priority Request: Parked for Leadership Sign-Off (Gaurav)."
        : undefined,
  };
}

export async function recordPayment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const requestId = String(formData.get("id"));
  const amount = Number(formData.get("amount_paid"));
  if (!amount || amount <= 0) return { ok: false, error: "Enter a valid amount" };

  const admin = getSupabaseAdmin();

  const { error } = await admin.from("jetflo_payments").insert({
    request_id: requestId,
    amount_paid: amount,
    paid_on: String(formData.get("paid_on")),
    mode: String(formData.get("mode")),
    bank: String(formData.get("bank") || "") || null,
    utr_ref: String(formData.get("utr_ref") || "") || null,
    remarks: String(formData.get("remarks") || "") || null,
    recorded_by: userId,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  const { data: req } = await admin
    .from("jetflo_fund_requests")
    .select("request_no, currency, requester:jetflo_users!jetflo_fund_requests_requester_id_fkey ( email )")
    .eq("id", requestId)
    .single();
  const requesterEmail = (req as any)?.requester?.email as string | undefined;
  if (requesterEmail) {
    const sym = req?.currency === "USD" ? "$" : "₹";
    notify({
      to: requesterEmail,
      subject: `Payment recorded for ${req?.request_no ?? "your request"}`,
      html: `<p>${sym}${amount.toLocaleString("en-IN")} has been transferred against ${req?.request_no ?? "your request"}.</p><p><a href="${siteUrl(`/requests/${requestId}`)}">View the request</a></p>`,
    });
  }

  const proof = formData.get("proof") as File | null;
  if (proof && proof.size > 0) {
    const upErr = await uploadAttachment(supabase, userId, requestId, "payment_proof", proof);
    if (upErr) return { ok: true, warning: upErr };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function closeRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const id = String(formData.get("id"));
  if (!formData.get("goods_received")) return { ok: false, error: "Confirm goods/services were received" };

  const admin = getSupabaseAdmin();

  const invoice = formData.get("invoice") as File | null;
  if (invoice && invoice.size > 0) {
    const upErr = await uploadAttachment(supabase, userId, id, "invoice", invoice);
    if (upErr) return { ok: false, error: upErr };
  } else {
    const { data: atts } = await admin
      .from("jetflo_attachments")
      .select("id")
      .eq("request_id", id)
      .in("kind", ["invoice", "grn"]);
    if (!atts?.length) return { ok: false, error: "Upload the final invoice / GRN to close this request" };
  }

  const { error } = await admin
    .from("jetflo_fund_requests")
    .update({ status: "closed", goods_received: true, closed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- masters & vendor onboarding ----------

export async function onboardVendor(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: userProfile } = await supabase.from("jetflo_users").select("role").eq("id", userId).single();
  const isFinance = userProfile?.role === "finance";

  const isForeign = formData.get("is_foreign") === "true";
  const name = String(formData.get("name") || "").trim();
  const tradeName = String(formData.get("trade_name") || "").trim();
  const gstin = String(formData.get("gstin") || "").trim().toUpperCase();
  const vatNo = String(formData.get("vat_no") || "").trim().toUpperCase();
  const panInput = String(formData.get("pan") || "").trim().toUpperCase();
  const isUnregistered = formData.get("is_unregistered") === "true" || formData.get("is_unregistered") === "1";
  const contactPerson = String(formData.get("contact_person") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = String(formData.get("phone") || "").trim();
  const addressLine = String(formData.get("address_line") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const state = String(formData.get("state") || "").trim();
  const country = String(formData.get("country") || "India").trim();
  const pincode = String(formData.get("pincode") || "").trim();
  const bankName = String(formData.get("bank_name") || "").trim();
  const accountNo = String(formData.get("account_no") || "").trim();
  const confirmAccountNo = String(formData.get("confirm_account_no") || "").trim();
  const ifsc = String(formData.get("ifsc") || "").trim().toUpperCase();
  const swiftCode = String(formData.get("swift_code") || "").trim().toUpperCase();
  const bankDocType = String(formData.get("bank_doc_type") || (isForeign ? "letterhead_profile" : "cancelled_cheque"));

  // Validations
  if (!name || name.length < 2) return { ok: false, error: "Legal Business Name is mandatory." };
  if (!contactPerson) return { ok: false, error: "Contact person name is mandatory." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address for accounts." };
  }

  // Phone validation
  if (!phone) return { ok: false, error: "Phone number is mandatory." };
  const cleanPhone = phone.replace(/[^\d+]/g, "");
  if (isForeign) {
    if (cleanPhone.length < 6 || cleanPhone.length > 16) {
      return { ok: false, error: "Foreign phone number should be between 6 to 15 digits." };
    }
  } else {
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) {
      return { ok: false, error: "Please enter a valid 10-digit mobile number." };
    }
  }

  // Domestic vs Foreign statutory validations
  if (!isForeign) {
    if (!isUnregistered) {
      if (!gstin) return { ok: false, error: "GSTIN is mandatory (or check 'Unregistered / Exempt')." };
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        return { ok: false, error: "Invalid GSTIN format. Must be 15 alphanumeric characters (e.g., 33AABCS1234F1Z5)." };
      }
    }
    const pan = gstin && gstin.length >= 12 ? gstin.slice(2, 12) : panInput;
    if (pan) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(pan)) {
        return { ok: false, error: "Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F)." };
      }
    }
  } else {
    if (!vatNo || vatNo.length < 3) {
      return { ok: false, error: "VAT / International Tax ID Number is mandatory for foreign vendors." };
    }
    if (!country) return { ok: false, error: "Country is mandatory for foreign vendors." };
  }

  // Banking validations
  if (!bankName) return { ok: false, error: "Bank name is mandatory." };
  if (!accountNo || accountNo.length < 6) return { ok: false, error: "Please enter a valid bank account / IBAN number." };
  if (confirmAccountNo && confirmAccountNo !== accountNo) {
    return { ok: false, error: "Bank account / IBAN numbers do not match." };
  }

  if (isForeign) {
    if (!swiftCode || swiftCode.length < 8 || swiftCode.length > 11) {
      return { ok: false, error: "Invalid SWIFT / BIC code. Must be 8 to 11 alphanumeric characters (e.g., DEUTDEDDFXX)." };
    }
  } else {
    if (!ifsc) return { ok: false, error: "IFSC code is mandatory." };
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc)) {
      return { ok: false, error: "Invalid IFSC code format (e.g., HDFC0000123)." };
    }
  }

  const bankProof = formData.get("bank_proof") as File | null;
  if (!isFinance && (!bankProof || bankProof.size === 0)) {
    const docLabel = bankDocType === "letterhead_profile"
      ? "Accounting Profile on Letterhead / Wire Specimen"
      : "Cancelled Cheque / Bank Passbook";
    return { ok: false, error: `A ${docLabel} document is mandatory for accounts verification.` };
  }

  // Active status: Finance onboarded is immediately active; Ground team onboarded is inactive (pending approval)
  const isActive = isFinance ? true : false;
  const status = isFinance ? "approved" : "pending_approval";

  const admin = getSupabaseAdmin();

  // Display name formatting
  const displayName = isForeign
    ? tradeName ? `${name} (${tradeName} — ${country})` : `${name} (${country})`
    : tradeName ? `${name} (${tradeName})` : name;

  const gstinVal = !isForeign ? (isUnregistered ? null : gstin) : (vatNo || null);
  const ifscVal = isForeign ? swiftCode : ifsc;

  const { data: inserted, error } = await admin
    .from("jetflo_vendors")
    .insert({
      name: displayName,
      gstin: gstinVal,
      bank_name: bankName,
      account_no: accountNo,
      ifsc: ifscVal,
      category: "both",
      active: isActive,
      created_by: userId,
    })
    .select("id, name")
    .single();

  if (error) return { ok: false, error: error.message };

  // If attachments are provided, upload to storage
  if (bankProof && bankProof.size > 0) {
    const safe = bankProof.name.replace(/[^\w.\-]+/g, "_");
    const path = `vendor-docs/${inserted.id}/${bankDocType}-${Date.now()}-${safe}`;
    await admin.storage.from("jetflo-docs").upload(path, bankProof, { upsert: true });
  }

  const gstCert = formData.get("gst_cert") as File | null;
  if (gstCert && gstCert.size > 0) {
    const safe = gstCert.name.replace(/[^\w.\-]+/g, "_");
    const path = `vendor-docs/${inserted.id}/tax_cert-${Date.now()}-${safe}`;
    await admin.storage.from("jetflo-docs").upload(path, gstCert, { upsert: true });
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    id: inserted.id,
    warning: isActive
      ? undefined
      : `Vendor onboarding request for ${name} (${isForeign ? "Foreign / Import" : "Domestic"}) submitted! Accounts team (accounts@claroenergy.in) has been queued for dual-control verification.`,
  };
}

export async function approveVendor(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: userProfile } = await supabase.from("jetflo_users").select("role").eq("id", userId).single();
  if (userProfile?.role !== "finance") {
    return { ok: false, error: "Access Denied: Only Accounts / Finance can approve vendors." };
  }

  const vendorId = String(formData.get("vendor_id") || "").trim();
  if (!vendorId) return { ok: false, error: "Vendor ID required." };

  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from("jetflo_vendors")
    .update({ active: true })
    .eq("id", vendorId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rejectVendor(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: userProfile } = await supabase.from("jetflo_users").select("role").eq("id", userId).single();
  if (userProfile?.role !== "finance") {
    return { ok: false, error: "Access Denied: Only Accounts / Finance can reject vendors." };
  }

  const vendorId = String(formData.get("vendor_id") || "").trim();
  if (!vendorId) return { ok: false, error: "Vendor ID required." };

  const admin = getSupabaseAdmin();

  // If vendor has no fund requests, delete; otherwise deactivate
  const { count } = await admin
    .from("jetflo_fund_requests")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId);

  if (!count || count === 0) {
    await admin.from("jetflo_vendors").delete().eq("id", vendorId);
  } else {
    await admin.from("jetflo_vendors").update({ active: false }).eq("id", vendorId);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addVendor(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return onboardVendor(_prev, formData);
}

export async function addBudgetHead(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const sanctioned = formData.get("sanctioned_amount");
  const { error } = await supabase.from("jetflo_budget_heads").insert({
    category: String(formData.get("category")),
    sub_head: String(formData.get("sub_head")),
    sanctioned_amount: sanctioned ? Number(sanctioned) : null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDraft(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const { supabase, userId } = await ctx();
    const id = String(formData.get("id"));
    const intent = String(formData.get("intent"));
    const category = String(formData.get("category") || "").trim();
    const budgetHeadId = String(formData.get("budget_head_id") || "").trim();
    const vendorId = String(formData.get("vendor_id") || "").trim();
    const itemDescription = String(formData.get("item_description") || "").trim();
    const paymentType = String(formData.get("payment_type") || "advance");

    const isAdvance = paymentType === "advance";
    const qty = (!isAdvance && formData.get("qty")) ? Number(formData.get("qty")) : null;
    const rate = (!isAdvance && formData.get("unit_rate")) ? Number(formData.get("unit_rate")) : null;
    const taxPercent = (!isAdvance && formData.get("tax_percent")) ? Number(formData.get("tax_percent")) : null;
    const taxAmount = (!isAdvance && formData.get("tax_amount")) ? Number(formData.get("tax_amount")) : null;
    const roundOff = (!isAdvance && formData.get("round_off") !== null && formData.get("round_off") !== "") ? Number(formData.get("round_off")) : null;
    const currency = String(formData.get("currency") || "INR").toUpperCase() === "USD" ? "USD" : "INR";
    const sym = currency === "USD" ? "$" : "₹";
    let amount = Number(formData.get("amount_requested"));

    if (!isAdvance && (!amount || isNaN(amount)) && qty && rate) {
      const taxable = qty * rate;
      const calcTax = taxPercent ? Number((taxable * (taxPercent / 100)).toFixed(2)) : (taxAmount ?? 0);
      amount = Number((taxable + calcTax + (roundOff ?? 0)).toFixed(2));
    }
    if (!amount || amount <= 0) return { ok: false, error: `Enter a valid amount (${sym})` };

    const notes = String(formData.get("justification") || formData.get("notes") || "").trim();
    const parentRequestId = String(formData.get("parent_request_id") || "").trim() || null;
    const priorInvoiceNo = String(formData.get("prior_invoice_no") || "").trim() || null;
    const poId = String(formData.get("po_id") || "").trim() || null;

    const updatePayload: Record<string, unknown> = {
      category,
      budget_head_id: budgetHeadId,
      vendor_id: vendorId,
      item_description: itemDescription,
      product_sku: String(formData.get("product_sku") || "") || null,
      qty,
      unit_rate: rate,
      currency,
      amount_requested: amount,
      urgency: "normal",
      need_by_date: null,
      payment_type: paymentType,
      justification: notes || null,
    };

    if (taxPercent !== null && !isNaN(taxPercent)) updatePayload.tax_percent = taxPercent;
    if (taxAmount !== null && !isNaN(taxAmount)) updatePayload.tax_amount = taxAmount;
    if (roundOff !== null && !isNaN(roundOff)) updatePayload.round_off = roundOff;
    if (parentRequestId) updatePayload.parent_request_id = parentRequestId;
    if (priorInvoiceNo) updatePayload.prior_invoice_no = priorInvoiceNo;
    updatePayload.po_id = poId;

    const { error } = await safeDbUpdate(supabase, "jetflo_fund_requests", updatePayload, id);
    if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

    const docFile = (formData.get("doc_file") || formData.get("quotation")) as File | null;
    const docKind = String(formData.get("doc_kind") || "quotation");
    if (docFile && docFile.size > 0) {
      const upErr = await uploadAttachment(supabase, userId, id, docKind, docFile);
      if (upErr) return { ok: false, error: upErr };
    }

    if (intent === "submit") {
      const { data: atts } = await supabase
        .from("jetflo_attachments")
        .select("id")
        .eq("request_id", id);
      if (!atts?.length && (!docFile || docFile.size === 0)) {
        return { ok: false, error: "A supporting document is mandatory before submitting for approval." };
      }
      const { error: e2 } = await supabase
        .from("jetflo_fund_requests")
        .update({ status: "submitted" })
        .eq("id", id);
      if (e2) return { ok: false, error: e2.message.replace(/^.*?exception:\s*/i, "") };
      const admin = getSupabaseAdmin();
      const finance = await financeEmails(admin);
      notify({
        to: finance,
        subject: `Request submitted for approval`,
        html: `<p>${itemDescription} — ${sym}${amount.toLocaleString("en-IN")} — needs your review.</p><p><a href="${siteUrl("/finance/queue")}">Open the approval queue</a></p>`,
      });
      // PO creation is handled by Accounts team
    }
    revalidatePath("/", "layout");
    return { ok: true, id };
  } catch (err: any) {
    console.error("updateDraft error:", err);
    return {
      ok: false,
      error: err?.message || "Failed to update draft. Please check your connection and try again.",
    };
  }
}

export async function updateGovernanceSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: userProfile } = await supabase
    .from("jetflo_users")
    .select("role")
    .eq("id", userId)
    .single();

  if (userProfile?.role !== "leadership") {
    return { ok: false, error: "Access Denied: Only Leadership can customize governance thresholds." };
  }

  const secondApproverAbove = Number(formData.get("second_approver_above"));
  const quotationMandatoryAbove = Number(formData.get("quotation_mandatory_above"));
  const duplicateWindowDays = Number(formData.get("duplicate_window_days"));
  const poSecondApproverAbove = Number(formData.get("po_second_approver_above"));

  if (isNaN(secondApproverAbove) || secondApproverAbove < 0) {
    return { ok: false, error: "Please enter a valid dual-approval threshold amount in INR." };
  }

  const updates = [
    { key: "second_approver_above", value: secondApproverAbove },
  ];

  if (!isNaN(quotationMandatoryAbove) && quotationMandatoryAbove >= 0) {
    updates.push({ key: "quotation_mandatory_above", value: quotationMandatoryAbove });
  }
  if (!isNaN(duplicateWindowDays) && duplicateWindowDays > 0) {
    updates.push({ key: "duplicate_window_days", value: duplicateWindowDays });
  }
  if (!isNaN(poSecondApproverAbove) && poSecondApproverAbove >= 0) {
    updates.push({ key: "po_second_approver_above", value: poSecondApproverAbove });
  }

  // Use service role admin client to guarantee atomic settings update
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const item of updates) {
    // upsert, not update: a setting row that doesn't exist yet must not silently no-op
    const { error } = await admin
      .from("jetflo_settings")
      .upsert({ key: item.key, value: item.value }, { onConflict: "key" });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changeUserPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const newPassword = String(formData.get("new_password") || "").trim();
  const confirmPassword = String(formData.get("confirm_password") || "").trim();

  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters long." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New password and confirmation do not match." };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function updateTicketCurrency(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: userProfile } = await supabase.from("jetflo_users").select("role, name").eq("id", userId).single();
  if (!userProfile) return { ok: false, error: "Please log in to amend ticket currency." };

  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, error: "Request ID is missing." };

  const targetCurrency = String(formData.get("currency") || "INR").toUpperCase() === "USD" ? "USD" : "INR";
  const newAmountRaw = formData.get("amount_requested");
  const remarks = String(formData.get("remarks") || "").trim();

  if (!remarks) {
    return { ok: false, error: "Please provide a formal justification for changing the currency." };
  }

  const admin = getSupabaseAdmin();

  // Fetch current ticket
  const { data: currentReq, error: fetchErr } = await admin
    .from("jetflo_fund_requests")
    .select("id, request_no, currency, amount_requested, amount_approved, status, requester_id")
    .eq("id", id)
    .single();

  if (fetchErr || !currentReq) {
    return { ok: false, error: "Ticket not found." };
  }

  // Permission check: Owner, Finance, or Leadership can amend
  const isOwner = currentReq.requester_id === userId;
  const isFinance = userProfile.role === "finance";
  const isLeadership = userProfile.role === "leadership";
  if (!isOwner && !isFinance && !isLeadership) {
    return { ok: false, error: "You are not authorized to amend this request's currency." };
  }

  const prevCurrency = (currentReq.currency || "INR").toUpperCase();
  const prevAmount = Number(currentReq.amount_requested);
  let newAmount = prevAmount;

  if (newAmountRaw !== null && newAmountRaw !== "") {
    const parsed = Number(newAmountRaw);
    if (!isNaN(parsed) && parsed > 0) {
      newAmount = parsed;
    }
  }

  const prevSym = prevCurrency === "USD" ? "$" : "₹";
  const newSym = targetCurrency === "USD" ? "$" : "₹";

  const updatePayload: Record<string, unknown> = {
    currency: targetCurrency,
    amount_requested: newAmount,
    currency_amended: true,
    currency_amended_at: new Date().toISOString(),
    currency_amended_by: userId,
    previous_currency: prevCurrency,
    previous_amount: prevAmount,
    currency_amendment_reason: remarks,
  };

  // If already approved, sync amount_approved if it equalled the old requested amount
  if (currentReq.amount_approved && Number(currentReq.amount_approved) === prevAmount) {
    updatePayload.amount_approved = newAmount;
  }

  const { error: upErr } = await safeDbUpdate(admin, "jetflo_fund_requests", updatePayload, id);
  if (upErr) {
    return { ok: false, error: upErr.message || "Failed to update ticket currency." };
  }

  // Log formal audit memo
  const auditMemo = `Formal Currency Amendment: Currency updated from ${prevCurrency} (${prevSym}${prevAmount.toLocaleString()}) to ${targetCurrency} (${newSym}${newAmount.toLocaleString()}). Justification: ${remarks}`;

  await admin.from("jetflo_audit_log").insert({
    request_id: id,
    actor_id: userId,
    action: "currency_amended",
    remarks: auditMemo,
  });

  const finance = await financeEmails(admin);
  notify({
    to: finance,
    subject: `Currency amended on ${currentReq.request_no}`,
    html: `<p>${auditMemo}</p><p><a href="${siteUrl(`/requests/${id}`)}">Review the ticket</a></p>`,
  });

  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
  revalidatePath("/dashboard");
  revalidatePath("/finance/queue");

  return { ok: true, id };
}

// ---------- purchase orders ----------
// Issue/second-approval/cancel writes go through the regular (RLS-scoped) client on
// purpose, so jetflo_po_validate_transition actually runs (auth.uid() must be non-null
// for it to enforce anything — see the comment on checkPoBalance above). Only
// amendPurchaseOrder deliberately uses the admin client, mirroring updateTicketCurrency.

export async function createPurchaseOrderDraft(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: profile } = await supabase.from("jetflo_users").select("role").eq("id", userId).single();
  if (!profile || !["finance", "requester"].includes(profile.role)) {
    return { ok: false, error: "Only plant ground team or finance can draft a purchase order." };
  }

  const sourceRequestId = String(formData.get("source_request_id") || "").trim() || null;

  let vendorId = String(formData.get("vendor_id") || "").trim();
  let budgetHeadId = String(formData.get("budget_head_id") || "").trim();
  let category = String(formData.get("category") || "").trim();
  let currency = String(formData.get("currency") || "INR").toUpperCase() === "USD" ? "USD" : "INR";
  const notes = String(formData.get("notes") || "").trim() || null;

  let expectedDeliveryDate = String(formData.get("expected_delivery_date") || "").trim() || null;
  let destinationPlant = String(formData.get("destination_plant") || "Hyderabad Plant").trim();
  let referenceNo = String(formData.get("reference_no") || "").trim() || null;
  let paymentTerms = String(formData.get("payment_terms") || "due_on_receipt").trim();
  let orderDate = String(formData.get("order_date") || "").trim() || new Date().toISOString().slice(0, 10);

  let seedItem: {
    item_description: string;
    product_sku: string | null;
    qty: number;
    unit_rate: number;
    tax_percent: number | null;
    tax_amount: number | null;
    round_off: number | null;
  } | null = null;

  if (sourceRequestId) {
    const { data: src } = await supabase
      .from("jetflo_fund_requests")
      .select("vendor_id, budget_head_id, category, currency, item_description, product_sku, qty, unit_rate, tax_percent, tax_amount, round_off, need_by_date")
      .eq("id", sourceRequestId)
      .single();
    if (!src) return { ok: false, error: "Source request not found." };
    vendorId = src.vendor_id;
    budgetHeadId = src.budget_head_id;
    category = src.category;
    currency = (src.currency || "INR").toUpperCase() === "USD" ? "USD" : "INR";
    if (src.need_by_date && !expectedDeliveryDate) {
      expectedDeliveryDate = src.need_by_date;
    }
    if (src.qty && src.unit_rate) {
      seedItem = {
        item_description: src.item_description,
        product_sku: src.product_sku,
        qty: Number(src.qty),
        unit_rate: Number(src.unit_rate),
        tax_percent: src.tax_percent != null ? Number(src.tax_percent) : null,
        tax_amount: src.tax_amount != null ? Number(src.tax_amount) : null,
        round_off: src.round_off != null ? Number(src.round_off) : null,
      };
    }
  }

  if (!vendorId) return { ok: false, error: "Vendor is required." };
  if (!budgetHeadId) return { ok: false, error: "Budget head is required." };
  if (!category) return { ok: false, error: "Category is required." };

  const insertPayload: Record<string, any> = {
    vendor_id: vendorId,
    budget_head_id: budgetHeadId,
    category,
    currency,
    notes,
    source_request_id: sourceRequestId,
    created_by: userId,
    status: "draft",
    order_date: orderDate,
    expected_delivery_date: expectedDeliveryDate,
    destination_plant: destinationPlant,
    reference_no: referenceNo,
    payment_terms: paymentTerms,
  };

  let poRes = await supabase.from("jetflo_purchase_orders").insert(insertPayload).select("id").single();
  if (poRes.error) {
    // Graceful fallback if new columns are not yet applied in db
    delete insertPayload.order_date;
    delete insertPayload.expected_delivery_date;
    delete insertPayload.destination_plant;
    delete insertPayload.reference_no;
    delete insertPayload.payment_terms;
    poRes = await supabase.from("jetflo_purchase_orders").insert(insertPayload).select("id").single();
  }

  if (poRes.error) return { ok: false, error: poRes.error.message };
  const po = poRes.data;

  if (seedItem) {
    const lineTotal = computeLineTotal(seedItem.qty, seedItem.unit_rate, seedItem.tax_percent, seedItem.tax_amount, seedItem.round_off);
    await supabase.from("jetflo_purchase_order_items").insert({
      purchase_order_id: po.id,
      item_description: seedItem.item_description,
      product_sku: seedItem.product_sku,
      qty: seedItem.qty,
      unit_rate: seedItem.unit_rate,
      tax_percent: seedItem.tax_percent,
      tax_amount: seedItem.tax_amount,
      round_off: seedItem.round_off,
      line_total: lineTotal,
      sort_order: 0,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, id: po.id };
}

export async function updatePoDraftHeader(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, error: "Purchase order ID is missing." };

  const { data: po } = await supabase.from("jetflo_purchase_orders").select("status").eq("id", id).single();
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status !== "draft") return { ok: false, error: "Only a draft purchase order can be edited directly." };

  const vendorId = String(formData.get("vendor_id") || "").trim();
  const budgetHeadId = String(formData.get("budget_head_id") || "").trim();
  const currency = String(formData.get("currency") || "INR").toUpperCase() === "USD" ? "USD" : "INR";
  const notes = String(formData.get("notes") || "").trim() || null;
  const orderDate = String(formData.get("order_date") || "").trim() || null;
  const expectedDeliveryDate = String(formData.get("expected_delivery_date") || "").trim() || null;
  const destinationPlant = String(formData.get("destination_plant") || "").trim() || null;
  const referenceNo = String(formData.get("reference_no") || "").trim() || null;
  const paymentTerms = String(formData.get("payment_terms") || "").trim() || null;
  const transporterName = String(formData.get("transporter_name") || "").trim() || null;
  const lrNo = String(formData.get("lr_no") || "").trim() || null;

  const updatePayload: Record<string, any> = {
    vendor_id: vendorId,
    budget_head_id: budgetHeadId,
    currency,
    notes,
    order_date: orderDate,
    expected_delivery_date: expectedDeliveryDate,
    destination_plant: destinationPlant,
    reference_no: referenceNo,
    payment_terms: paymentTerms,
    transporter_name: transporterName,
    lr_no: lrNo,
  };

  let { error } = await supabase.from("jetflo_purchase_orders").update(updatePayload).eq("id", id);
  if (error) {
    // Fallback without extended fields if columns missing
    delete updatePayload.order_date;
    delete updatePayload.expected_delivery_date;
    delete updatePayload.destination_plant;
    delete updatePayload.reference_no;
    delete updatePayload.payment_terms;
    delete updatePayload.transporter_name;
    delete updatePayload.lr_no;
    const res = await supabase.from("jetflo_purchase_orders").update(updatePayload).eq("id", id);
    error = res.error;
  }
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  revalidatePath(`/finance/purchase-orders/${id}`);
  return { ok: true, id };
}

export async function recordPurchaseReceive(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: profile } = await supabase.from("jetflo_users").select("role").eq("id", userId).single();
  if (!profile || !["requester", "finance"].includes(profile.role)) {
    return { ok: false, error: "Only plant ground team or finance can log goods receipts." };
  }

  const purchaseOrderId = String(formData.get("purchase_order_id") || "").trim();
  const receiveNo = String(formData.get("receive_no") || "").trim();
  const receivedDate = String(formData.get("received_date") || "").trim() || new Date().toISOString().slice(0, 10);
  const deliveryChallanNo = String(formData.get("delivery_challan_no") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!purchaseOrderId) return { ok: false, error: "Purchase order is required." };
  if (!receiveNo) return { ok: false, error: "GRN / Receive Number is required." };

  const itemIds = formData.getAll("po_item_id") as string[];
  const qtys = formData.getAll("qty_received") as string[];

  const validItems: { po_item_id: string; qty_received: number }[] = [];
  for (let i = 0; i < itemIds.length; i++) {
    const q = parseFloat(qtys[i] || "0");
    if (!isNaN(q) && q > 0) {
      validItems.push({ po_item_id: itemIds[i], qty_received: q });
    }
  }

  if (validItems.length === 0) {
    return { ok: false, error: "Please specify received quantity > 0 for at least one item." };
  }

  try {
    const { data: recv, error: recvErr } = await supabase
      .from("jetflo_purchase_receives")
      .insert({
        purchase_order_id: purchaseOrderId,
        receive_no: receiveNo,
        received_date: receivedDate,
        received_by: userId,
        delivery_challan_no: deliveryChallanNo,
        remarks,
      })
      .select("id")
      .single();

    if (recvErr) return { ok: false, error: recvErr.message };

    const { error: itemsErr } = await supabase.from("jetflo_purchase_receive_items").insert(
      validItems.map((item) => ({
        receive_id: recv.id,
        po_item_id: item.po_item_id,
        qty_received: item.qty_received,
      }))
    );

    if (itemsErr) return { ok: false, error: itemsErr.message };

    await supabase.from("jetflo_audit_log").insert({
      purchase_order_id: purchaseOrderId,
      actor_id: userId,
      action: "goods_received",
      remarks: `GRN ${receiveNo} recorded for ${validItems.length} item(s). Challan: ${deliveryChallanNo ?? "N/A"}`,
    });
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to save Goods Receipt." };
  }

  revalidatePath(`/finance/purchase-orders/${purchaseOrderId}`);
  revalidatePath("/dashboard");
  return { ok: true, id: purchaseOrderId };
}

export async function addPoLineItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const poId = String(formData.get("purchase_order_id") || "").trim();
  if (!poId) return { ok: false, error: "Purchase order ID is missing." };

  const itemDescription = String(formData.get("item_description") || "").trim();
  const productSku = String(formData.get("product_sku") || "").trim() || null;
  const qty = Number(formData.get("qty"));
  const unitRate = Number(formData.get("unit_rate"));
  const taxPercent = formData.get("tax_percent") ? Number(formData.get("tax_percent")) : null;
  const taxAmount = formData.get("tax_amount") ? Number(formData.get("tax_amount")) : null;
  const roundOff = formData.get("round_off") ? Number(formData.get("round_off")) : null;

  if (!itemDescription) return { ok: false, error: "Item description is required." };
  if (!qty || qty <= 0) return { ok: false, error: "Enter a valid quantity." };
  if (!unitRate || unitRate < 0) return { ok: false, error: "Enter a valid unit rate." };

  const lineTotal = computeLineTotal(qty, unitRate, taxPercent, taxAmount, roundOff);

  const { count } = await supabase
    .from("jetflo_purchase_order_items")
    .select("id", { count: "exact", head: true })
    .eq("purchase_order_id", poId);

  const { error } = await supabase.from("jetflo_purchase_order_items").insert({
    purchase_order_id: poId,
    item_description: itemDescription,
    product_sku: productSku,
    qty,
    unit_rate: unitRate,
    tax_percent: taxPercent,
    tax_amount: taxAmount,
    round_off: roundOff,
    line_total: lineTotal,
    sort_order: count ?? 0,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  revalidatePath(`/finance/purchase-orders/${poId}`);
  return { ok: true };
}

export async function updatePoLineItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const itemId = String(formData.get("item_id") || "").trim();
  const poId = String(formData.get("purchase_order_id") || "").trim();
  if (!itemId) return { ok: false, error: "Line item ID is missing." };

  const itemDescription = String(formData.get("item_description") || "").trim();
  const productSku = String(formData.get("product_sku") || "").trim() || null;
  const qty = Number(formData.get("qty"));
  const unitRate = Number(formData.get("unit_rate"));
  const taxPercent = formData.get("tax_percent") ? Number(formData.get("tax_percent")) : null;
  const taxAmount = formData.get("tax_amount") ? Number(formData.get("tax_amount")) : null;
  const roundOff = formData.get("round_off") ? Number(formData.get("round_off")) : null;

  if (!itemDescription) return { ok: false, error: "Item description is required." };
  if (!qty || qty <= 0) return { ok: false, error: "Enter a valid quantity." };
  if (!unitRate || unitRate < 0) return { ok: false, error: "Enter a valid unit rate." };

  const lineTotal = computeLineTotal(qty, unitRate, taxPercent, taxAmount, roundOff);

  const { error } = await supabase
    .from("jetflo_purchase_order_items")
    .update({
      item_description: itemDescription,
      product_sku: productSku,
      qty,
      unit_rate: unitRate,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      round_off: roundOff,
      line_total: lineTotal,
    })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  revalidatePath(`/finance/purchase-orders/${poId}`);
  return { ok: true };
}

export async function deletePoLineItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const itemId = String(formData.get("item_id") || "").trim();
  const poId = String(formData.get("purchase_order_id") || "").trim();
  if (!itemId) return { ok: false, error: "Line item ID is missing." };

  const { error } = await supabase.from("jetflo_purchase_order_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  revalidatePath(`/finance/purchase-orders/${poId}`);
  return { ok: true };
}

export async function issuePurchaseOrder(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, error: "Purchase order ID is missing." };

  const { data: po } = await supabase.from("jetflo_purchase_orders").select("status, total_value").eq("id", id).single();
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status !== "draft") return { ok: false, error: "This purchase order has already been issued." };
  if (!po.total_value || Number(po.total_value) <= 0) {
    return { ok: false, error: "Add at least one line item before issuing." };
  }

  const threshold = (await setting(supabase, "po_second_approver_above")) || 1000000;
  const targetStatus = Number(po.total_value) > threshold ? "pending_second_approval" : "open";

  const { error } = await supabase.from("jetflo_purchase_orders").update({ status: targetStatus }).eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  revalidatePath("/", "layout");
  return {
    ok: true,
    id,
    warning:
      targetStatus === "pending_second_approval"
        ? "Value above threshold — a different finance user must approve before this PO is usable."
        : undefined,
  };
}

export async function approvePoSecondApproval(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, error: "Purchase order ID is missing." };

  const { data: po } = await supabase.from("jetflo_purchase_orders").select("status, created_by").eq("id", id).single();
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (po.status !== "pending_second_approval") {
    return { ok: false, error: "This purchase order is not awaiting second approval." };
  }
  if (po.created_by === userId) {
    return { ok: false, error: "Second approver must be a different finance user." };
  }

  const { error } = await supabase.from("jetflo_purchase_orders").update({ status: "open" }).eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function cancelPurchaseOrder(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const id = String(formData.get("id") || "").trim();
  if (!id) return { ok: false, error: "Purchase order ID is missing." };

  const { error } = await supabase.from("jetflo_purchase_orders").update({ status: "cancelled" }).eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function amendPurchaseOrder(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { data: profile } = await supabase.from("jetflo_users").select("role").eq("id", userId).single();
  if (profile?.role !== "finance") return { ok: false, error: "Only finance can amend a purchase order." };

  const id = String(formData.get("id") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!id) return { ok: false, error: "Purchase order ID is missing." };
  if (!reason) return { ok: false, error: "Please provide a reason for this amendment." };

  let items: Array<{
    item_description: string;
    product_sku?: string | null;
    qty: number;
    unit_rate: number;
    tax_percent?: number | null;
    tax_amount?: number | null;
    round_off?: number | null;
  }>;
  try {
    items = JSON.parse(String(formData.get("items_json") || "[]"));
  } catch {
    return { ok: false, error: "Could not read the amended line items." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "A purchase order must have at least one line item." };
  }

  const admin = getSupabaseAdmin();

  const { data: po } = await admin
    .from("jetflo_purchase_orders")
    .select("po_number, status, total_value")
    .eq("id", id)
    .single();
  if (!po) return { ok: false, error: "Purchase order not found." };
  if (!["open", "partially_billed", "fully_billed"].includes(po.status)) {
    return { ok: false, error: "Only an issued purchase order can be amended." };
  }

  const { data: linked } = await admin
    .from("jetflo_fund_requests")
    .select("amount_approved")
    .eq("po_id", id)
    .in("status", ["awaiting_second_approval", "approved", "partially_approved", "paid", "closed"]);
  const committed = (linked ?? []).reduce((s, r) => s + Number(r.amount_approved || 0), 0);

  const newLines = items.map((it, i) => {
    const qty = Number(it.qty);
    const unitRate = Number(it.unit_rate);
    const taxPercent = it.tax_percent != null ? Number(it.tax_percent) : null;
    const taxAmount = it.tax_amount != null ? Number(it.tax_amount) : null;
    const roundOff = it.round_off != null ? Number(it.round_off) : null;
    return {
      item_description: String(it.item_description || "").trim(),
      product_sku: it.product_sku || null,
      qty,
      unit_rate: unitRate,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      round_off: roundOff,
      line_total: computeLineTotal(qty, unitRate, taxPercent, taxAmount, roundOff),
      sort_order: i,
    };
  });
  const newTotal = newLines.reduce((s, l) => s + l.line_total, 0);

  if (newTotal < committed) {
    return {
      ok: false,
      error: `This amendment would shrink the purchase order to ₹${newTotal.toLocaleString("en-IN")}, below the ₹${committed.toLocaleString("en-IN")} already approved against it.`,
    };
  }

  await admin.from("jetflo_purchase_order_items").delete().eq("purchase_order_id", id);
  const { error: insErr } = await admin
    .from("jetflo_purchase_order_items")
    .insert(newLines.map((l) => ({ ...l, purchase_order_id: id })));
  if (insErr) return { ok: false, error: insErr.message };

  const auditMemo = `Purchase order amended: value changed from ₹${Number(po.total_value).toLocaleString("en-IN")} to ₹${newTotal.toLocaleString("en-IN")}. Justification: ${reason}`;
  await admin.from("jetflo_audit_log").insert({
    purchase_order_id: id,
    actor_id: userId,
    action: "po_amended",
    remarks: auditMemo,
  });

  revalidatePath(`/finance/purchase-orders/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, id };
}

