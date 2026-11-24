import { q1 } from "@/lib/server/db";
import { HttpError, handle } from "@/lib/server/guard";
import { PUBLISHED } from "@/lib/server/themes";
import { LOGO_HEADERS } from "@/lib/theme/logo";

export const dynamic = "force-dynamic";

/** Public logo of a published theme only. Drafts are served by the admin route behind login. */
export const GET = handle(async (req) => {
  const id = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(404, "not_found");
  const row = await q1<{ logo: Buffer; logo_mime: string }>(
    `select logo, logo_mime from public.tenant_themes where id = $1 and logo is not null and ${PUBLISHED}`,
    [id],
  );
  if (!row) throw new HttpError(404, "not_found");
  return new Response(new Uint8Array(row.logo), {
    headers: { ...LOGO_HEADERS, "Content-Type": row.logo_mime, "Cache-Control": "public, max-age=300" },
  });
});
