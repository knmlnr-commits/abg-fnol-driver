/**
 * Row level security tests. Runs against a throwaway Postgres database:
 *   DATABASE_TEST_URL=postgres://postgres@localhost:54329/postgres pnpm test:db
 * The test creates and drops its own database `fnol_rls_test`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ADMIN_URL = process.env.DATABASE_TEST_URL;
const DB = "fnol_rls_test";
const root = path.resolve(import.meta.dirname, "../..");

const T1 = "00000000-0000-4000-8000-000000000001"; // seeded "Demo rental company"
const T2 = "00000000-0000-4000-8000-0000000000f2"; // second tenant
const H1 = "10000000-0000-4000-8000-000000000001"; // handler of T1
const A1 = "10000000-0000-4000-8000-000000000002"; // admin of T1
const H2 = "10000000-0000-4000-8000-000000000003"; // handler of T2
const STRANGER = "10000000-0000-4000-8000-000000000009"; // signed in, not a handler

let db: Client;

function withDb(url: string, name: string) {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

/** Run a query as a given role (and user), inside a transaction that is rolled back. */
async function as<T = Record<string, unknown>>(role: "anon" | "authenticated" | "service_role", uid: string | null, sql: string, params: unknown[] = []) {
  await db.query("begin");
  try {
    await db.query(`set local role ${role}`);
    if (uid) await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const r = await db.query(sql, params);
    return r.rows as T[];
  } finally {
    await db.query("rollback");
  }
}

async function denied(role: "anon" | "authenticated", uid: string | null, sql: string) {
  await expect(as(role, uid, sql)).rejects.toThrow(/permission denied/);
}

