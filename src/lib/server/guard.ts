import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { checkBotId } from "botid/server";
import { flags } from "@/lib/config/flags";
import { q1 } from "./db";

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code }, e.status);
      console.error("[api]", e instanceof Error ? e.message : e);
      return json({ error: "server_error" }, 500);
    }
  };
}

/** A hash of the client address; raw IP addresses are never stored. */
export function clientKey(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`${process.env.RATE_LIMIT_SALT ?? "fnol"}:${ip}`).digest("hex").slice(0, 32);
}

/** Fixed window limit in Postgres, so it holds across serverless instances. */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const r = await q1<{ ok: boolean }>("select public.rate_limit_hit($1, $2, $3) as ok", [key, windowSeconds, max]);
  if (!r?.ok) throw new HttpError(429, "rate_limited");
}

export async function botCheck() {
  if (!flags.BOT_CHECK) return;
  const v = await checkBotId();
  if (v.isBot) throw new HttpError(403, "bot_detected");
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "bad_json");
  }
}

export function bearer(req: Request): string {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer ([A-Za-z0-9_\-.]{20,2048})$/.exec(h);
  if (!m) throw new HttpError(401, "no_token");
  return m[1];
}
