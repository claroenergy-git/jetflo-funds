import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { amountToWords, fmtDate, fmtMoney } from "./format";

import fs from "fs";
import path from "path";

/* eslint-disable @typescript-eslint/no-explicit-any */

let cachedLogoBase64: string | null = null;
function getLogoBase64(): string | null {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const p = path.join(process.cwd(), "public", "jetflo-logo-trimmed.png");
    if (fs.existsSync(p)) {
      cachedLogoBase64 = fs.readFileSync(p).toString("base64");
      return cachedLogoBase64;
    }
  } catch (e) {
    console.error("Failed to read logo image:", e);
  }
  return null;
}

const PLANT_ADDRESS_MAP: Record<string, string> = {
  "Hyderabad Plant": "Sy no- 526/1, Yerramareddipalem Village, Near Settipalli Industrial Area, Renigunda, Dist- Tirupati Balaji, Andhra Pradesh - 517520",
  "Coimbatore Plant": "SF No. 342/2, Near L&T Bypass, Chettipalayam Road, Eachanari Post, Coimbatore, Tamil Nadu - 641021",
  "Solar Pump Project Site": "C/O MVR Warehousing, D No: 4-28-1, Inamadugu Center, Beside RTC Zonal Workshop, Padugupadu, Kovur, SPSR Nellore, Andhra Pradesh - 524137",
  "Central Warehouse": "Kesavulu Naidu Warehouse, Lakshmaiah Kandriga Village, Yadamari Mandal, Chittoor District, Andhra Pradesh - 517128",
};

