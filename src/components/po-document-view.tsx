"use client";

import Image from "next/image";
import Link from "next/link";
import { fmtMoney, fmtDate, amountToWords } from "@/lib/format";
import { formatPaymentTerms } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface PoDocumentViewProps {
  po: any;
  items: any[];
  showActions?: boolean;
}

export function PoDocumentView({ po, items, showActions = true }: PoDocumentViewProps) {
  const isDraft = po.status === "draft";
  const currency = po.currency || "INR";
  const totalValue = Number(po.total_value || 0);

  const cleanNum = (po.po_number || "Draft-PO").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanVendor = (po.vendor?.name || "Vendor").replace(/[^a-zA-Z0-9_-]/g, "_");
  const downloadFilename = `PO_${cleanNum}_${cleanVendor}.pdf`;

  // Compute item subtotal & taxes
  const subtotalBeforeTax = items.reduce((sum, item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.unit_rate || 0);
    return sum + qty * rate;
  }, 0);

  const totalTax = items.reduce((sum, item) => {
    return sum + Number(item.tax_amount || 0);
  }, 0);

  // Average tax percent or highest
  const taxPct = items.find((i) => i.tax_percent != null)?.tax_percent ?? (subtotalBeforeTax > 0 ? ((totalTax / subtotalBeforeTax) * 100).toFixed(0) : "18");

  const vendor = po.vendor || {};
  const vendorAddress = [vendor.address_line, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(", ") || "Industrial Area, Registered Vendor Address";

  const plantAddressMap: Record<string, string> = {
    "Hyderabad Plant": "Sy no- 526/1, Yerramareddipalem Village, Near Settipalli Industrial Area, Renigunda, Dist- Tirupati Balaji, Andhra Pradesh - 517520",
    "Coimbatore Plant": "SF No. 342/2, Near L&T Bypass, Chettipalayam Road, Eachanari Post, Coimbatore, Tamil Nadu - 641021",
    "Solar Pump Project Site": "C/O MVR Warehousing, D No: 4-28-1, Inamadugu Center, Beside RTC Zonal Workshop, Padugupadu, Kovur, SPSR Nellore, Andhra Pradesh - 524137",
    "Central Warehouse": "Kesavulu Naidu Warehouse, Lakshmaiah Kandriga Village, Yadamari Mandal, Chittoor District, Andhra Pradesh - 517128",
  };

  const deliveryAddress = plantAddressMap[po.destination_plant] || (po.destination_plant ? `${po.destination_plant}, Factory/Site Operations, India` : plantAddressMap["Hyderabad Plant"]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar (hidden in print) */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#e5decb] shadow-sm print:hidden">
          <div className="flex items-center gap-3">
            <Link
              href={`/finance/purchase-orders/${po.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-[#d5cbba] text-[#1e3e30] bg-[#fbf9f4] hover:bg-[#efe9dc] transition"
            >
              ← Back to PO Dashboard
            </Link>
            <div>
              <span className="text-xs font-bold text-[#14261c]">{po.po_number || "Draft PO"}</span>
              <span className="text-xs text-[#536658] ml-2">({vendor.name})</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/purchase-orders/${po.id}/pdf`}
              download={downloadFilename}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1e3e30] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#2d5a44] transition cursor-pointer"
            >
              <span>📥</span>
              Download PDF File
            </a>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d5cbba] bg-[#fbf9f4] px-4 py-2.5 text-xs font-bold text-[#1e3e30] hover:bg-[#efe9dc] transition cursor-pointer"
              title="Open System Print Dialog"
            >
              <span>🖨️</span> Print
            </button>
          </div>
        </div>
      )}

      {/* Official Printable PO Document Body */}
      <div className="bg-white text-black p-6 sm:p-10 rounded-2xl border border-[#d5cbba] shadow-sm font-sans max-w-4xl mx-auto print:p-0 print:border-none print:shadow-none print:max-w-none print:rounded-none">
        {/* ================= PAGE 1: PURCHASE ORDER ================= */}
        <div id="po-doc-page-1" className="border border-black bg-white">
          {/* Header 3-Column Grid */}
          <div className="grid grid-cols-[1.2fr_1fr_1.1fr] border-b border-black text-xs">
            {/* Registered Office */}
            <div className="p-3 border-r border-black flex flex-col justify-center">
              <div className="font-bold text-[11px] uppercase tracking-wide">Registered Office</div>
              <div className="font-extrabold text-sm text-[#14261c] mt-0.5">Claro Manufacturing Pvt. Ltd.</div>
              <div className="text-[11px] leading-snug mt-1 text-gray-700">
                (JetFlo Funds & Procurement Division)<br />
                D-196, 2nd Floor, Saket,<br />
                New Delhi - 110017
              </div>
            </div>

            {/* Central Brand Badge */}
            <div className="p-2 border-r border-black flex items-center justify-center text-center bg-white">
              <Image
                src="/jetflo-logo-trimmed.png"
                alt="JetFlo by Claro Energy"
                width={150}
                height={71}
                className="max-h-12 w-auto object-contain"
                priority
              />
            </div>

            {/* PO Details Box */}
            <div className="p-3 flex flex-col justify-center">
              <div className="font-black text-sm uppercase tracking-wider text-center border-b border-black pb-1 mb-1.5">
                PURCHASE ORDER
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                <span className="font-bold">PO No.:</span>
                <span className="font-mono font-extrabold">{po.po_number || (isDraft ? "DRAFT-PO" : "CE/09/062")}</span>
                <span className="font-bold">Date:</span>
                <span className="font-semibold">{fmtDate(po.order_date || po.issued_at || po.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Tax Details & Addresses */}
          <div className="grid grid-cols-2 border-b border-black text-xs">
            {/* Tax Details & Billing */}
            <div className="p-3 border-r border-black space-y-2">
              <div>
                <span className="font-bold uppercase tracking-wider text-[11px]">TAX DETAILS:</span>
                <div className="mt-0.5 leading-snug">
                  <div><strong>GST No:</strong> 37AAECC3356Q1Z5</div>
                  <div><strong>PAN No:</strong> AAECC3356Q</div>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <span className="font-bold uppercase tracking-wider text-[11px]">Billing Address:</span>
                <div className="mt-0.5 leading-snug text-gray-800">
                  11-172, Om Sri Shirdi Sai Nilayam,<br />
                  Chaparala Vari Street, Vijayawada,<br />
                  Dist- NTR, Andhra Pradesh - 520007
                </div>
              </div>
            </div>

            {/* Delivery Plant & Contact */}
            <div className="p-3 space-y-2">
              <div>
                <span className="font-bold uppercase tracking-wider text-[11px]">Delivery Address & Site:</span>
                <div className="mt-0.5 leading-snug text-gray-800">
                  <strong>Destination:</strong> {po.destination_plant || "Hyderabad Plant"}<br />
                  {deliveryAddress}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 text-xs">
                <strong>Contact Person:</strong> Leela (8074228359) / Operations Desk
              </div>
            </div>
          </div>

          {/* Vendor Details */}
          <div className="p-3 border-b border-black text-xs leading-relaxed bg-gray-50/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="font-black text-sm text-[#14261c]">{vendor.name || "Alpex Solar Limited"}</div>
                {vendor.trade_name && vendor.trade_name !== vendor.name && (
                  <div className="text-[11px] text-gray-600 font-semibold">{vendor.trade_name}</div>
                )}
                <div className="text-gray-700 mt-0.5">{vendorAddress}</div>
                <div className="mt-1">
                  <span><strong>GST:</strong> {vendor.gstin || "09AABCA0842N1ZM"}</span>
                  <span className="ml-4"><strong>PAN:</strong> {vendor.pan || "AABCA0842N"}</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div><strong>Attn:</strong> {vendor.contact_person || "Aviral Kumar"}</div>
                <div><strong>Mobile:</strong> {vendor.phone || "+91 8130209287"}</div>
                <div><strong>Email:</strong> {vendor.email || "aviral.kumar@alpex.in"}</div>
                {po.reference_no && <div><strong>Quote Ref:</strong> {po.reference_no}</div>}
              </div>
            </div>
          </div>

          {/* Salutation & Scope Introduction */}
          <div className="p-3 border-b border-black text-xs leading-relaxed">
            <p className="font-bold">Dear Sir,</p>
            <p className="mt-1">
              With reference to our discussion through email and your approved quotation/commercial offer, we are pleased to
              place our purchase order for supply of{" "}
              <strong>
                {items[0]?.item_description || "Required Solar & Industrial Equipment / Materials"}
              </strong>
              , the terms and conditions are given below:
            </p>
          </div>

          {/* Itemized Line Items Table */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-black bg-gray-100 font-bold text-center">
                <th className="border-r border-black p-2 w-12">Sr No</th>
                <th className="border-r border-black p-2 text-left">Material Description & Specification</th>
                <th className="border-r border-black p-2 w-20">Qty</th>
                <th className="border-r border-black p-2 w-16">Unit</th>
                <th className="border-r border-black p-2 text-right w-28">Rate ({currency})</th>
                <th className="p-2 text-right w-32">Total ({currency})</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500 italic">
                    No line items specified.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const qty = Number(item.qty || 0);
                  const rate = Number(item.unit_rate || 0);
                  const total = qty * rate;
                  return (
                    <tr key={item.id || idx} className="border-b border-black">
                      <td className="border-r border-black p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border-r border-black p-2">
                        <div className="font-bold text-[#14261c]">{item.item_description}</div>
                        {item.product_sku && (
                          <div className="text-[10px] text-gray-600 font-mono">SKU: {item.product_sku}</div>
                        )}
                      </td>
                      <td className="border-r border-black p-2 text-center font-semibold">
                        {qty.toLocaleString("en-IN")}
                      </td>
                      <td className="border-r border-black p-2 text-center text-gray-700">Nos</td>
                      <td className="border-r border-black p-2 text-right tabular-nums">
                        {rate.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-right font-bold tabular-nums">
                        {total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Tax & Grand Total Rows */}
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r border-black p-2 text-right font-bold text-gray-700">
                  Subtotal:
                </td>
                <td colSpan={2} className="p-2 text-right font-bold tabular-nums">
                  {fmtMoney(subtotalBeforeTax, currency)}
                </td>
              </tr>
              <tr className="border-b border-black bg-gray-50/50">
                <td colSpan={4} className="border-r border-black p-2 text-right font-bold">
                  Tax ({taxPct}% GST):
                </td>
                <td colSpan={2} className="p-2 text-right font-bold tabular-nums">
                  {fmtMoney(totalTax, currency)}
                </td>
              </tr>
              <tr className="border-b border-black bg-gray-100 font-extrabold text-sm">
                <td colSpan={4} className="border-r border-black p-2 text-right uppercase tracking-wider text-[#1e3e30]">
                  Total Amount:
                </td>
                <td colSpan={2} className="p-2 text-right font-black tabular-nums text-[#14261c]">
                  {fmtMoney(totalValue, currency)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words */}
          <div className="p-2.5 border-b border-black text-xs font-semibold bg-gray-50">
            <strong>Amount in words :</strong> {amountToWords(totalValue, currency)}
          </div>

          {/* Special Conditions Note & Instructions */}
          <div className="grid grid-cols-2 border-b border-black text-xs">
            <div className="p-3 border-r border-black space-y-2">
              <div className="font-bold">• Special conditions as given in &ldquo;Annexure-I&rdquo;.</div>
              <div>
                <span className="font-bold uppercase text-[11px]">Special Instructions:</span>
                <ul className="list-disc pl-4 mt-1 space-y-1 text-gray-800 text-[11px]">
                  <li>Bill / Challan must bear the Purchase Order Reference & our tax details.</li>
                  <li>All original dispatch documents to be sent to our Corporate Office Delhi.</li>
                  <li>For any enquiry, please quote Purchase Order Reference and contact Operations Manager.</li>
                </ul>
              </div>
            </div>

            {/* Authorised Signatory Block */}
            <div className="p-3 flex flex-col justify-between text-center min-h-[140px]">
              <div className="font-bold text-xs uppercase tracking-wider">For Claro Manufacturing Pvt. Ltd.</div>
              <div className="my-2">
                <div className="font-serif italic text-base text-[#1e3e30] font-bold">Gaurav Kumar</div>
                <div className="text-[10px] text-gray-600 font-semibold">(Director / Auth. Signatory)</div>
              </div>
              <div className="font-black text-[11px] uppercase tracking-widest">(AUTHORISED SIGNATORY)</div>
            </div>
          </div>
        </div>

        {/* Page Break for Official Print Format */}
        <div className="my-10 border-t-2 border-dashed border-gray-300 print:page-break-before print:border-none print:my-0" />

        {/* ================= PAGE 2 & 3: ANNEXURE – I ================= */}
        <div id="po-doc-page-2" className="border border-black p-6 sm:p-8 space-y-4 text-xs leading-relaxed text-gray-900 mt-8 print:mt-0 print:border-black bg-white">
          <div className="text-center font-black text-base uppercase tracking-wider border-b-2 border-black pb-2">
            ANNEXURE – I
          </div>

          <div className="flex justify-between items-center text-xs border-b border-gray-300 pb-2">
            <div><strong>PO No.:</strong> <span className="font-mono font-bold">{po.po_number || "CE/09/062"}</span></div>
            <div><strong>Date:</strong> {fmtDate(po.order_date || po.issued_at || po.created_at)}</div>
          </div>

          <div className="font-extrabold uppercase tracking-wide text-xs underline decoration-2 underline-offset-4 pt-1">
            SPECIAL CONDITIONS: -
          </div>

          {/* Definitions */}
          <div className="bg-gray-50 p-2.5 rounded border border-gray-200">
            <div className="font-bold uppercase text-[11px]">Definitions:</div>
            <div className="mt-1 space-y-0.5">
              <div><strong>BUYER :</strong> Claro Manufacturing Pvt. Ltd. (JetFlo Funds)</div>
              <div><strong>SELLER :</strong> {vendor.name || "Vendor Partner"}</div>
            </div>
          </div>

          {/* 13 Standard Legal Clauses from Sample Document */}
          <div className="space-y-3.5 pt-2">
            <div>
              <h4 className="font-bold text-xs">1. Scope of Work</h4>
              <p className="mt-0.5 text-gray-800">
                Goods and materials must be supplied strictly as per technical specifications, quality standards, and industry guidelines laid down by SECI / MNRE Guidelines and tender requirements.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">2. Prices</h4>
              <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-gray-800">
                <li>PO value is INR <strong>{fmtMoney(totalValue, currency)}/-</strong> (FOR destination).</li>
                <li>Cost is inclusive of applicable GST unless explicitly broken out.</li>
                <li>Freight and transit insurance included in unit price.</li>
                <li>
                  <strong>The rates given in the order are firm and not subject to any escalation</strong> whatever may be the reason for the entire project, however the quantity may be increased or decreased as per project requirement.
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xs">3. Terms of Payment</h4>
              <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-gray-800">
                <li>{formatPaymentTerms(po.payment_terms)} (Dispatch clearance given lot-wise upon quality approval).</li>
                <li>Seller will be eligible for milestone disbursement only after submitting complete dispatch dossiers and warranty certificates.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-xs">4. Delivery</h4>
              <p className="mt-0.5 text-gray-800">
                The Vendor shall dispatch material on or before <strong>{fmtDate(po.expected_delivery_date) || "agreed schedule"}</strong> from the date of PO (Dispatch clearance) to our site ({po.destination_plant || "designated plant warehouse"}). Freight charges inclusive.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">5. Warranty / Guarantee</h4>
              <p className="mt-0.5 text-gray-800">
                You shall ensure that the components supplied by you shall be new and of first-class workmanship, of suitable design and free from defects. In case any manufacturing defect is noticed, you shall send your service personnel to site immediately (within 7 days of notice). Rectification or replacement shall be completely at your cost.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">6. Loading & Unloading</h4>
              <p className="mt-0.5 text-gray-800">
                Proper and safe handling of material with wooden pallets/support required. Loading charges at vendor end will be borne by vendor; unloading at Claro site warehouse to Claro account.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">7. Packing & Identification</h4>
              <p className="mt-0.5 text-gray-800">
                Material must be covered with suitable heavy tarpaulin/plastic sheets and strapped as per specifications to prevent transit ingress or damages.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">8. Inspection</h4>
              <p className="mt-0.5 text-gray-800">
                Claro reserves the right to conduct Pre-Dispatch Inspection (PDI) at works. Any rejected components must be replaced immediately by vendor prior to transit.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">9. Dispatch</h4>
              <p className="mt-0.5 text-gray-800">
                Vendor shall dispatch through reputed transporters with complete statutory documents including Tax Invoices, e-Way bills, and Delivery Challans.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">10. Termination of Order</h4>
              <p className="mt-0.5 text-gray-800">
                Claro reserves the right to terminate this order or any portion thereof without assigning any reason whatsoever in case of default or material delay.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">11. Transit Insurance</h4>
              <p className="mt-0.5 text-gray-800">
                Any damage or sub-standard material noticed upon arrival will be replaced at the sole cost of vendor under vendor scope.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">12. Applicable Law</h4>
              <p className="mt-0.5 text-gray-800">
                This purchase order shall be governed by and construed in accordance with the Laws of Republic of India and subjected to the exclusive jurisdiction of Courts in Delhi, India.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-xs">13. Delay Clause</h4>
              <p className="mt-0.5 text-gray-800">
                If the supplier fails to provide the material within agreed frame of time, penalty of 0.5% per week applies, capped at a maximum of 5% (five percent) of total order cost.
              </p>
            </div>
          </div>

          {/* Dual Authorization Signatures */}
          <div className="pt-8 border-t border-black grid grid-cols-2 gap-8 text-center text-xs">
            <div className="flex flex-col justify-end space-y-2">
              <div className="font-bold uppercase tracking-wider">For Claro Manufacturing Pvt. Ltd.</div>
              <div className="font-serif italic text-base font-bold text-[#1e3e30]">Gaurav Kumar</div>
              <div className="font-bold text-[11px] uppercase tracking-wider">(Authorized Signatory)</div>
            </div>

            <div className="flex flex-col justify-end space-y-2">
              <div className="font-bold uppercase tracking-wider">Accepted Unconditionally</div>
              <div className="h-6 border-b border-dashed border-gray-400 mx-auto w-3/4" />
              <div className="font-bold text-[11px] uppercase tracking-wider">(Authorized Signatory / Vendor)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
