// Script to import filled historical records from CSV into Supabase.
// Usage: node scripts/import-records.mjs <path-to-csv-file>
// Example: node scripts/import-records.mjs data/filled_records.csv

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const filePath = process.argv[2] || 'public/jetflo_historical_data_template.csv';

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  console.log('Please provide a valid CSV file path: node scripts/import-records.mjs <file.csv>');
  process.exit(1);
}

function parseCSV(content) {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every((v) => !v.trim())) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    records.push(row);
  }
  return records;
}

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const records = parseCSV(readFileSync(filePath, 'utf8'));
console.log(`Parsed ${records.length} records from ${filePath}`);

// Load users for foreign keys
const { data: users } = await admin.from('jetflo_users').select('id, email, role');
const defaultRequester = users?.find((u) => u.role === 'requester') || users?.[0];
const defaultFinance = users?.find((u) => u.role === 'finance') || users?.[0];

// Load budget heads
const { data: budgetHeads } = await admin.from('jetflo_budget_heads').select('id, category, sub_head');

let importedCount = 0;

for (const r of records) {
  const reqDate = r['Request Date (YYYY-MM-DD)'] || new Date().toISOString().slice(0, 10);
  const rawCat = (r['Category (CAPEX / Raw Material)'] || 'capex').toLowerCase();
  const category = rawCat.includes('raw') ? 'raw_material' : 'capex';
  const subHeadName = r['Sub-Head'] || 'Not Applicable';
  const vendorName = r['Vendor Name'] || 'General Vendor';
  const gstin = r['Vendor GSTIN'] || null;
  const bankName = r['Vendor Bank Name'] || 'HDFC Bank';
  const accountNo = r['Vendor Account No'] || '0000000000';
  const ifsc = r['Vendor IFSC'] || 'HDFC0000123';
  const desc = r['Item Description'] || 'Procurement line item';
  const sku = r['Product SKU (Optional)'] || null;
  const qty = parseFloat(r['Quantity']) || 1;
  const unitRate = parseFloat(r['Unit Rate (INR)']) || null;
  const amountRequested = parseFloat(r['Requested Amount (INR)']) || (unitRate ? qty * unitRate : 1000);
  const amountApproved = parseFloat(r['Approved Amount (INR)']) || amountRequested;
  const rawType = (r['Payment Type (Advance / Against Invoice / Balance)'] || 'against_invoice').toLowerCase();
  let paymentType = 'against_invoice';
  if (rawType.includes('adv')) paymentType = 'advance';
  else if (rawType.includes('bal')) paymentType = 'balance';

  const rawStatus = (r['Status (Paid / Closed / Approved / Rejected / Submitted)'] || 'paid').toLowerCase();
  
  let status = 'paid';
  if (rawStatus.includes('close')) status = 'closed';
  else if (rawStatus.includes('reject')) status = 'rejected';
  else if (rawStatus.includes('submit')) status = 'submitted';
  else if (rawStatus.includes('draft')) status = 'draft';
  else if (rawStatus.includes('appr')) status = 'approved';

  const goodsReceived = (r['Goods Received / Advance Settled (Yes / No)'] || '').toLowerCase().includes('y') || status === 'closed';

  const payDate = r['Payment Date (YYYY-MM-DD)'] || reqDate;
  const amountPaid = parseFloat(r['Amount Paid (INR)']) || (['paid', 'closed'].includes(status) ? amountApproved : 0);
  const payMode = (r['Payment Mode (NEFT / RTGS / IMPS / UPI / Cheque)'] || 'rtgs').toLowerCase();
  const utrRef = r['Bank UTR / Reference No'] || `UTR${Date.now()}`;
  const userEmail = (r['Requester Email (e.g. raju.r@claromfg.com)'] || '').toLowerCase();
  const requester = users?.find((u) => u.email.toLowerCase() === userEmail) || defaultRequester;
  const remarks = r['Remarks / PO Number'] || '';

  // 1. Ensure Vendor exists
  let vendorId;
  const { data: existingVendor } = await admin
    .from('jetflo_vendors')
    .select('id')
    .ilike('name', vendorName)
    .maybeSingle();

  if (existingVendor) {
    vendorId = existingVendor.id;
  } else {
    const { data: newVendor, error: vErr } = await admin
      .from('jetflo_vendors')
      .insert({
        name: vendorName,
        gstin,
        bank_name: bankName,
        account_no: accountNo,
        ifsc,
        category: 'both',
        active: true,
      })
      .select('id')
      .single();
    if (vErr) {
      console.error(`Error inserting vendor ${vendorName}:`, vErr.message);
      continue;
    }
    vendorId = newVendor.id;
  }

  // 2. Match Budget Head
  let budgetHeadId = budgetHeads?.find(
    (b) => b.category === category && b.sub_head.toLowerCase() === subHeadName.toLowerCase()
  )?.id;

  if (!budgetHeadId) {
    const { data: newHead } = await admin
      .from('jetflo_budget_heads')
      .insert({ category, sub_head: subHeadName, active: true })
      .select('id')
      .single();
    budgetHeadId = newHead?.id || budgetHeads?.[0]?.id;
  }

  // 3. Generate Request Number using database sequence
  const seqName = category === 'capex' ? 'jetflo_seq_cap' : 'jetflo_seq_rm';
  const prefix = category === 'capex' ? 'JF-CAP' : 'JF-RM';
  const { data: seqVal } = await admin.rpc('get_next_seq', { seq_name: seqName }).maybeSingle();
  const nextNum = seqVal || (importedCount + 1);
  const requestNo = `${prefix}-${String(nextNum).padStart(4, '0')}`;

  const createdTimestamp = new Date(`${reqDate}T10:00:00Z`).toISOString();
  const decidedTimestamp = ['approved', 'paid', 'closed'].includes(status)
    ? new Date(`${reqDate}T14:00:00Z`).toISOString()
    : null;
  const firstPaidTimestamp = ['paid', 'closed'].includes(status)
    ? new Date(`${payDate}T11:30:00Z`).toISOString()
    : null;

  // 4. Insert Fund Request
  const { data: reqRow, error: reqErr } = await admin
    .from('jetflo_fund_requests')
    .insert({
      request_no: requestNo,
      category,
      budget_head_id: budgetHeadId,
      vendor_id: vendorId,
      item_description: desc,
      product_sku: sku,
      qty,
      unit_rate: unitRate,
      amount_requested: amountRequested,
      amount_approved: amountApproved,
      amount_paid: amountPaid,
      status,
      payment_type: paymentType,
      goods_received: goodsReceived,
      justification: remarks,
      requester_id: requester.id,
      approved_by: ['approved', 'paid', 'closed'].includes(status) ? defaultFinance.id : null,
      created_at: createdTimestamp,
      submitted_at: createdTimestamp,
      decided_at: decidedTimestamp,
      first_paid_at: firstPaidTimestamp,
      closed_at: status === 'closed' ? firstPaidTimestamp : null,
    })
    .select('id')
    .single();

  if (reqErr) {
    console.error(`Error inserting request ${requestNo}:`, reqErr.message);
    continue;
  }

  // 5. Insert Payment if settled
  if (amountPaid > 0 && ['paid', 'closed'].includes(status)) {
    await admin.from('jetflo_payments').insert({
      request_id: reqRow.id,
      amount_paid: amountPaid,
      paid_on: payDate,
      mode: ['neft', 'rtgs', 'imps', 'upi', 'cheque', 'cash'].includes(payMode) ? payMode : 'rtgs',
      bank: 'HDFC Bank — Claro Manufacturing Pvt. Ltd.',
      utr_ref: utrRef,
      recorded_by: defaultFinance.id,
      created_at: firstPaidTimestamp,
    });
  }

  importedCount++;
  console.log(`✓ Imported [${requestNo}] ${desc.slice(0, 30)} - ₹${amountRequested.toLocaleString('en-IN')}`);
}

console.log(`\nSuccessfully imported ${importedCount} historical records!`);
