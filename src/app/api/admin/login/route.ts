import { timingSafeEqual, createHash } from "node:crypto";
import { createAdminSession, mockLoginAvailable } from "@/lib/server/adminAuth";
import { HttpError, clientKey, handle, json, rateLimit, readJson } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Mock login (AUTH_MOCK_ENTRA) with one demo password, until Entra ID is connected. */
export const POST = handle(async (req) => {
  if (!mockLoginAvailable()) throw new HttpError(503, "login_unavailable");
  await rateLimit(`admin-login:${clientKey(req)}`, 5, 600);
  const body = (await readJson(req, 1024)) as { name?: unknown; password?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) throw new HttpError(422, "name_required");
  const given = typeof body.password === "string" ? body.password : "";
  if (!timingSafeEqual(digest(given), digest(process.env.ADMIN_DEMO_PASSWORD!))) throw new HttpError(401, "wrong_password");
  await createAdminSession(name);
  return json({ ok: true });
});
