"use server";

import { getSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ActionResult = { ok: boolean; error?: string; warning?: string; id?: string };

async function ctx() {
  const supabase = await getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
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
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${requestId}/${kind}-${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("jetflo-docs").upload(path, file);
  if (error) return `Upload failed: ${error.message}`;
  const { error: e2 } = await supabase.from("jetflo_attachments").insert({
    request_id: requestId,
    kind,
    storage_path: path,
    file_name: file.name,
    uploaded_by: userId,
  });
  if (e2) return `Attachment record failed: ${e2.message}`;
  return null;
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
  const { supabase, userId } = await ctx();
  const intent = String(formData.get("intent")); // draft | submit
  const amount = Number(formData.get("amount_requested"));
  const vendorId = String(formData.get("vendor_id"));
  if (!amount || amount <= 0) return { ok: false, error: "Enter a valid amount" };

  const quotation = formData.get("quotation") as File | null;
  if (intent === "submit") {
    const quotationAbove = await setting(supabase, "quotation_mandatory_above");
    if (amount > quotationAbove && (!quotation || quotation.size === 0)) {
      return {
        ok: false,
        error: `A quotation attachment is mandatory for requests above ₹${quotationAbove.toLocaleString("en-IN")}. Attach one or save as draft.`,
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

  const qty = formData.get("qty") ? Number(formData.get("qty")) : null;
  const rate = formData.get("unit_rate") ? Number(formData.get("unit_rate")) : null;

  const { data: inserted, error } = await supabase
    .from("jetflo_fund_requests")
    .insert({
      category: String(formData.get("category")),
      budget_head_id: String(formData.get("budget_head_id")),
      vendor_id: vendorId,
      item_description: String(formData.get("item_description")),
      product_sku: String(formData.get("product_sku") || "") || null,
      qty,
      unit_rate: rate,
      amount_requested: amount,
      urgency: String(formData.get("urgency")),
      need_by_date: String(formData.get("need_by_date") || "") || null,
      payment_type: String(formData.get("payment_type")),
      justification: String(formData.get("justification") || "") || null,
      status: "draft",
      requester_id: userId,
      duplicate_warning: isDupe,
    })
    .select("id, request_no")
    .single();
  if (error) return { ok: false, error: error.message };

  if (quotation && quotation.size > 0) {
    const upErr = await uploadAttachment(supabase, userId, inserted.id, "quotation", quotation);
    if (upErr) return { ok: false, error: upErr };
  }

  if (intent === "submit") {
    const { error: e2 } = await supabase
      .from("jetflo_fund_requests")
      .update({ status: "submitted" })
      .eq("id", inserted.id);
    if (e2) return { ok: false, error: e2.message };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    id: inserted.id,
    warning: isDupe
      ? `Possible duplicate: a similar request to this vendor was raised in the last ${windowDays} days (${dupes!.map((d) => d.request_no).join(", ")}). Finance will see this flag.`
      : undefined,
  };
}

export async function submitRequest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
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

  const { error } = await supabase.from("jetflo_fund_requests").update({ status: "submitted" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function financeDecide(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase } = await ctx();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")); // approve | partial | reject | send_back
  const remarks = String(formData.get("remarks") || "").trim();

  const { data: req } = await supabase
    .from("jetflo_fund_requests")
    .select("status, amount_requested, amount_approved")
    .eq("id", id)
    .single();
  if (!req) return { ok: false, error: "Request not found" };

  let update: Record<string, unknown> = {};

  if (decision === "reject") {
    if (!remarks) return { ok: false, error: "A rejection reason is required" };
    update = { status: "rejected", rejection_reason: remarks };
  } else if (decision === "send_back") {
    if (!remarks) return { ok: false, error: "Remarks are required when sending back" };
    update = { status: "sent_back", approval_remarks: remarks };
  } else {
    const amount =
      req.status === "awaiting_second_approval"
        ? Number(req.amount_approved)
        : Number(formData.get("amount_approved") || req.amount_requested);
    if (!amount || amount <= 0) return { ok: false, error: "Enter a valid approved amount" };
    const isPartial = decision === "partial" || amount < Number(req.amount_requested);
    if (isPartial && !remarks) return { ok: false, error: "Remarks are required for partial approval" };

    const threshold = await setting(supabase, "second_approver_above");
    if (req.status === "submitted" && amount > threshold) {
      update = {
        status: "awaiting_second_approval",
        amount_approved: amount,
        approval_remarks: remarks || `Above ₹${threshold.toLocaleString("en-IN")} — second approval required`,
      };
    } else {
      update = {
        status: isPartial ? "partially_approved" : "approved",
        amount_approved: amount,
        approval_remarks: remarks || null,
      };
    }
  }

  const { error } = await supabase.from("jetflo_fund_requests").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };
  revalidatePath("/", "layout");
  return {
    ok: true,
    warning:
      update.status === "awaiting_second_approval"
        ? "Above the approval limit — parked for a second finance approver."
        : undefined,
  };
}

export async function recordPayment(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const requestId = String(formData.get("id"));
  const amount = Number(formData.get("amount_paid"));
  if (!amount || amount <= 0) return { ok: false, error: "Enter a valid amount" };

  const { error } = await supabase.from("jetflo_payments").insert({
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

  const invoice = formData.get("invoice") as File | null;
  if (invoice && invoice.size > 0) {
    const upErr = await uploadAttachment(supabase, userId, id, "invoice", invoice);
    if (upErr) return { ok: false, error: upErr };
  } else {
    const { data: atts } = await supabase
      .from("jetflo_attachments")
      .select("id")
      .eq("request_id", id)
      .in("kind", ["invoice", "grn"]);
    if (!atts?.length) return { ok: false, error: "Upload the final invoice / GRN to close this request" };
  }

  const { error } = await supabase
    .from("jetflo_fund_requests")
    .update({ status: "closed", goods_received: true })
    .eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- masters ----------

export async function addVendor(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, userId } = await ctx();
  const { error } = await supabase.from("jetflo_vendors").insert({
    name: String(formData.get("name")),
    gstin: String(formData.get("gstin") || "") || null,
    bank_name: String(formData.get("bank_name") || "") || null,
    account_no: String(formData.get("account_no") || "") || null,
    ifsc: String(formData.get("ifsc") || "") || null,
    category: String(formData.get("category")),
    created_by: userId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
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
  const { supabase, userId } = await ctx();
  const id = String(formData.get("id"));
  const intent = String(formData.get("intent"));
  const amount = Number(formData.get("amount_requested"));
  if (!amount || amount <= 0) return { ok: false, error: "Enter a valid amount" };

  const { error } = await supabase
    .from("jetflo_fund_requests")
    .update({
      category: String(formData.get("category")),
      budget_head_id: String(formData.get("budget_head_id")),
      vendor_id: String(formData.get("vendor_id")),
      item_description: String(formData.get("item_description")),
      product_sku: String(formData.get("product_sku") || "") || null,
      qty: formData.get("qty") ? Number(formData.get("qty")) : null,
      unit_rate: formData.get("unit_rate") ? Number(formData.get("unit_rate")) : null,
      amount_requested: amount,
      urgency: String(formData.get("urgency")),
      need_by_date: String(formData.get("need_by_date") || "") || null,
      payment_type: String(formData.get("payment_type")),
      justification: String(formData.get("justification") || "") || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

  const quotation = formData.get("quotation") as File | null;
  if (quotation && quotation.size > 0) {
    const upErr = await uploadAttachment(supabase, userId, id, "quotation", quotation);
    if (upErr) return { ok: false, error: upErr };
  }

  if (intent === "submit") {
    const quotationAbove = await setting(supabase, "quotation_mandatory_above");
    if (amount > quotationAbove) {
      const { data: atts } = await supabase
        .from("jetflo_attachments")
        .select("id")
        .eq("request_id", id)
        .in("kind", ["quotation", "proforma"]);
      if (!atts?.length)
        return { ok: false, error: "Attach a quotation/proforma before submitting (mandatory above threshold)." };
    }
    const { error: e2 } = await supabase
      .from("jetflo_fund_requests")
      .update({ status: "submitted" })
      .eq("id", id);
    if (e2) return { ok: false, error: e2.message.replace(/^.*?exception:\s*/i, "") };
  }
  revalidatePath("/", "layout");
  return { ok: true, id };
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

  // Use service role admin client to guarantee atomic settings update
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const item of updates) {
    const { error } = await admin
      .from("jetflo_settings")
      .update({ value: item.value })
      .eq("key", item.key);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

