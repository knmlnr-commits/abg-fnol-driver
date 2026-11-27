import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { keyRingFromEnv, signToken, verifyToken, TokenError, hashToken, INCIDENT_TOKEN_TTL_S } from "@/lib/tokens";

const k1 = Buffer.alloc(32, 1).toString("base64");
const k2 = Buffer.alloc(32, 2).toString("base64");
const ring = keyRingFromEnv({ TOKEN_KEYS: `k1:${k1},k2:${k2}`, TOKEN_ACTIVE_KID: "k1" });
const ring2 = keyRingFromEnv({ TOKEN_KEYS: `k1:${k1},k2:${k2}`, TOKEN_ACTIVE_KID: "k2" });

const entry = { typ: "entry" as const, jti: "e-1", ten: "t-1", stn: "DE-HAM-01", ctry: "DE", veh: "HH-VA 101" };

async function expectCode(p: Promise<unknown>, code: TokenError["code"]) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof TokenError && e.code === code);
}

describe("token key ring", () => {
  it("rejects missing or short keys", () => {
    expect(() => keyRingFromEnv({})).toThrow(TokenError);
    expect(() => keyRingFromEnv({ TOKEN_KEYS: `k1:${Buffer.alloc(8).toString("base64")}`, TOKEN_ACTIVE_KID: "k1" })).toThrow(TokenError);
    expect(() => keyRingFromEnv({ TOKEN_KEYS: `k1:${k1}`, TOKEN_ACTIVE_KID: "k9" })).toThrow(TokenError);
  });
});

describe("token validation", () => {
  it("round trips an entry token with its context", async () => {
    const t = await signToken(entry, ring);
    const c = await verifyToken(t, "entry", ring);
    expect(c).toMatchObject(entry);
  });

  it("accepts an email link token that names only the rental company", async () => {
    const t = await signToken({ typ: "entry", jti: "e-9", ten: "t-1" }, ring);
    const c = await verifyToken(t, "entry", ring);
    expect(c).toMatchObject({ jti: "e-9", ten: "t-1" });
    expect(c.stn).toBeUndefined();
    expect(c.veh).toBeUndefined();
  });

  it("verifies tokens signed with an older key after rotation", async () => {
    const t = await signToken(entry, ring);
    await expect(verifyToken(t, "entry", ring2)).resolves.toMatchObject({ jti: "e-1" });
  });

  it("rejects a token of the wrong type", async () => {
    const t = await signToken(entry, ring);
    await expectCode(verifyToken(t, "incident", ring), "wrong_type");
  });

  it("rejects an expired incident token", async () => {
    const now = Date.UTC(2026, 0, 1);
    const t = await signToken({ typ: "incident", jti: "a-1", sub: "i-1" }, ring, { ttlSeconds: INCIDENT_TOKEN_TTL_S, now });
    await expect(verifyToken(t, "incident", ring, { now: now + 1000 })).resolves.toMatchObject({ sub: "i-1" });
    await expectCode(verifyToken(t, "incident", ring, { now: now + (INCIDENT_TOKEN_TTL_S + 60) * 1000 }), "expired");
  });

  it("rejects an incident token without expiry", async () => {
    const t = await signToken({ typ: "incident", jti: "a-1", sub: "i-1" }, ring);
    await expectCode(verifyToken(t, "incident", ring), "invalid");
  });

  it("rejects a tampered payload", async () => {
    const t = await signToken(entry, ring);
    const [h, , s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...entry, stn: "XX" })).toString("base64url");
    await expectCode(verifyToken(`${h}.${forged}.${s}`, "entry", ring), "invalid");
  });

  it("rejects a token signed with an unknown key or another secret", async () => {
    const other = keyRingFromEnv({ TOKEN_KEYS: `k1:${Buffer.alloc(32, 9).toString("base64")}`, TOKEN_ACTIVE_KID: "k1" });
    await expectCode(verifyToken(await signToken(entry, other), "entry", ring), "invalid");
    const k3 = keyRingFromEnv({ TOKEN_KEYS: `k3:${k1}`, TOKEN_ACTIVE_KID: "k3" });
    await expectCode(verifyToken(await signToken(entry, k3), "entry", ring), "unknown_key");
  });

  it("rejects alg none and garbage", async () => {
    const none = `${Buffer.from('{"alg":"none","kid":"k1"}').toString("base64url")}.${Buffer.from(JSON.stringify(entry)).toString("base64url")}.`;
    await expectCode(verifyToken(none, "entry", ring), "invalid");
    await expectCode(verifyToken("not-a-token", "entry", ring), "invalid");
    await expectCode(verifyToken("a".repeat(5000), "entry", ring), "invalid");
  });

  it("rejects a token with the wrong audience", async () => {
    const t = await new SignJWT({ typ: "entry" })
      .setProtectedHeader({ alg: "HS256", kid: "k1" })
      .setIssuer("va-fnol")
      .setAudience("someone-else")
      .setJti("x")
      .sign(ring.keys.k1);
    await expectCode(verifyToken(t, "entry", ring), "invalid");
  });

  it("hashes tokens deterministically", async () => {
    expect(await hashToken("abc")).toBe(await hashToken("abc"));
    expect(await hashToken("abc")).toHaveLength(64);
  });
});
