import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { requireProfile, PO_COLS, PO_COLS_LEGACY } from "@/lib/data";
import { PoDocumentView } from "@/components/po-document-view";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function DownloadPoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const supabase = await getSupabase();

  let poRes = await supabase.from("jetflo_purchase_orders").select(PO_COLS).eq("id", id).single();
  if (poRes.error) {
    poRes = await supabase.from("jetflo_purchase_orders").select(PO_COLS_LEGACY).eq("id", id).single();
  }
  if (!poRes.data) notFound();

  const p = poRes.data as any;
  const items = (p.items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div className="py-2">
      <PoDocumentView po={p} items={items} showActions={true} />
    </div>
  );
}
