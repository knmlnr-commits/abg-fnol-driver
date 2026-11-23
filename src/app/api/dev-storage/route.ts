import { HttpError, handle } from "@/lib/server/guard";
import { MAX_UPLOAD_BYTES } from "@/lib/server/intake";
import { localStorageDriver } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/** Local development stand in for Supabase Storage signed URLs. Disabled unless STORAGE_DRIVER=local. */
function params(req: Request, op: "put" | "get") {
  const drv = localStorageDriver();
  if (!drv) throw new HttpError(404, "not_found");
  const u = new URL(req.url);
  const p = u.searchParams.get("path") ?? "";
  const exp = Number(u.searchParams.get("exp"));
  if (u.searchParams.get("op") !== op || !drv.verify(p, exp, op, u.searchParams.get("sig") ?? "")) throw new HttpError(403, "bad_signature");
  return { drv, p };
}

export const PUT = handle(async (req) => {
  const { drv, p } = params(req, "put");
  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length || body.length > MAX_UPLOAD_BYTES) throw new HttpError(413, "too_large");
  await drv.put(p, body).catch(() => {
    throw new HttpError(409, "exists");
  });
  return new Response(JSON.stringify({ Key: p }), { status: 200, headers: { "content-type": "application/json" } });
});

export const GET = handle(async (req) => {
  const { drv, p } = params(req, "get");
  const buf = await drv.get(p).catch(() => null);
  if (!buf) throw new HttpError(404, "not_found");
  const type = p.endsWith(".pdf") ? "application/pdf" : p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(new Uint8Array(buf), { headers: { "content-type": type, "cache-control": "private, max-age=600" } });
});
