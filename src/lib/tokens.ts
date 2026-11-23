import { SignJWT, jwtVerify, errors as joseErrors, decodeProtectedHeader } from "jose";

/**
 * Signed tokens for the public driver flow.
 *
 * - entry:    printed in the QR code (station card, vehicle sticker or rental agreement).
 *             Long lived, revocable in the database, context only, no personal data.
 * - incident: created when the driver starts; the personal resume and "add documents" link.
 * - docreq:   created by a handler; asks for specific missing items.
 *
 * Keys come from TOKEN_KEYS ("kid:base64secret,kid2:base64secret") with TOKEN_ACTIVE_KID
 * for signing. Old keys stay valid for verification, so keys can rotate.
 */

const ISSUER = "va-fnol";
const AUDIENCE = "va-fnol-driver";

export const INCIDENT_TOKEN_TTL_S = 30 * 24 * 3600; // [CONFIRM] 30 days
export const DOCREQ_TOKEN_TTL_S = 14 * 24 * 3600; // [CONFIRM] 14 days

export type EntryClaims = {
  typ: "entry";
  jti: string; // entry_tokens.id
  ten: string; // tenant id
  stn: string; // station code
  ctry: string; // ISO country
  veh?: string; // vehicle plate
  agr?: string; // rental agreement number
};
export type IncidentClaims = { typ: "incident"; jti: string; sub: string };
export type DocReqClaims = { typ: "docreq"; jti: string; sub: string; rid: string };
export type AnyClaims = EntryClaims | IncidentClaims | DocReqClaims;

export type KeyRing = { activeKid: string; keys: Record<string, Uint8Array> };

export class TokenError extends Error {
  constructor(public code: "invalid" | "expired" | "wrong_type" | "unknown_key" | "config") {
    super(code);
  }
}

export function keyRingFromEnv(env: Record<string, string | undefined> = process.env): KeyRing {
  const raw = env.TOKEN_KEYS;
  const activeKid = env.TOKEN_ACTIVE_KID;
  if (!raw || !activeKid) throw new TokenError("config");
  const keys: Record<string, Uint8Array> = {};
  for (const part of raw.split(",")) {
    const [kid, b64] = part.split(":");
    if (!kid || !b64) continue;
    const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
    if (bytes.length < 32) throw new TokenError("config");
    keys[kid.trim()] = bytes;
  }
  if (!keys[activeKid]) throw new TokenError("config");
  return { activeKid, keys };
}

export async function signToken(claims: AnyClaims, ring: KeyRing, opts: { ttlSeconds?: number; now?: number } = {}) {
  const { typ, jti, ...rest } = claims as AnyClaims & Record<string, unknown>;
  const iat = Math.floor((opts.now ?? Date.now()) / 1000);
  const jwt = new SignJWT({ typ, ...rest })
    .setProtectedHeader({ alg: "HS256", kid: ring.activeKid })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setJti(jti)
    .setIssuedAt(iat);
  if (opts.ttlSeconds) jwt.setExpirationTime(iat + opts.ttlSeconds);
  return jwt.sign(ring.keys[ring.activeKid]);
}

export async function verifyToken<T extends AnyClaims["typ"]>(
  token: string,
  expected: T,
  ring: KeyRing,
  opts: { now?: number } = {},
): Promise<Extract<AnyClaims, { typ: T }>> {
  if (typeof token !== "string" || token.length > 2048 || token.split(".").length !== 3) {
    throw new TokenError("invalid");
  }
  let kid: string | undefined;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "HS256") throw new TokenError("invalid");
    kid = header.kid;
  } catch (e) {
    if (e instanceof TokenError) throw e;
    throw new TokenError("invalid");
  }
  const key = kid ? ring.keys[kid] : undefined;
  if (!key) throw new TokenError("unknown_key");
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: opts.now ? new Date(opts.now) : undefined,
    });
    if (payload.typ !== expected || typeof payload.jti !== "string") throw new TokenError("wrong_type");
    if (expected !== "entry" && typeof payload.exp !== "number") throw new TokenError("invalid");
    return payload as unknown as Extract<AnyClaims, { typ: T }>;
  } catch (e) {
    if (e instanceof TokenError) throw e;
    if (e instanceof joseErrors.JWTExpired) throw new TokenError("expired");
    throw new TokenError("invalid");
  }
}

/** Store only a hash of a token in the database. */
export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}
