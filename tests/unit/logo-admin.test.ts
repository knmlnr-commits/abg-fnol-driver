import { beforeAll, describe, expect, it } from "vitest";
import { checkLogo, MAX_LOGO_BYTES } from "@/lib/theme/logo";

const enc = (s: string) => new TextEncoder().encode(s);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe("logo upload check", () => {
  it("accepts a plain SVG and a PNG", () => {
    expect(checkLogo(enc('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>'), "image/svg+xml").ok).toBe(true);
    expect(checkLogo(PNG, "image/png").ok).toBe(true);
  });

  it("refuses SVGs that can run code or load other files", () => {
    for (const bad of [
      '<svg><script>alert(1)</script></svg>',
      '<svg onload="alert(1)"></svg>',
      '<svg><a href="javascript:alert(1)">x</a></svg>',
      '<svg><image href="https://example.com/x.png"/></svg>',
      '<svg><foreignObject><div/></foreignObject></svg>',
      '<!DOCTYPE svg [<!ENTITY x "y">]><svg/>',
      '<svg><style>@import url(https://example.com/x.css)</style></svg>',
    ]) {
      expect(checkLogo(enc(bad), "image/svg+xml")).toMatchObject({ ok: false });
    }
  });

  it("refuses wrong types, fake PNGs and large files", () => {
    expect(checkLogo(enc("<html></html>"), "image/svg+xml")).toEqual({ ok: false, code: "logo_type" });
    expect(checkLogo(enc("not a png"), "image/png")).toEqual({ ok: false, code: "logo_type" });
    expect(checkLogo(PNG, "image/gif")).toEqual({ ok: false, code: "logo_type" });
    expect(checkLogo(new Uint8Array(MAX_LOGO_BYTES + 1), "image/png")).toEqual({ ok: false, code: "logo_too_large" });
  });
});

describe("admin session", () => {
  let verify: typeof import("@/lib/server/adminAuth").verifyAdminToken;
  let sign: typeof import("@/lib/tokens").signToken;
  let ring: import("@/lib/tokens").KeyRing;
  beforeAll(async () => {
    process.env.TOKEN_KEYS = `k1:${Buffer.alloc(32, 3).toString("base64")}`;
    process.env.TOKEN_ACTIVE_KID = "k1";
    process.env.AUTH_MOCK_ENTRA = "true";
    ({ verifyAdminToken: verify } = await import("@/lib/server/adminAuth"));
    const tokens = await import("@/lib/tokens");
    sign = tokens.signToken;
    ring = tokens.keyRingFromEnv();
  });

  it("accepts a valid session and keeps the name for the audit trail", async () => {
    const t = await sign({ typ: "admin", jti: "s1", name: "Test Admin" }, ring, { ttlSeconds: 600 });
    expect(await verify(t)).toEqual({ name: "Test Admin", sessionId: "s1" });
  });

  it("refuses a missing, forged or wrong type token", async () => {
    expect(await verify(undefined)).toBeNull();
    expect(await verify("abc.def.ghi")).toBeNull();
    const incident = await sign({ typ: "incident", jti: "x", sub: "y" }, ring, { ttlSeconds: 600 });
    expect(await verify(incident)).toBeNull();
  });

  it("refuses every session when the mock login flag is off", async () => {
    const t = await sign({ typ: "admin", jti: "s2", name: "Test Admin" }, ring, { ttlSeconds: 600 });
    process.env.AUTH_MOCK_ENTRA = "false";
    expect(await verify(t)).toBeNull();
    process.env.AUTH_MOCK_ENTRA = "true";
  });
});
