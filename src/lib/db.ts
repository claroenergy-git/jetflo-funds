import "server-only";
import { Pool, type PoolClient } from "pg";

const globalForPg = globalThis as unknown as { pgPool: Pool | undefined };

function getPool(): Pool {
  if (globalForPg.pgPool) return globalForPg.pgPool;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
  if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;
  return pool;
}

const globalForPgAdmin = globalThis as unknown as { pgAdminPool: Pool | undefined };

/** BYPASSRLS role (jetflo_service) — equivalent of the old Supabase service-role client. */
function getAdminPool(): Pool {
  if (globalForPgAdmin.pgAdminPool) return globalForPgAdmin.pgAdminPool;
  const pool = new Pool({
    connectionString: process.env.DATABASE_ADMIN_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  if (process.env.NODE_ENV !== "production") globalForPgAdmin.pgAdminPool = pool;
  return pool;
}

/** Run a query with RLS bypassed — only for genuinely privileged/system operations. */
export async function adminQuery<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = getAdminPool();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

/** Run a query with no user/RLS context — only for pre-auth flows (e.g. login lookup). */
export async function query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

/**
 * Run one or more queries inside a transaction with `auth.uid()` bound to the given user,
 * so existing RLS policies and triggers (which read auth.uid()/jetflo_role()) apply exactly
 * as they did under Supabase.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export type { PoolClient };
