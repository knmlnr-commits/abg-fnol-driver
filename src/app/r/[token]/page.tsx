import { getTranslations } from "next-intl/server";
import { ApplyTheme } from "@/components/ApplyTheme";
import { StartForm } from "@/components/StartForm";
import { effectiveTheme } from "@/lib/server/theme";
import { q1 } from "@/lib/server/db";
import { HttpError } from "@/lib/server/guard";
import { resolveEntry, type EntryContext } from "@/lib/server/intake";

export const dynamic = "force-dynamic";

/** Landing page of a scanned QR code: prefilled context, privacy notice and consent. */
export default async function EntryPage({ params }: PageProps<"/r/[token]">) {
  const { token } = await params;
  const t = await getTranslations("errors");
  let ctx: EntryContext;
  try {
    ctx = await resolveEntry(token);
  } catch (e) {
    const code = e instanceof HttpError ? e.code : "server_error";
    return (
      <main className="page">
        <p className="alert" role="alert">{t.has(code) ? t(code) : t("server_error")}</p>
      </main>
    );
  }
  const tenant = await q1<{ retention_days: number; theme: string }>("select retention_days, theme from public.tenants where id = $1", [ctx.tenantId]);
  const theme = await effectiveTheme(tenant?.theme);
  return (
    <>
    <ApplyTheme theme={theme} />
    <StartForm
      entry={token}
      context={{ stationName: ctx.stationName, city: ctx.city, plate: ctx.plate, rentalAgreement: ctx.rentalAgreement, emergency: ctx.emergency }}
      retentionDays={tenant?.retention_days ?? 30}
    />
    </>
  );
}
