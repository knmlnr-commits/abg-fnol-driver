// White label safeguards, checked against a running app:
//   BASE_URL=http://localhost:3100 DATABASE_URL=... ADMIN_DEMO_PASSWORD=... node tests/e2e/theme-guard.mjs
// - admin pages, draft previews and draft logos are not reachable without login
// - a draft theme never shows on a public QR link
// - partner themes show the demo banner; every page says Powered by Van Ameyde; noindex is set
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const T1 = "00000000-0000-4000-8000-000000000001"; // tenant on the default theme
const DRAFT_NAME = "Draft brand " + Math.random().toString(36).slice(2, 8);
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) failed++; };
const get = (path, init = {}) => fetch(BASE + path, { redirect: "manual", ...init });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query(`delete from public.tenant_themes where tenant_id = $1`, [T1]);
await db.query(
  `insert into public.tenant_themes (tenant_id, display_name, primary_color, accent_color, background_color, text_color, font_pair)
   values ($1, $2, '#203040', '#406080', '#FFFFFF', '#111111', 'system_sans')`, [T1, DRAFT_NAME]);
// A neutral test brand with a published theme and logo, created for this run and removed after.
const TB = "00000000-0000-4000-8000-0000000000e2";
await db.query(`delete from public.tenants where id = $1`, [TB]);
await db.query(`insert into public.tenants (id, name) values ($1, 'Test brand company')`, [TB]);
await db.query(`insert into public.stations (id, tenant_id, code, name, city, country) values ('00000000-0000-4000-8000-0000000001e2', $1, 'XX-TST-01', 'Test station', 'Testcity', 'NL')`, [TB]);
await db.query(`insert into public.entry_tokens (id, tenant_id, kind, station_id, label) values ('00000000-0000-4000-8000-0000000003e2', $1, 'station', '00000000-0000-4000-8000-0000000001e2', 'Station card TEST-01')`, [TB]);
const brand = (await db.query(
  `insert into public.tenant_themes (tenant_id, display_name, primary_color, accent_color, background_color, text_color, font_pair, logo, logo_mime, permission_by, permission_at)
   values ($1, 'Test brand', '#203040', '#406080', '#FFFFFF', '#111111', 'system_sans', convert_to('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 100 20"><path d="M0 0h100v20H0z"/></svg>', 'UTF8'), 'image/svg+xml', 'Test run', now())
   returning id`, [TB])).rows[0].id;

try {
  // Without login
  let r = await get("/admin/themes");
  check(r.status >= 300 && r.status < 400 && r.headers.get("location")?.includes("/admin/login"), "admin overview redirects to login");
  r = await get(`/admin/themes/${T1}/preview`);
  check(r.status >= 300 && r.status < 400 && r.headers.get("location")?.includes("/admin/login"), "draft preview redirects to login");
  r = await get(`/api/admin/themes/logo/${brand}`);
  check(r.status === 401, "admin logo route needs login");
  r = await get(`/api/admin/themes/${T1}`, { method: "PUT", body: "{}", headers: { "content-type": "application/json" } });
  check(r.status === 401, "saving a theme needs login");

  // Public pages
  const demo = await get("/demo");
  const html = await demo.text();
  check(/noindex/.test(demo.headers.get("x-robots-tag") ?? ""), "demo page sends X-Robots-Tag noindex");
  check(html.includes('name="robots" content="noindex'), "demo page has robots noindex meta");
  const url = (label) => {
    const i = html.indexOf(label);
    const m = html.slice(i).match(/\/r\/([A-Za-z0-9_\-.]+)/);
    return m ? `/r/${m[1]}` : null;
  };
  const vaPage = await (await get(url("Sticker HH-VA 101"))).text();
  check(!vaPage.includes(DRAFT_NAME), "a draft theme is not shown on the tenant's public QR link");
  check(!vaPage.includes(`class="demo-banner"`), "default theme has no demo banner");
  check(vaPage.includes(`class="powered">Powered by Van Ameyde<`), "default theme footer says Powered by Van Ameyde");
  const nlPage = await (await get(url("Station card TEST-01"))).text();
  check(nlPage.includes(`class="demo-banner" role="note">Demo environment, fictional data<`), "a partner theme shows the demo banner");
  check(nlPage.includes(`class="powered">Powered by Van Ameyde<`), "partner footer says Powered by Van Ameyde");
  check(nlPage.includes(`/api/theme/logo/${brand}`), "a partner theme uses its published logo");
  r = await get(`/api/theme/logo/${brand}`);
  const logoText = await r.text();
  check(r.status === 200 && /sandbox/.test(r.headers.get("content-security-policy") ?? ""), "published logo is served with a sandbox policy");
  check(!/<svg[^>]*\swidth=/.test(logoText), "fixed SVG width and height are removed so the logo keeps its proportions");

  // With login
  r = await get("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Test Admin", password: "wrong" }) });
  check(r.status === 401, "wrong password is refused");
  r = await get("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Test Admin", password: process.env.ADMIN_DEMO_PASSWORD }) });
  const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
  check(r.ok && cookie.startsWith("__Host-fnol_admin="), "login sets a secure session cookie");
  r = await get(`/admin/themes/${T1}/preview`, { headers: { cookie } });
  const prev = await r.text();
  check(r.status === 200 && prev.includes(DRAFT_NAME), "draft preview works behind login");

  // Saving: contrast failure and logo without permission are refused
  const theme = { displayName: "X", primary: "#203040", accent: "#406080", background: "#FFFFFF", text: "#EEEEEE", fontPair: "system_sans" };
  r = await get(`/api/admin/themes/${T1}`, { method: "PUT", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ theme }) });
  check(r.status === 422 && (await r.json()).error === "contrast_failed", "theme failing WCAG contrast is refused");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>').toString("base64");
  r = await get(`/api/admin/themes/${T1}`, { method: "PUT", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ theme: { ...theme, text: "#111111" }, logo: { mime: "image/svg+xml", base64: svg } }) });
  check(r.status === 422 && (await r.json()).error === "permission_required", "logo without the permission tick is refused");
} finally {
  await db.query(`delete from public.tenant_themes where tenant_id = $1`, [T1]);
  await db.query(`delete from public.tenants where id = $1`, [TB]);
  await db.end();
}
console.log(failed ? `${failed} FAILED` : "PASS");
process.exit(failed ? 1 : 0);
