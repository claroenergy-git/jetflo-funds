import { notFound } from "next/navigation";
import { requireProfile, getPurchaseOrderById } from "@/lib/data";
import { PoDocumentView } from "@/components/po-document-view";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function DownloadPoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();

  const p: any = await getPurchaseOrderById(profile, id);
  if (!p) notFound();
  const items = (p.items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <div className="py-2">
      <PoDocumentView po={p} items={items} showActions={true} />
    </div>
  );
}
