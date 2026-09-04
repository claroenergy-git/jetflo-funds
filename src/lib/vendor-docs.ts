import { getSupabaseAdmin } from "@/lib/supabase/server";

export interface VendorDocument {
  fileName: string;
  originalName: string;
  path: string;
  url: string;
  kind: "bank_proof" | "gst_cert" | "other";
  docTypeLabel: string;
}

export function parseDocTypeFromFileName(fileName: string): {
  kind: "bank_proof" | "gst_cert" | "other";
  docTypeLabel: string;
  originalName: string;
} {
  // Filename format: `${docType}-${timestamp}-${safeName}`
  const match = fileName.match(/^([a-z_]+)-(\d+)-(.*)$/i);
  const prefix = match ? match[1].toLowerCase() : "";
  const original = match && match[3] ? match[3] : fileName;

  if (prefix === "tax_cert" || fileName.startsWith("tax_cert")) {
    return {
      kind: "gst_cert",
      docTypeLabel: "GST / Statutory Tax Certificate",
      originalName: original,
    };
  }

  if (prefix === "cancelled_cheque") {
    return {
      kind: "bank_proof",
      docTypeLabel: "1. Cancelled Cheque Book Copy",
      originalName: original,
    };
  }

  if (prefix === "passbook") {
    return {
      kind: "bank_proof",
      docTypeLabel: "2. Pass Book Copy",
      originalName: original,
    };
  }

  if (prefix === "netbanking_profile") {
    return {
      kind: "bank_proof",
      docTypeLabel: "3. Netbanking Profile Print",
      originalName: original,
    };
  }

  if (prefix === "letterhead_profile") {
    return {
      kind: "bank_proof",
      docTypeLabel: "4. Wire Specimen / Letterhead Profile",
      originalName: original,
    };
  }

  return {
    kind: "bank_proof",
    docTypeLabel: "Bank Verification Proof",
    originalName: original,
  };
}

/**
 * Fetches all vendor verification documents from the private storage bucket
 * and returns a dictionary mapped by vendor ID with 24-hour signed URLs.
 */
export async function getVendorDocumentsMap(
  specificVendorIds?: string[]
): Promise<Record<string, VendorDocument[]>> {
  const admin = getSupabaseAdmin();
  const docsMap: Record<string, VendorDocument[]> = {};

  try {
    const { data: rootList, error: rootErr } = await admin.storage
      .from("jetflo-docs")
      .list("vendor-docs");

    if (rootErr || !rootList) {
      console.warn("Could not list vendor-docs storage root:", rootErr?.message);
      return docsMap;
    }

    // Filter to subdirectories (which represent vendor IDs)
    const targetFolders = rootList.filter((item) => {
      // Storage folders have item.id === null or don't have extension
      const name = item.name;
      if (specificVendorIds && specificVendorIds.length > 0) {
        return specificVendorIds.includes(name);
      }
      return true;
    });

    await Promise.all(
      targetFolders.map(async (folder) => {
        const vendorId = folder.name;
        const { data: files } = await admin.storage
          .from("jetflo-docs")
          .list(`vendor-docs/${vendorId}`);

        if (!files || files.length === 0) return;

        const docs: VendorDocument[] = [];
        for (const file of files) {
          if (!file.name || file.name.startsWith(".")) continue;
          const fullPath = `vendor-docs/${vendorId}/${file.name}`;
          const { data: signed } = await admin.storage
            .from("jetflo-docs")
            .createSignedUrl(fullPath, 86400); // 24 hours

          if (signed?.signedUrl) {
            const parsed = parseDocTypeFromFileName(file.name);
            docs.push({
              fileName: file.name,
              originalName: parsed.originalName,
              path: fullPath,
              url: signed.signedUrl,
              kind: parsed.kind,
              docTypeLabel: parsed.docTypeLabel,
            });
          }
        }

        if (docs.length > 0) {
          // Sort bank_proof first, then gst_cert
          docs.sort((a, b) => {
            if (a.kind === "bank_proof" && b.kind !== "bank_proof") return -1;
            if (a.kind !== "bank_proof" && b.kind === "bank_proof") return 1;
            return 0;
          });
          docsMap[vendorId] = docs;
        }
      })
    );
  } catch (err: any) {
    console.error("Error in getVendorDocumentsMap:", err);
  }

  return docsMap;
}

/**
 * Fetches verification documents with signed URLs for a single vendor.
 */
export async function getVendorDocuments(
  vendorId: string
): Promise<VendorDocument[]> {
  const admin = getSupabaseAdmin();
  const docs: VendorDocument[] = [];

  try {
    const { data: files, error } = await admin.storage
      .from("jetflo-docs")
      .list(`vendor-docs/${vendorId}`);

    if (error || !files) return docs;

    for (const file of files) {
      if (!file.name || file.name.startsWith(".")) continue;
      const fullPath = `vendor-docs/${vendorId}/${file.name}`;
      const { data: signed } = await admin.storage
        .from("jetflo-docs")
        .createSignedUrl(fullPath, 86400);

      if (signed?.signedUrl) {
        const parsed = parseDocTypeFromFileName(file.name);
        docs.push({
          fileName: file.name,
          originalName: parsed.originalName,
          path: fullPath,
          url: signed.signedUrl,
          kind: parsed.kind,
          docTypeLabel: parsed.docTypeLabel,
        });
      }
    }

    docs.sort((a, b) => {
      if (a.kind === "bank_proof" && b.kind !== "bank_proof") return -1;
      if (a.kind !== "bank_proof" && b.kind === "bank_proof") return 1;
      return 0;
    });
  } catch (err: any) {
    console.error(`Error fetching vendor documents for ${vendorId}:`, err);
  }

  return docs;
}
