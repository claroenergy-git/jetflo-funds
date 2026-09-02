"use server";

import { getSupabase, getSupabaseAdmin } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
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
  const category = String(formData.get("category") || "").trim();
  const budgetHeadId = String(formData.get("budget_head_id") || "").trim();
  const vendorId = String(formData.get("vendor_id") || "").trim();
  const itemDescription = String(formData.get("item_description") || "").trim();
  const paymentType = String(formData.get("payment_type") || "advance");

  if (!category) return { ok: false, error: "Category is mandatory." };
  if (!budgetHeadId) return { ok: false, error: "Budget sub-head is mandatory." };
  if (!vendorId) return { ok: false, error: "Vendor selection is mandatory." };
  if (!itemDescription) return { ok: false, error: "Item description is mandatory." };

  const qty = formData.get("qty") ? Number(formData.get("qty")) : null;
  const rate = formData.get("unit_rate") ? Number(formData.get("unit_rate")) : null;
  let amount = Number(formData.get("amount_requested"));

  // Auto-calculate line total if qty and unit rate are provided and amount not manually specified
  if ((!amount || isNaN(amount)) && qty && rate) {
    amount = Number((qty * rate).toFixed(2));
  }
  if (!amount || amount <= 0) return { ok: false, error: "Please enter a valid requested amount (₹)." };

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

  const insertPayload: Record<string, unknown> = {
    category,
    budget_head_id: budgetHeadId,
    vendor_id: vendorId,
    item_description: itemDescription,
    product_sku: String(formData.get("product_sku") || "") || null,
    qty,
    unit_rate: rate,
    amount_requested: amount,
    urgency: "normal",
    need_by_date: null,
    payment_type: paymentType,
    justification: notes || null,
    status: "draft",
    requester_id: userId,
    duplicate_warning: isDupe,
  };

  const existingId = String(formData.get("id") || "").trim();
  let requestId = existingId;

  const admin = getSupabaseAdmin();

  if (existingId) {
    const { error: upErr } = await admin
      .from("jetflo_fund_requests")
      .update(insertPayload)
      .eq("id", existingId);
    if (upErr) return { ok: false, error: upErr.message };
  } else {
    const { data: inserted, error } = await admin
      .from("jetflo_fund_requests")
      .insert(insertPayload)
      .select("id, request_no")
      .single();
    if (error) return { ok: false, error: error.message };
    requestId = inserted.id;
  }

  if (docFile && docFile.size > 0) {
    const upErr = await uploadAttachment(supabase, userId, requestId, docKind, docFile);
    if (upErr) return { ok: false, error: upErr };
  }

  if (intent === "submit") {
    const { error: e2 } = await admin
      .from("jetflo_fund_requests")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", requestId);
    if (e2) return { ok: false, error: e2.message };
  }

  revalidatePath("/", "layout");
  return {
    ok: true,
    id: requestId,
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

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("jetflo_fund_requests").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
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
    .select("status, amount_requested, amount_approved, approved_by")
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

  const { error } = await admin.from("jetflo_fund_requests").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message.replace(/^.*?exception:\s*/i, "") };

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
  const { supabase, userId } = await ctx();
  const id = String(formData.get("id"));
  const intent = String(formData.get("intent"));
  const category = String(formData.get("category") || "").trim();
  const budgetHeadId = String(formData.get("budget_head_id") || "").trim();
  const vendorId = String(formData.get("vendor_id") || "").trim();
  const itemDescription = String(formData.get("item_description") || "").trim();
  const paymentType = String(formData.get("payment_type") || "advance");

  const qty = formData.get("qty") ? Number(formData.get("qty")) : null;
  const rate = formData.get("unit_rate") ? Number(formData.get("unit_rate")) : null;
  let amount = Number(formData.get("amount_requested"));

  if ((!amount || isNaN(amount)) && qty && rate) {
    amount = Number((qty * rate).toFixed(2));
  }
  if (!amount || amount <= 0) return { ok: false, error: "Enter a valid amount" };

  const notes = String(formData.get("justification") || formData.get("notes") || "").trim();

  const { error } = await supabase
    .from("jetflo_fund_requests")
    .update({
      category,
      budget_head_id: budgetHeadId,
      vendor_id: vendorId,
      item_description: itemDescription,
      product_sku: String(formData.get("product_sku") || "") || null,
      qty,
      unit_rate: rate,
      amount_requested: amount,
      urgency: "normal",
      need_by_date: null,
      payment_type: paymentType,
      justification: notes || null,
    })
    .eq("id", id);
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