export function generatePurchaseOrderPdf(po: any, items: any[]): Buffer {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2; // 190mm

  // Outer Page 1 Border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.35);
  doc.rect(margin, margin, contentWidth, 277);

  // Header horizontal line
  doc.line(margin, 38, margin + contentWidth, 38);
  // Header vertical columns
  doc.line(margin + 70, margin, margin + 70, 38);
  doc.line(margin + 125, margin, margin + 125, 38);

  // Top Left: Registered Office
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("REGISTERED OFFICE", margin + 3, margin + 5);
  doc.setFontSize(9);
  doc.text("Claro Manufacturing Pvt. Ltd.", margin + 3, margin + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("(JetFlo Funds & Procurement Division)", margin + 3, margin + 15);
  doc.text("D-196, 2nd Floor, Saket,", margin + 3, margin + 19);
  doc.text("New Delhi - 110017", margin + 3, margin + 23);

  // Top Middle: JETFLO Brand Box (x: margin + 70 = 80mm to margin + 125 = 135mm, y: 10mm to 38mm)
  const logoB64 = getLogoBase64();
  if (logoB64) {
    const boxX = margin + 70; // 80mm
    const boxW = 55; // 135 - 80
    const imgW = 44;
    const imgH = 20.8;
    const imgX = boxX + (boxW - imgW) / 2;
    const imgY = margin + (28 - imgH) / 2;
    doc.addImage(`data:image/png;base64,${logoB64}`, "PNG", imgX, imgY, imgW, imgH, undefined, "FAST");
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 62, 48); // Brand dark green
    doc.text("JETFLO", margin + 97, margin + 14, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text("CLARO ENERGY", margin + 97, margin + 20, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // Top Right: Purchase Order Box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PURCHASE ORDER", margin + 157, margin + 6, { align: "center" });
  doc.line(margin + 125, margin + 9, margin + contentWidth, margin + 9);
  doc.setFontSize(8);
  doc.text(`PO No.: ${po.po_number || "DRAFT-PO"}`, margin + 128, margin + 15);
  doc.text(`Date : ${fmtDate(po.created_at || new Date().toISOString())}`, margin + 128, margin + 21);

  // Tax Details & Addresses (38mm to 82mm)
  doc.line(margin, 82, margin + contentWidth, 82);
  doc.line(margin + 95, 38, margin + 95, 82);

  // Tax details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("TAX DETAILS:", margin + 3, 43);
  doc.setFont("helvetica", "normal");
  doc.text("GST No: 37AAECC3356Q1Z5", margin + 3, 48);
  doc.text("PAN No: AAECC3356Q", margin + 3, 53);

  doc.setFont("helvetica", "bold");
  doc.text("BILLING ADDRESS:", margin + 3, 60);
  doc.setFont("helvetica", "normal");
  doc.text("11-172, Om Sri Shirdi Sai Nilayam,", margin + 3, 65);
  doc.text("Chaparala Vari Street, Vijayawada,", margin + 3, 70);
  doc.text("Dist- NTR, Andhra Pradesh - 520007", margin + 3, 75);

  // Delivery Address
  const plant = po.destination_plant || "Hyderabad Plant";
  const plantAddr = PLANT_ADDRESS_MAP[plant] || (plant ? `${plant}, Site Operations, India` : PLANT_ADDRESS_MAP["Hyderabad Plant"]);

  doc.setFont("helvetica", "bold");
  doc.text("DELIVERY ADDRESS & SITE:", margin + 98, 43);
  doc.text(`Destination: ${plant}`, margin + 98, 48);
  doc.setFont("helvetica", "normal");

  const addrLines = doc.splitTextToSize(plantAddr, contentWidth - 98 - 3);
  doc.text(addrLines, margin + 98, 53);

  doc.setFont("helvetica", "bold");
  doc.text("Contact Person: Operations Desk / Plant Incharge", margin + 98, 77);

  // Vendor Details (82mm to 108mm)
  doc.line(margin, 108, margin + contentWidth, 108);
  const vendor = po.vendor || {};
  const vendorAddr = [vendor.address_line, vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(", ") || "Industrial Area, Registered Vendor Address";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(vendor.name || "Vendor Partner", margin + 3, 87);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(vendorAddr, margin + 3, 92);
  doc.text(`GST: ${vendor.gstin || "N/A"}    PAN: ${vendor.pan || "N/A"}`, margin + 3, 97);
  doc.text(`Attn: ${vendor.contact_person || "Operations Desk"}    Mobile: ${vendor.phone || "+91 8130209287"}    Email: ${vendor.email || "accounts@claroenergy.in"}`, margin + 3, 102);

  // Salutation
  doc.setFont("helvetica", "bold");
  doc.text("Dear Sir,", margin + 3, 113);
  doc.setFont("helvetica", "normal");
  doc.text(
    "With reference to our discussion through email and your approved quotation/commercial offer, we are pleased to place our purchase order for",
    margin + 3,
    117
  );
  doc.text("supply of materials, the terms and conditions are given below:", margin + 3, 121);

  // Line Items Table
  const tableBody = (items || []).map((it, idx) => [
    idx + 1,
    it.item_description + (it.product_sku ? `\n(SKU: ${it.product_sku})` : ""),
    Number(it.qty || 1).toLocaleString("en-IN"),
    "Nos",
    Number(it.unit_rate || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
    Number(it.line_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 }),
  ]);

  const subtotal = (items || []).reduce((s, i) => s + Number(i.qty || 0) * Number(i.unit_rate || 0), 0);
  const taxAmount = (items || []).reduce((s, i) => s + Number(i.tax_amount || 0), 0);
  const total = Number(po.total_value || subtotal + taxAmount);

  tableBody.push(
    ["", "Subtotal:", "", "", "", subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
    ["", "Tax (18% GST):", "", "", "", taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })],
    ["", "TOTAL AMOUNT:", "", "", "", total.toLocaleString("en-IN", { minimumFractionDigits: 2 })]
  );

  autoTable(doc, {
    startY: 124,
    margin: { left: margin, right: margin },
    head: [["Sr No", "Material Description & Specification", "Qty", "Unit", "Rate (INR)", "Total (INR)"]],
    body: tableBody,
    theme: "plain",
    styles: { fontSize: 7.5, cellPadding: 2.2, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fontStyle: "bold", fillColor: [242, 242, 242] },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 15, halign: "center" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 32, halign: "right" },
    },
    didParseCell: function (data) {
      // Bold the subtotal and total summary rows
      if (data.row.index >= (items || []).length) {
        data.cell.styles.fontStyle = "bold";
        if (data.row.index === (items || []).length + 2) {
          data.cell.styles.fillColor = [245, 245, 245];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 195;

  // Amount in words
  doc.rect(margin, finalY, contentWidth, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`Amount in words : ${amountToWords(total, "INR")}`, margin + 3, finalY + 5.5);

  // Special Instructions & Signatory
  const footerY = finalY + 8;
  const footerHeight = Math.max(287 - footerY, 35);
  doc.rect(margin, footerY, contentWidth, footerHeight);
  doc.line(margin + 115, footerY, margin + 115, footerY + footerHeight);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("• Special conditions as given in 'Annexure-I'.", margin + 3, footerY + 5);
  doc.setFont("helvetica", "bold");
  doc.text("SPECIAL INSTRUCTIONS:", margin + 3, footerY + 11);
  doc.setFont("helvetica", "normal");
  doc.text("• Bill / Challan must bear the Purchase Order Reference & our tax details.", margin + 3, footerY + 16);
  doc.text("• All original dispatch documents to be sent to our Corporate Office Delhi.", margin + 3, footerY + 21);
  doc.text("• For any enquiry, please quote Purchase Order Reference and contact Operations Manager.", margin + 3, footerY + 26);

  // Signatory
  doc.setFont("helvetica", "bold");
  doc.text("FOR CLARO MANUFACTURING PVT. LTD.", margin + 125, footerY + 7);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(12);
  doc.text("Gaurav Kumar", margin + 145, footerY + 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("(Director / Auth. Signatory)", margin + 141, footerY + 24);
  doc.setFont("helvetica", "bold");
  doc.text("(AUTHORISED SIGNATORY)", margin + 138, footerY + 31);

  // PAGE 2: ANNEXURE – I
  doc.addPage();
  doc.rect(margin, margin, contentWidth, 277);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ANNEXURE – I", pageWidth / 2, margin + 8, { align: "center" });

  doc.setFontSize(8);
  doc.text(`PO No.: ${po.po_number || "DRAFT-PO"}`, margin + 5, margin + 16);
  doc.text(`Date : ${fmtDate(po.created_at || new Date().toISOString())}`, margin + 145, margin + 16);
  doc.line(margin, margin + 20, margin + contentWidth, margin + 20);

  doc.setFontSize(9);
  doc.text("SPECIAL CONDITIONS: -", margin + 5, margin + 27);

  doc.setFontSize(8);
  doc.text("Definitions:", margin + 5, margin + 33);
  doc.setFont("helvetica", "normal");
  doc.text("BUYER : Claro Manufacturing Pvt. Ltd.", margin + 8, margin + 38);
  doc.text(`SELLER : ${vendor.name || "Vendor Partner"}`, margin + 8, margin + 43);

  const clauses = [
    ["1. Scope of Work", "Goods should be supplied as per specifications laid down by SECI/MNRE Guidelines."],
    ["2. Prices", `PO value is INR ${fmtMoney(total, "INR")}/- (FOR). Cost is inclusive of GST. The rates given in the order are firm and not subject to any escalation.`],
    ["3. Terms of Payment", "100% against delivery upon physical verification. Dispatch clearance given lot wise."],
    ["4. Delivery", "The Vendor shall dispatch material within agreed schedule from the date of PO to our site."],
    ["5. Warranty/Guarantee", "Components supplied shall be new and free from defects. Replacement within 7 days at vendor cost."],
    ["6. Loading & Unloading", "Proper handling with wooden pallets. Loading at vendor end, unloading at site."],
    ["7. Packing & Identification", "Cover with suitable plastic sheet/tarpaulin to avoid damage during transit."],
    ["8. Inspection", "Claro reserves right to conduct Pre-Dispatch Inspection (PDI) at works."],
    ["9. Dispatch", "Vendor shall dispatch through reputed transporter with all statutory documents."],
    ["10. Termination of Order", "Claro reserves right to terminate order or part without assigning any reason."],
    ["11. Transit Insurance", "Any damage or sub-standard material will be replaced at cost of vendor scope."],
    ["12. Applicable Law", "Purchase order governed by Law of Republic of India, Courts in Delhi."],
    ["13. Delay Clause", "Penalty 0.5% per week of delay, maximum not to exceed 5% of total cost."],
  ];

  let cy = margin + 48;
  for (const [title, desc] of clauses) {
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 5, cy);
    cy += 4;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(desc, contentWidth - 10);
    doc.text(lines, margin + 5, cy);
    cy += lines.length * 4 + 2;
  }

  // Signatures Page 2
  doc.line(margin, 255, margin + contentWidth, 255);
  doc.setFont("helvetica", "bold");
  doc.text("For Claro Manufacturing Pvt. Ltd.", margin + 25, 263);
  doc.text("Accepted Unconditionally", margin + 125, 263);
  doc.setFont("times", "bolditalic");
  doc.setFontSize(12);
  doc.text("Gaurav Kumar", margin + 35, 274);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("(Authorized Signatory)", margin + 30, 278);
  doc.text("(Authorized Signatory / Vendor)", margin + 120, 278);

  return Buffer.from(doc.output("arraybuffer"));
}
