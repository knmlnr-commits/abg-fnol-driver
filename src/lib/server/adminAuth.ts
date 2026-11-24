import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { flags } from "@/lib/config/flags";
import { signToken, verifyToken } from "@/lib/tokens";
import { HttpError } from "./guard";
import { ring } from "./intake";

/**
 * Admin login. Until Microsoft Entra ID is connected this is a mock behind the AUTH_MOCK_ENTRA
 * flag, protected by one demo password (ADMIN_DEMO_PASSWORD). The session is a signed, short lived
 * token in an httpOnly cookie.
 */
export const ADMIN_COOKIE = "__Host-fnol_admin";
const SESSION_S = 8 * 3600;

export type AdminSession = { name: string; sessionId: string };

export function mockLoginAvailable(): boolean {
  return flags.AUTH_MOCK_ENTRA && (process.env.ADMIN_DEMO_PASSWORD ?? "").length >= 12;
}

export async function createAdminSession(name: string) {
  const token = await signToken({ typ: "admin", jti: randomUUID(), name }, ring(), { ttlSeconds: SESSION_S });
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: SESSION_S });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

/** Verifies an admin session token. Exported for tests. */
export async function verifyAdminToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token || !flags.AUTH_MOCK_ENTRA) return null;
  try {
    const c = await verifyToken(token, "admin", ring());
    return { name: c.name, sessionId: c.jti };
  } catch {
    return null;
  }
}

export async function adminSession(): Promise<AdminSession | null> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** For pages: send anyone without a session to the login page. */
export async function requireAdminPage(): Promise<AdminSession> {
  const s = await adminSession();
  if (!s) redirect("/admin/login");
  return s;
}

/** For API routes: 401 without a session. */
export async function requireAdminApi(): Promise<AdminSession> {
  const s = await adminSession();
  if (!s) throw new HttpError(401, "login_required");
  return s;
}
