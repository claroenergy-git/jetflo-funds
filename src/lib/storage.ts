import "server-only";
import { Storage } from "@google-cloud/storage";

const globalForGcs = globalThis as unknown as { gcsClient: Storage | undefined };

function getStorageClient(): Storage {
  if (globalForGcs.gcsClient) return globalForGcs.gcsClient;
  // On Vercel (or any host outside GCP) there's no ambient service-account identity,
  // so credentials come from a JSON key pasted into an env var rather than a file path.
  const keyJson = process.env.GCS_SERVICE_ACCOUNT_KEY;
  const client = keyJson ? new Storage({ credentials: JSON.parse(keyJson) }) : new Storage();
  globalForGcs.gcsClient = client;
  return client;
}

function getBucket() {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) throw new Error("GCS_BUCKET env var is not set");
  return getStorageClient().bucket(bucketName);
}

// This bucket is shared across multiple projects — every path this app touches is
// namespaced under this prefix so files can't collide with another project's data.
const PATH_PREFIX = "jetflo/";

export type StorageResult<T> = { data: T | null; error: { message: string } | null };

/** Matches the subset of supabase.storage.from(bucket) used by this app. Bucket name is
 * ignored — this app only ever uses one bucket, configured via GCS_BUCKET. */
export function storageFrom(_bucket?: string) {
  return {
    async upload(
      path: string,
      buffer: Buffer,
      opts?: { contentType?: string; upsert?: boolean }
    ): Promise<StorageResult<{ path: string }>> {
      try {
        const file = getBucket().file(PATH_PREFIX + path);
        await file.save(buffer, {
          contentType: opts?.contentType,
          resumable: false,
        });
        return { data: { path }, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },

    async list(prefix: string): Promise<StorageResult<{ name: string }[]>> {
      try {
        const normalizedPrefix = PATH_PREFIX + (prefix.endsWith("/") ? prefix : `${prefix}/`);
        const [files] = await getBucket().getFiles({ prefix: normalizedPrefix, delimiter: "/" });
        // Files directly under this prefix (not nested further)
        const names = new Set<string>();
        for (const f of files) {
          const rest = f.name.slice(normalizedPrefix.length);
          if (!rest) continue;
          const segment = rest.split("/")[0];
          if (segment) names.add(segment);
        }
        return { data: Array.from(names).map((name) => ({ name })), error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },

    async createSignedUrl(
      path: string,
      expiresInSeconds: number
    ): Promise<StorageResult<{ signedUrl: string }>> {
      try {
        const [signedUrl] = await getBucket()
          .file(PATH_PREFIX + path)
          .getSignedUrl({
            action: "read",
            expires: Date.now() + expiresInSeconds * 1000,
          });
        return { data: { signedUrl }, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },
  };
}
