import { NextResponse } from "next/server";
import { getVendorDocuments } from "@/lib/vendor-docs";
import { requireProfile } from "@/lib/data";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await requireProfile();
    const params = await props.params;
    const vendorId = params.id;
    if (!vendorId) {
      return NextResponse.json({ error: "Missing vendor id" }, { status: 400 });
    }

    const documents = await getVendorDocuments(vendorId);
    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
