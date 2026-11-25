import { requireAdminApi } from "@/lib/server/adminAuth";
import { q1 } from "@/lib/server/db";
import { HttpError, handle } from "@/lib/server/guard";
import { LOGO_HEADERS, normalizeSvg } from "@/lib/theme/logo";

export const dynamic = "force-dynamic";

/** Logo of any saved theme, including drafts. Behind login. */
export const GET = handle(async (req) => {
  await requireAdminApi();
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "not_found");
  const row = await q1<{ logo: Buffer; logo_mime: string }>(`select logo, logo_mime from public.tenant_themes where id = $1 and logo is not null`, [id]);
  if (!row) throw new HttpError(404, "not_found");
  const body = row.logo_mime === "image/svg+xml" ? normalizeSvg(row.logo.toString("utf8")) : new Uint8Array(row.logo);
  return new Response(body, {
    headers: { ...LOGO_HEADERS, "Content-Type": row.logo_mime, "Cache-Control": "private, no-store" },
  });
});
