import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Server side database access. Uses the Supabase Postgres connection (transaction pooler
 * on Vercel). This role bypasses RLS like the service role, so it is only ever used in
 * server routes after the token, rate limit and input checks.
 */
const globalForPg = globalThis as unknown as { fnolPool?: Pool };

function pool(): Pool {
  if (!globalForPg.fnolPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    const local = /@(localhost|127\.0\.0\.1)|host=\//.test(connectionString);
    globalForPg.fnolPool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForPg.fnolPool;
}

export async function q<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool().query<T>(sql, params);
  return r.rows;
}

export async function q1<T extends QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
