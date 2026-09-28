import "server-only";
import { cookies } from "next/headers";
import { query, adminQuery, withUserContext } from "@/lib/db";
import { makeFrom } from "@/lib/pg-query-builder";
import { storageFrom } from "@/lib/storage";
import { verifySessionToken, createSessionToken, COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

type AuthUser = { id: string; email: string };
type AuthResult = { data: { user: AuthUser | null }; error: null };

function buildClient(runInUserContext: (sql: string, params: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>, currentUser: AuthUser | null) {
  return {
    from: makeFrom(runInUserContext as any),
    storage: { from: storageFrom },
    auth: {
      async getUser(): Promise<AuthResult> {
        return { data: { user: currentUser }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }): Promise<{ error: { message: string } | null }> {
        const rows = await adminQuery<{ id: string; email: string; password_hash: string | null; active: boolean }>(
          `SELECT id, email, password_hash, active FROM jetflo_users WHERE email = $1`,
          [email]
        );
        const user = rows[0];
        if (!user || !user.active || !user.password_hash) {
          return { error: { message: "Invalid login credentials" } };
        }
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) return { error: { message: "Invalid login credentials" } };

        const token = await createSessionToken({ userId: user.id, email: user.email });
        (await cookies()).set(COOKIE_NAME, token, {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_DURATION_SECONDS,
        });
        return { error: null };
      },
      async signOut(): Promise<void> {
        (await cookies()).delete(COOKIE_NAME);
      },
      async updateUser({ password }: { password: string }): Promise<{ error: { message: string } | null }> {
        if (!currentUser) return { error: { message: "Not authenticated" } };
        const hash = await hashPassword(password);
        await adminQuery(`UPDATE jetflo_users SET password_hash = $1 WHERE id = $2`, [hash, currentUser.id]);
        return { error: null };
      },
    },
  };
}

export type SupabaseLikeClient = ReturnType<typeof buildClient>;

/** User-context client — RLS-enforced via jetflo_app + SET LOCAL app.current_user_id. */
export async function getSupabase(): Promise<SupabaseLikeClient> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const currentUser = session ? { id: session.userId, email: session.email } : null;

  const run = async (sql: string, params: unknown[]) => {
    if (!currentUser) {
      // Unauthenticated queries (rare — e.g. pre-login lookups) get no RLS context, so they see nothing.
      return query(sql, params).then((rows) => ({ rows, rowCount: rows.length }));
    }
    return withUserContext(currentUser.id, async (client) => {
      const res = await client.query(sql, params);
      return { rows: res.rows, rowCount: res.rowCount };
    });
  };

  return buildClient(run, currentUser);
}

/** Service-role-equivalent client — BYPASSRLS via jetflo_service, no user context. */
export function getSupabaseAdmin(): SupabaseLikeClient {
  const run = async (sql: string, params: unknown[]) => {
    const rows = await adminQuery(sql, params);
    return { rows, rowCount: rows.length };
  };
  return buildClient(run, null);
}
