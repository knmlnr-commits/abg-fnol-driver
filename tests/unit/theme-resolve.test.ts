import { describe, expect, it } from "vitest";
import { keyRingFromEnv, signToken } from "@/lib/tokens";
import { VAN_AMEYDE_THEME } from "@/lib/theme/defaults";
import type { PublicTheme } from "@/lib/theme/model";
import { themeForEntryToken, themeForIncidentToken, type ThemeSource } from "@/lib/theme/resolve";

const ring = keyRingFromEnv({ TOKEN_KEYS: `k1:${Buffer.alloc(32, 7).toString("base64")}`, TOKEN_ACTIVE_KID: "k1" });
const other = keyRingFromEnv({ TOKEN_KEYS: `k1:${Buffer.alloc(32, 8).toString("base64")}`, TOKEN_ACTIVE_KID: "k1" });

const BRAND = "t-brand";
const DRAFT = "t-draft";
const brand: PublicTheme = { ...VAN_AMEYDE_THEME, id: "th-b", isDefault: false, displayName: "Test brand", primary: "#4A1F5C" };

// Stub database: the test brand has a published theme; the draft tenant only has an unpublished one,
// which the real query never returns.
const src: ThemeSource = {
  publishedThemeForTenant: async (id) => (id === BRAND ? brand : null),
  tenantForIncident: async (id) => ({ "inc-n": BRAND, "inc-d": DRAFT } as Record<string, string>)[id] ?? null,
  defaultTheme: async () => VAN_AMEYDE_THEME,
};

const entry = (ten: string, r = ring) => signToken({ typ: "entry", jti: "e1", ten, stn: "X", ctry: "NL" }, r);

describe("token to theme resolution", () => {
  it("uses the theme of the tenant in the signed QR token", async () => {
    expect((await themeForEntryToken(await entry(BRAND), ring, src)).displayName).toBe("Test brand");
  });

  it("uses the default for a tenant without a published theme", async () => {
    expect(await themeForEntryToken(await entry(DRAFT), ring, src)).toBe(VAN_AMEYDE_THEME);
    expect(await themeForEntryToken(await entry("t-plain"), ring, src)).toBe(VAN_AMEYDE_THEME);
  });

  it("falls back to the default for forged, tampered or garbage tokens", async () => {
    expect(await themeForEntryToken(await entry(BRAND, other), ring, src)).toBe(VAN_AMEYDE_THEME);
    const t = await entry(DRAFT);
    const [h, , s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ typ: "entry", ten: BRAND, jti: "e1", iss: "va-fnol", aud: "va-fnol-driver" })).toString("base64url");
    expect(await themeForEntryToken(`${h}.${forged}.${s}`, ring, src)).toBe(VAN_AMEYDE_THEME);
    expect(await themeForEntryToken("nonsense", ring, src)).toBe(VAN_AMEYDE_THEME);
  });

  it("resolves personal and document request links through the incident's tenant", async () => {
    const inc = await signToken({ typ: "incident", jti: "a1", sub: "inc-n" }, ring, { ttlSeconds: 600 });
    const req = await signToken({ typ: "docreq", jti: "a2", sub: "inc-n", rid: "r1" }, ring, { ttlSeconds: 600 });
    expect((await themeForIncidentToken(inc, ring, src)).displayName).toBe("Test brand");
    expect((await themeForIncidentToken(req, ring, src)).displayName).toBe("Test brand");
    const draft = await signToken({ typ: "incident", jti: "a3", sub: "inc-d" }, ring, { ttlSeconds: 600 });
    expect(await themeForIncidentToken(draft, ring, src)).toBe(VAN_AMEYDE_THEME);
  });

  it("does not accept an entry token as a personal link", async () => {
    expect(await themeForIncidentToken(await entry(BRAND), ring, src)).toBe(VAN_AMEYDE_THEME);
  });
});
