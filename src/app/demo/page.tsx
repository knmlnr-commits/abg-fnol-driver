import QRCode from "qrcode";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { DemoSwitcher, type DemoTenant } from "@/components/DemoSwitcher";
import { TenantShell } from "@/components/TenantShell";
import { flags } from "@/lib/config/flags";
import { q } from "@/lib/server/db";
import { signEntryToken } from "@/lib/server/intake";
import { defaultTheme, demoTenants } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

/** Demo only: fictional QR codes per tenant, with a live theme switch. Behind DEMO_MODE. */
export default async function DemoPage() {
  const t = await getTranslations("demo");
  if (!flags.DEMO_MODE) {
    return (
      <TenantShell theme={await defaultTheme()}>
        <main className="page"><p>{t("disabled")}</p></main>
      </TenantShell>
    );
  }
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const rows = await q<{ id: string; tenant_id: string; kind: "station" | "vehicle" | "agreement"; label: string; city: string }>(
    `select e.id, e.tenant_id, e.kind, e.label, s.city from public.entry_tokens e join public.stations s on s.id = e.station_id
      where e.revoked_at is null order by s.city, e.kind`,
  );
  const cards = await Promise.all(
    rows.map(async (r) => {
      const url = `${origin}/r/${await signEntryToken(r.id)}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#000000", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
      return { id: r.id, tenantId: r.tenant_id, kind: r.kind, label: r.label, city: r.city, url, svg };
    }),
  );
  const tenants: DemoTenant[] = (await demoTenants()).map((x) => ({
    id: x.id,
    name: x.name,
    theme: x.theme,
    cards: cards.filter((c) => c.tenantId === x.id),
  }));
  return <DemoSwitcher tenants={tenants} />;
}
