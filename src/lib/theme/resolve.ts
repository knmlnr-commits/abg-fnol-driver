import { TokenError, verifyToken, type KeyRing } from "@/lib/tokens";
import type { PublicTheme } from "./model";

/** Data access the resolver needs. Injected, so the rules can be tested without a database. */
export type ThemeSource = {
  /** The tenant's own theme, only when it is published (brand use confirmed). Null otherwise. */
  publishedThemeForTenant(tenantId: string): Promise<PublicTheme | null>;
  /** Tenant that owns an incident, for personal and document request links. */
  tenantForIncident(incidentId: string): Promise<string | null>;
  defaultTheme(): Promise<PublicTheme>;
};

/** The tenant in the signed token decides the theme. Anything invalid falls back to the default. */
export async function themeForTenant(tenantId: string | null, src: ThemeSource): Promise<PublicTheme> {
  if (tenantId) {
    const own = await src.publishedThemeForTenant(tenantId);
    if (own) return own;
  }
  return src.defaultTheme();
}

export async function themeForEntryToken(token: string, ring: KeyRing, src: ThemeSource): Promise<PublicTheme> {
  try {
    const claims = await verifyToken(token, "entry", ring);
    return themeForTenant(claims.ten, src);
  } catch (e) {
    if (e instanceof TokenError) return src.defaultTheme();
    throw e;
  }
}

/** Personal link or document request link: the incident's tenant decides. */
export async function themeForIncidentToken(token: string, ring: KeyRing, src: ThemeSource): Promise<PublicTheme> {
  for (const typ of ["incident", "docreq"] as const) {
    try {
      const claims = await verifyToken(token, typ, ring);
      return themeForTenant(await src.tenantForIncident(claims.sub), src);
    } catch (e) {
      if (!(e instanceof TokenError)) throw e;
    }
  }
  return src.defaultTheme();
}
