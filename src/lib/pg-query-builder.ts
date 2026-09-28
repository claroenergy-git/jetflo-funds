import "server-only";
import type { PoolClient } from "pg";

export type PgError = { message: string; code?: string } | null;
export type PgResult<T> = { data: T | null; error: PgError; count?: number | null };

type RunFn = <T = unknown>(sql: string, params: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;

type FilterOp =
  | { kind: "eq"; col: string; val: unknown }
  | { kind: "neq"; col: string; val: unknown }
  | { kind: "gte"; col: string; val: unknown }
  | { kind: "lte"; col: string; val: unknown }
  | { kind: "in"; col: string; val: unknown[] }
  | { kind: "not_in_literal"; col: string; vals: string[] };

/**
 * A deliberately narrow Postgres-backed stand-in for the subset of the supabase-js
 * query builder actually used in this codebase (flat selects/mutations only — the two
 * genuinely nested/embedded-resource queries live in src/lib/data.ts as hand-written SQL).
 * Thenable, matching supabase-js so `const { data, error } = await builder` works
 * without always calling .single()/.maybeSingle().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class PgQueryBuilder<T = any> implements PromiseLike<PgResult<T[]>> {
  private filters: FilterOp[] = [];
  private selectCols = "*";
  private countMode: "exact" | null = null;
  private headOnly = false;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private singleMode: "single" | "maybeSingle" | null = null;
  private mutation: { type: "insert" | "update" | "upsert" | "delete"; payload?: unknown; onConflict?: string } | null =
    null;

  constructor(private run: RunFn, private table: string) {}

  select(cols: string, opts?: { count?: "exact"; head?: boolean }): this {
    this.selectCols = cols;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ kind: "eq", col, val });
    return this;
  }
  neq(col: string, val: unknown): this {
    this.filters.push({ kind: "neq", col, val });
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filters.push({ kind: "gte", col, val });
    return this;
  }
  lte(col: string, val: unknown): this {
    this.filters.push({ kind: "lte", col, val });
    return this;
  }
  in(col: string, vals: unknown[]): this {
    this.filters.push({ kind: "in", col, val: vals });
    return this;
  }
  /** Only supports the one pattern this app uses: .not(col, "in", "(a,b,c)") */
  not(col: string, operator: string, literalList: string): this {
    if (operator !== "in") throw new Error(`Unsupported .not() operator: ${operator}`);
    const inner = literalList.replace(/^\(/, "").replace(/\)$/, "");
    const vals = inner.split(",").map((s) => s.trim()).filter(Boolean);
    this.filters.push({ kind: "not_in_literal", col, vals });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mutation = { type: "insert", payload };
    return this;
  }
  update(payload: Record<string, unknown>): this {
    this.mutation = { type: "update", payload };
    return this;
  }
  upsert(payload: Record<string, unknown>, opts?: { onConflict?: string }): this {
    this.mutation = { type: "upsert", payload, onConflict: opts?.onConflict };
    return this;
  }
  delete(): this {
    this.mutation = { type: "delete" };
    return this;
  }

  single(): PromiseLike<PgResult<T>> {
    this.singleMode = "single";
    return this.execute() as unknown as PromiseLike<PgResult<T>>;
  }
  maybeSingle(): PromiseLike<PgResult<T>> {
    this.singleMode = "maybeSingle";
    return this.execute() as unknown as PromiseLike<PgResult<T>>;
  }

  then<TResult1 = PgResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: PgResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const typed = this.execute() as unknown as Promise<PgResult<T[]>>;
    return typed.then(onfulfilled, onrejected);
  }

  private buildWhere(params: unknown[]): string {
    const clauses: string[] = [];
    for (const f of this.filters) {
      switch (f.kind) {
        case "eq":
          params.push(f.val);
          clauses.push(`${f.col} = $${params.length}`);
          break;
        case "neq":
          params.push(f.val);
          clauses.push(`${f.col} != $${params.length}`);
          break;
        case "gte":
          params.push(f.val);
          clauses.push(`${f.col} >= $${params.length}`);
          break;
        case "lte":
          params.push(f.val);
          clauses.push(`${f.col} <= $${params.length}`);
          break;
        case "in":
          params.push(f.val);
          clauses.push(`${f.col} = ANY($${params.length})`);
          break;
        case "not_in_literal":
          params.push(f.vals);
          clauses.push(`NOT (${f.col} = ANY($${params.length}))`);
          break;
      }
    }
    return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  }

  private async execute(): Promise<PgResult<unknown>> {
    try {
      if (this.mutation) return await this.executeMutation();
      return await this.executeSelect();
    } catch (err) {
      return { data: this.singleMode ? null : [], error: { message: (err as Error).message } };
    }
  }

  private async executeSelect(): Promise<PgResult<unknown>> {
    const params: unknown[] = [];
    const where = this.buildWhere(params);

    if (this.headOnly && this.countMode) {
      const sql = `SELECT count(*)::int AS count FROM ${this.table} ${where}`;
      const res = await this.run<{ count: number }>(sql, params);
      return { data: null, error: null, count: res.rows[0]?.count ?? 0 };
    }

    const order = this.orderCol ? `ORDER BY ${this.orderCol} ${this.orderAsc ? "ASC" : "DESC"}` : "";
    const limit = this.limitN != null ? `LIMIT ${this.limitN}` : "";
    const sql = `SELECT ${this.selectCols} FROM ${this.table} ${where} ${order} ${limit}`;
    const res = await this.run(sql, params);

    if (this.singleMode === "single") {
      if (res.rows.length !== 1) {
        return { data: null, error: { message: `Expected exactly one row, got ${res.rows.length}` } };
      }
      return { data: res.rows[0], error: null };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: res.rows[0] ?? null, error: null };
    }
    return { data: res.rows, error: null };
  }

  private async executeMutation(): Promise<PgResult<unknown>> {
    const m = this.mutation!;
    if (m.type === "insert") {
      const rows = Array.isArray(m.payload) ? m.payload : [m.payload as Record<string, unknown>];
      const cols = Object.keys(rows[0] as Record<string, unknown>);
      const params: unknown[] = [];
      const valueTuples = rows.map((row) => {
        const placeholders = cols.map((c) => {
          params.push((row as Record<string, unknown>)[c]);
          return `$${params.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });
      const returning = this.selectCols !== "*" ? this.selectCols : "*";
      const sql = `INSERT INTO ${this.table} (${cols.join(", ")}) VALUES ${valueTuples.join(", ")} RETURNING ${returning}`;
      const res = await this.run(sql, params);
      if (this.singleMode === "single") {
        if (res.rows.length !== 1) return { data: null, error: { message: "Insert did not return exactly one row" } };
        return { data: res.rows[0], error: null };
      }
      if (this.singleMode === "maybeSingle") return { data: res.rows[0] ?? null, error: null };
      return { data: res.rows, error: null };
    }

    if (m.type === "upsert") {
      const row = m.payload as Record<string, unknown>;
      const cols = Object.keys(row);
      const params: unknown[] = cols.map((c) => row[c]);
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const conflictCols = m.onConflict ? m.onConflict.split(",").map((s) => s.trim()) : [];
      const updateSet = cols
        .filter((c) => !conflictCols.includes(c))
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(", ");
      const conflictClause = conflictCols.length
        ? `ON CONFLICT (${conflictCols.join(", ")}) DO UPDATE SET ${updateSet || cols[0] + " = EXCLUDED." + cols[0]}`
        : "";
      const sql = `INSERT INTO ${this.table} (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) ${conflictClause}`;
      await this.run(sql, params);
      return { data: null, error: null };
    }

    if (m.type === "update") {
      const row = m.payload as Record<string, unknown>;
      const params: unknown[] = [];
      const setClauses = Object.keys(row).map((c) => {
        params.push(row[c]);
        return `${c} = $${params.length}`;
      });
      const where = this.buildWhere(params);
      const returning = this.selectCols !== "*" ? this.selectCols : "*";
      const sql = `UPDATE ${this.table} SET ${setClauses.join(", ")} ${where} RETURNING ${returning}`;
      const res = await this.run(sql, params);
      if (this.singleMode === "single") {
        if (res.rows.length !== 1) return { data: null, error: { message: "Update did not return exactly one row" } };
        return { data: res.rows[0], error: null };
      }
      if (this.singleMode === "maybeSingle") return { data: res.rows[0] ?? null, error: null };
      return { data: res.rows, error: null };
    }

    if (m.type === "delete") {
      const params: unknown[] = [];
      const where = this.buildWhere(params);
      const sql = `DELETE FROM ${this.table} ${where}`;
      const res = await this.run(sql, params);
      return { data: null, error: null, count: res.rowCount };
    }

    return { data: null, error: { message: "Unknown mutation type" } };
  }
}

export function makeFrom(run: RunFn) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function from<T = any>(table: string): PgQueryBuilder<T> {
    return new PgQueryBuilder<T>(run, table);
  };
}

export type { PoolClient };
