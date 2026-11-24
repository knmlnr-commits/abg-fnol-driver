import { getTranslations } from "next-intl/server";
import { StartForm } from "@/components/StartForm";
import { TenantShell } from "@/components/TenantShell";
import { q1 } from "@/lib/server/db";
import { HttpError } from "@/lib/server/guard";
import { resolveEntry, type EntryContext } from "@/lib/server/intake";
import { themeForEntry } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

/** Landing page of a scanned QR code. The tenant in the signed token decides the theme. */
export default async function EntryPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const theme = await themeForEntry(token);
  const t = await getTranslations("errors");
  let ctx: EntryContext;
  try {
    ctx = await resolveEntry(token);
  } catch (e) {
    const code = e instanceof HttpError ? e.code : "server_error";
    return (
      <TenantShell theme={theme}>
        <main className="page">
          <p className="alert" role="alert">{t.has(code) ? t(code) : t("server_error")}</p>
        </main>
      </TenantShell>
    );
  }
  const tenant = await q1<{ retention_days: number }>("select retention_days from public.tenants where id = $1", [ctx.tenantId]);
  return (
    <TenantShell theme={theme}>
      <StartForm
        entry={token}
        context={{ stationName: ctx.stationName, city: ctx.city, plate: ctx.plate, rentalAgreement: ctx.rentalAgreement, emergency: ctx.emergency }}
        retentionDays={tenant?.retention_days ?? 30}
      />
    </TenantShell>
  );
}
