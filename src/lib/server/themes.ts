import "server-only";
import { VAN_AMEYDE_THEME } from "@/lib/theme/defaults";
import type { FontPair, PublicTheme } from "@/lib/theme/model";
import { themeForEntryToken, themeForIncidentToken, type ThemeSource } from "@/lib/theme/resolve";
import { q, q1 } from "./db";
import { ring } from "./intake";

export type ThemeRow = {
  id: string;
  tenant_id: string | null;
  is_default: boolean;
  display_name: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  surface_color: string | null;
  font_pair: FontPair;
  contact_phone: string | null;
  contact_email: string | null;
  footer_text: string | null;
  has_logo: boolean;
  logo_mime: string | null;
  permission_by: string | null;
  permission_at: string | null;
  updated_by: string | null;
  updated_at: string;
};

export const THEME_COLUMNS = `id, tenant_id, is_default, display_name, primary_color, accent_color, background_color, text_color,
  surface_color, font_pair, contact_phone, contact_email, footer_text, logo is not null as has_logo, logo_mime,
  permission_by, permission_at, updated_by, updated_at`;

/** Public form of a theme. `logoPath` decides which route serves the logo (public or admin). */
export function toPublicTheme(r: ThemeRow, logoPath: "public" | "admin" = "public"): PublicTheme {
  const v = new Date(r.updated_at).getTime();
  return {
    id: r.id,
    isDefault: r.is_default,
    logoUrl: r.has_logo ? (logoPath === "public" ? `/api/theme/logo/${r.id}?v=${v}` : `/api/admin/themes/logo/${r.id}?v=${v}`) : null,
    displayName: r.display_name,
    primary: r.primary_color,
    accent: r.accent_color,
    background: r.background_color,
    text: r.text_color,
    surface: r.surface_color ?? "",
    fontPair: r.font_pair,
    contactPhone: r.contact_phone ?? "",
    contactEmail: r.contact_email ?? "",
    footerText: r.footer_text ?? "",
  };
}

/** A theme is public only when its brand use is confirmed. */
export const PUBLISHED = "permission_at is not null";

export const dbThemeSource: ThemeSource = {
  async publishedThemeForTenant(tenantId) {
    const r = await q1<ThemeRow>(`select ${THEME_COLUMNS} from public.tenant_themes where tenant_id = $1 and ${PUBLISHED}`, [tenantId]);
    return r ? toPublicTheme(r) : null;
  },
  async tenantForIncident(incidentId) {
    const r = await q1<{ tenant_id: string }>(`select tenant_id from public.incidents where id = $1`, [incidentId]);
    return r?.tenant_id ?? null;
  },
  async defaultTheme() {
    const r = await q1<ThemeRow>(`select ${THEME_COLUMNS} from public.tenant_themes where is_default`);
    return r ? toPublicTheme(r) : VAN_AMEYDE_THEME;
  },
};

/** Never let a theme lookup break a page: fall back to the built in default. */
async function safe(fn: () => Promise<PublicTheme>): Promise<PublicTheme> {
  try {
    return await fn();
  } catch (e) {
    console.error("[theme]", e instanceof Error ? e.message : e);
    return VAN_AMEYDE_THEME;
  }
}

export const defaultTheme = () => safe(() => dbThemeSource.defaultTheme());
export const themeForEntry = (token: string) => safe(() => themeForEntryToken(token, ring(), dbThemeSource));
export const themeForIncident = (token: string) => safe(() => themeForIncidentToken(token, ring(), dbThemeSource));

/** For /demo: every tenant with its public theme (own when published, otherwise the default). */
export async function demoTenants() {
  const tenants = await q<{ id: string; name: string }>(`select id, name from public.tenants order by name`);
  const def = await defaultTheme();
  return Promise.all(
    tenants.map(async (t) => ({ ...t, theme: (await dbThemeSource.publishedThemeForTenant(t.id)) ?? def })),
  );
}
