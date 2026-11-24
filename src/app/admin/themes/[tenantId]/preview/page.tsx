import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { TenantShell } from "@/components/TenantShell";
import { ThemeSample } from "@/components/admin/ThemeSample";
import { requireAdminPage } from "@/lib/server/adminAuth";
import { q1 } from "@/lib/server/db";
import { THEME_COLUMNS, toPublicTheme, type ThemeRow } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

/** Preview of a saved theme, drafts included. Only behind login; the logo comes from the admin route. */
export default async function PreviewPage({ params }: PageProps<"/admin/themes/[tenantId]/preview">) {
  await requireAdminPage();
  const { tenantId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(tenantId)) notFound();
  const row = await q1<ThemeRow>(`select ${THEME_COLUMNS} from public.tenant_themes where tenant_id = $1`, [tenantId]);
  if (!row) notFound();
  const t = await getTranslations("admin");
  return (
    <TenantShell theme={toPublicTheme(row, "admin")}>
      <p className="notice" role="note" style={{ margin: 16 }}>
        {row.permission_at ? t("preview_published") : t("preview_draft")}
      </p>
      <ThemeSample />
    </TenantShell>
  );
}