describe.skipIf(!ADMIN_URL)("row level security", () => {
  beforeAll(async () => {
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${DB}`);
    await admin.query(`create database ${DB}`);
    await admin.end();

    db = new Client({ connectionString: withDb(ADMIN_URL!, DB) });
    await db.connect();
    await db.query(readFileSync(path.join(root, "tests/db/supabase-shim.sql"), "utf8"));
    for (const f of readdirSync(path.join(root, "supabase/migrations")).sort()) {
      if (f.includes("storage")) continue; // needs the Supabase storage schema
      await db.query(readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
    }
    await db.query(readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
    await db.query(`
      insert into public.tenants (id, name) values ('${T2}', 'Other partner');
      insert into public.stations (id, tenant_id, code, name, city, country) values
        ('00000000-0000-4000-8000-0000000001f2', '${T2}', 'XX-OTH-01', 'Other', 'Elsewhere', 'NL');
      insert into public.handler_users (user_id, tenant_id, role, display_name) values
        ('${H1}', '${T1}', 'handler', 'Handler one'),
        ('${A1}', '${T1}', 'admin', 'Admin one'),
        ('${H2}', '${T2}', 'handler', 'Handler two');
      insert into public.incidents (id, tenant_id, reference, status) values
        ('20000000-0000-4000-8000-000000000001', '${T1}', 'FN-TEST-1', 'submitted'),
        ('20000000-0000-4000-8000-000000000002', '${T1}', 'FN-TEST-2', 'draft'),
        ('20000000-0000-4000-8000-000000000003', '${T2}', 'FN-TEST-3', 'submitted');
      insert into public.access_links (id, incident_id, purpose, token_hash, expires_at) values
        ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'incident', 'x', now() + interval '1 day');
      insert into public.audit_log (tenant_id, actor_type, action, entity) values ('${T1}', 'system', 'test', 'incidents');
    `);
  });

  afterAll(async () => {
    await db?.end();
    const admin = new Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${DB}`);
    await admin.end();
  });

  it("enables RLS on every table in public", async () => {
    const r = await db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(r.rows).toEqual([]);
  });

  it("gives anon no access to any table", async () => {
    for (const t of ["tenants", "stations", "vehicles", "entry_tokens", "incidents", "evidence_items", "access_links", "funnel_events", "audit_log", "rate_limits"]) {
      await denied("anon", null, `select * from public.${t} limit 1`);
    }
    await denied("anon", null, `insert into public.incidents (tenant_id, reference) values ('${T1}', 'X')`);
  });

  it("gives anon no access to the functions", async () => {
    await denied("anon", null, "select public.next_incident_reference()");
    await denied("anon", null, "select public.rate_limit_hit('k', 60, 10)");
    await denied("anon", null, "select public.purge_expired_incidents()");
  });

  it("shows a handler only submitted incidents of their own tenant", async () => {
    const rows = await as<{ reference: string }>("authenticated", H1, "select reference from public.incidents order by reference");
    expect(rows.map((r) => r.reference)).toEqual(["FN-TEST-1"]);
    const other = await as<{ reference: string }>("authenticated", H2, "select reference from public.incidents");
    expect(other.map((r) => r.reference)).toEqual(["FN-TEST-3"]);
  });

  it("shows a signed in user without a handler role nothing", async () => {
    expect(await as("authenticated", STRANGER, "select * from public.incidents")).toEqual([]);
    expect(await as("authenticated", STRANGER, "select * from public.stations")).toEqual([]);
  });

  it("keeps master data per tenant", async () => {
    const s1 = await as<{ code: string }>("authenticated", H1, "select code from public.stations");
    expect(s1.length).toBe(6); // seed tenant 1 has six stations
    const s2 = await as<{ code: string }>("authenticated", H2, "select code from public.stations");
    expect(s2.map((s) => s.code)).toEqual(["XX-OTH-01"]);
  });

  it("does not let handlers write directly", async () => {
    await denied("authenticated", H1, "update public.incidents set status = 'draft'");
    await denied("authenticated", H1, `insert into public.handler_users (user_id, tenant_id, role, display_name) values ('${STRANGER}', '${T1}', 'admin', 'x')`);
    await denied("authenticated", A1, "delete from public.audit_log");
  });

  it("never exposes access links, rate limits or intake deliveries", async () => {
    await denied("authenticated", A1, "select * from public.access_links");
    await denied("authenticated", A1, "select * from public.rate_limits");
    await denied("authenticated", A1, "select * from public.intake_deliveries");
  });

  it("shows the audit log to admins only", async () => {
    expect(await as("authenticated", H1, "select * from public.audit_log")).toEqual([]);
    expect((await as("authenticated", A1, "select * from public.audit_log")).length).toBeGreaterThan(0);
  });

  it("lets a handler see only their own handler record", async () => {
    const rows = await as<{ user_id: string }>("authenticated", H1, "select user_id from public.handler_users");
    expect(rows.map((r) => r.user_id)).toEqual([H1]);
  });

  it("keeps tenant themes server only", async () => {
    await denied("anon", null, "select * from public.tenant_themes");
    await denied("authenticated", A1, "select * from public.tenant_themes");
  });

  it("refuses to store a logo without the written permission, name and date", async () => {
    await expect(db.query(
      `insert into public.tenant_themes (tenant_id, display_name, primary_color, accent_color, background_color, text_color, font_pair, logo, logo_mime)
       values ('${T2}', 'Other', '#4A1F5C', '#0E7C86', '#FAF8F5', '#1E1B24', 'system_sans', '\\x3c7376672f3e', 'image/svg+xml')`,
    )).rejects.toThrow(/check constraint/);
    await expect(db.query(
      `insert into public.tenant_themes (tenant_id, display_name, primary_color, accent_color, background_color, text_color, font_pair, logo, logo_mime, permission_by)
       values ('${T2}', 'Other', '#4A1F5C', '#0E7C86', '#FAF8F5', '#1E1B24', 'system_sans', '\\x3c7376672f3e', 'image/svg+xml', 'Someone')`,
    )).rejects.toThrow(/check constraint/);
  });

  it("does not publish a draft theme", async () => {
    await db.query("begin");
    try {
      await db.query(
        `insert into public.tenant_themes (tenant_id, display_name, primary_color, accent_color, background_color, text_color, font_pair)
         values ('${T2}', 'Draft brand', '#4A1F5C', '#0E7C86', '#FAF8F5', '#1E1B24', 'system_sans')`,
      );
      const pub = await db.query(`select 1 from public.tenant_themes where tenant_id = '${T2}' and permission_at is not null`);
      expect(pub.rows).toEqual([]);
    } finally {
      await db.query("rollback");
    }
  });

  it("seeds exactly one theme: the Van Ameyde default", async () => {
    const r = await db.query(`select display_name, is_default, permission_at is not null as published from public.tenant_themes`);
    expect(r.rows).toEqual([{ display_name: "Van Ameyde", is_default: true, published: true }]);
  });

  it("lets the service role create references and rate limit", async () => {
    const [ref] = await as<{ r: string }>("service_role", null, "select public.next_incident_reference() as r");
    expect(ref.r).toMatch(/^FN-\d{4}-\d{6}$/);
    // Each `as` call rolls back, so count within one transaction instead.
    await db.query("begin");
    await db.query("set local role service_role");
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await db.query("select public.rate_limit_hit('test-key', 60, 3) as ok");
      results.push(r.rows[0].ok);
    }
    await db.query("rollback");
    expect(results).toEqual([true, true, true, false]);
  });
});
