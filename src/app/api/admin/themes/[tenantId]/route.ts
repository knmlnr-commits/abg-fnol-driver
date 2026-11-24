import { requireAdminApi } from "@/lib/server/adminAuth";
import { q, q1 } from "@/lib/server/db";
import { HttpError, handle, json, readJson } from "@/lib/server/guard";
import { checkTheme } from "@/lib/theme/contrast";
import { checkLogo } from "@/lib/theme/logo";
import { ThemeInputSchema } from "@/lib/theme/model";

export const dynamic = "force-dynamic";

/**
 * Save a tenant theme.
 * - Refused when any WCAG 2.1 AA contrast check fails.
 * - A theme with a logo needs the written permission confirmation; name and date are stored.
 * - Without the confirmation a theme is a draft: only visible behind login, never on a public link.
 */
export const PUT = handle(async (req) => {
  const admin = await requireAdminApi();
  const tenantId = new URL(req.url).pathname.split("/").pop() ?? "";
  if (!/^[0-9a-f-]{36}$/.test(tenantId)) throw new HttpError(404, "not_found");
  const tenant = await q1(`select id from public.tenants where id = $1`, [tenantId]);
  if (!tenant) throw new HttpError(404, "not_found");

  const body = (await readJson(req, 400 * 1024)) as { theme?: unknown; logo?: { mime?: unknown; base64?: unknown } | null; permission?: unknown };
  const parsed = ThemeInputSchema.safeParse(body.theme);
  if (!parsed.success) throw new HttpError(422, "invalid_input");
  const theme = parsed.data;

  const report = checkTheme(theme);
  if (!report.ok) return json({ error: "contrast_failed", checks: report.checks }, 422);

  // Logo: undefined keeps the current one, null removes it, an object replaces it.
  let logo: Buffer | null | undefined;
  let logoMime: string | null | undefined;
  if (body.logo === null) {
    logo = null;
    logoMime = null;
  } else if (body.logo !== undefined) {
    if (typeof body.logo.base64 !== "string" || typeof body.logo.mime !== "string") throw new HttpError(422, "logo_type");
    const bytes = Buffer.from(body.logo.base64, "base64");
    const c = checkLogo(new Uint8Array(bytes), body.logo.mime);
    if (!c.ok) throw new HttpError(422, c.code);
    logo = bytes;
    logoMime = c.mime;
  }
  const existing = await q1<{ has_logo: boolean }>(`select logo is not null as has_logo from public.tenant_themes where tenant_id = $1`, [tenantId]);
  const willHaveLogo = logo === undefined ? Boolean(existing?.has_logo) : logo !== null;
  const permission = body.permission === true;
  if (willHaveLogo && !permission) throw new HttpError(422, "permission_required");

  const cols = [
    theme.displayName, theme.primary, theme.accent, theme.background, theme.text, theme.surface || null, theme.fontPair,
    theme.contactPhone || null, theme.contactEmail || null, theme.footerText || null,
    permission ? admin.name : null, JSON.stringify({ checks: report.checks, info: report.info }), admin.name,
  ];
  await q(
    `insert into public.tenant_themes (tenant_id, display_name, primary_color, accent_color, background_color, text_color, surface_color,
        font_pair, contact_phone, contact_email, footer_text, permission_by, permission_at, contrast_report, updated_by, updated_at
        ${logo !== undefined ? ", logo, logo_mime" : ""})
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, case when $12::text is null then null else now() end, $13, $14, now()
        ${logo !== undefined ? ", $15, $16" : ""})
     on conflict (tenant_id) do update set display_name = excluded.display_name, primary_color = excluded.primary_color,
        accent_color = excluded.accent_color, background_color = excluded.background_color, text_color = excluded.text_color,
        surface_color = excluded.surface_color, font_pair = excluded.font_pair, contact_phone = excluded.contact_phone,
        contact_email = excluded.contact_email, footer_text = excluded.footer_text, permission_by = excluded.permission_by,
        permission_at = excluded.permission_at, contrast_report = excluded.contrast_report, updated_by = excluded.updated_by,
        updated_at = now() ${logo !== undefined ? ", logo = excluded.logo, logo_mime = excluded.logo_mime" : ""}`,
    [tenantId, ...cols, ...(logo !== undefined ? [logo, logoMime] : [])],
  );
  await q(
    `insert into public.audit_log (tenant_id, actor_type, actor_id, action, entity, entity_id, detail) values ($1, 'handler', $2, 'theme_save', 'tenant_theme', $1, $3)`,
    [tenantId, admin.name, JSON.stringify({ published: permission, logo: willHaveLogo, permissionBy: permission ? admin.name : null })],
  );
  return json({ ok: true, published: permission });
});
