import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, PO_COLS, PO_COLS_LEGACY } from "@/lib/data";
import { generatePurchaseOrderPdf } from "@/lib/po-pdf";

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile();
    const { id } = await props.params;

    if (!id) {
      return NextResponse.json({ error: "Missing purchase order id" }, { status: 400 });
    }

    const supabase = await getSupabase();
    let poRes = await supabase.from("jetflo_purchase_orders").select(PO_COLS).eq("id", id).single();
    if (poRes.error) {
      poRes = await supabase.from("jetflo_purchase_orders").select(PO_COLS_LEGACY).eq("id", id).single();
    }

    if (!poRes.data) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const po = poRes.data as any;
    const items = (po.items ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const pdfBuffer = generatePurchaseOrderPdf(po, items);

    const cleanNum = (po.po_number || "Draft-PO").replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanVendor = (po.vendor?.name || "Vendor").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `PO_${cleanNum}_${cleanVendor}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Failed to generate PO PDF:", error);
    return NextResponse.json({ error: error.message || "Failed to generate PO PDF" }, { status: 500 });
  }
}
