import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TenantShell } from "@/components/TenantShell";
import { AdminBar } from "@/components/admin/AdminBar";
import { requireAdminPage } from "@/lib/server/adminAuth";
import { q } from "@/lib/server/db";
import { defaultTheme } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

/** Overview of tenant themes: published, draft or using the default. Behind login. */
export default async function ThemesPage() {
  const admin = await requireAdminPage();
  const t = await getTranslations("admin");
  const rows = await q<{ id: string; name: string; display_name: string | null; published: boolean | null; permission_by: string | null; permission_at: string | null }>(
    `select t.id, t.name, th.display_name, th.permission_at is not null as published, th.permission_by, th.permission_at
       from public.tenants t left join public.tenant_themes th on th.tenant_id = t.id order by t.name`,
  );
  return (
    <TenantShell theme={await defaultTheme()}>
      <main className="page stack" style={{ maxWidth: 820 }}>
        <AdminBar name={admin.name} />
        <h1>{t("themes_title")}</h1>
        <p className="help">{t("themes_intro")}</p>
        {rows.map((r) => (
          <section key={r.id} className="card stack">
            <h2 style={{ fontSize: "1.1rem", margin: 0 }}>{r.name}</h2>
            <p style={{ margin: 0 }}>
              {r.display_name == null ? t("status_default") : r.published ? t("status_published", { name: r.permission_by ?? "", date: new Date(r.permission_at!).toLocaleDateString() }) : t("status_draft")}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href={`/admin/themes/${r.id}`}>{t("edit")}</Link>
              {r.display_name != null && <Link className="btn btn-secondary" href={`/admin/themes/${r.id}/preview`}>{t("preview")}</Link>}
            </div>
          </section>
        ))}
      </main>
    </TenantShell>
  );
}
