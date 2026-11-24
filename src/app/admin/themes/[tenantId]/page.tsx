import { notFound } from "next/navigation";
import { TenantShell } from "@/components/TenantShell";
import { AdminBar } from "@/components/admin/AdminBar";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import { requireAdminPage } from "@/lib/server/adminAuth";
import { q1 } from "@/lib/server/db";
import { THEME_COLUMNS, defaultTheme, toPublicTheme, type ThemeRow } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

export default async function EditThemePage({ params }: PageProps<"/admin/themes/[tenantId]">) {
  const admin = await requireAdminPage();
  const { tenantId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(tenantId)) notFound();
  const tenant = await q1<{ id: string; name: string }>(`select id, name from public.tenants where id = $1`, [tenantId]);
  if (!tenant) notFound();
  const row = await q1<ThemeRow>(`select ${THEME_COLUMNS} from public.tenant_themes where tenant_id = $1`, [tenantId]);
  const def = await defaultTheme();
  const start = row ? toPublicTheme(row, "admin") : { ...def, id: "new", isDefault: false, logoUrl: null, displayName: tenant.name };
  return (
    <TenantShell theme={def}>
      <main className="page stack" style={{ maxWidth: 1100 }}>
        <AdminBar name={admin.name} />
        <ThemeEditor
          tenant={tenant}
          initial={start}
          permission={row?.permission_by ? { by: row.permission_by, at: row.permission_at! } : null}
        />
      </main>
    </TenantShell>
  );
}
