import QRCode from "qrcode";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { flags } from "@/lib/config/flags";
import { q } from "@/lib/server/db";
import { signEntryToken } from "@/lib/server/intake";
import { demoThemeOverride } from "@/lib/server/theme";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export const dynamic = "force-dynamic";

/** Demo only: fictional QR codes to start the driver flow. Behind DEMO_MODE. */
export default async function DemoPage() {
  const t = await getTranslations("demo");
  if (!flags.DEMO_MODE) return <main className="page"><p>{t("disabled")}</p></main>;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const rows = await q<{ id: string; kind: "station" | "vehicle" | "agreement"; label: string; name: string; city: string }>(
    `select e.id, e.kind, e.label, s.name, s.city from public.entry_tokens e join public.stations s on s.id = e.station_id
      where e.revoked_at is null order by s.city, e.kind`,
  );
  const cards = await Promise.all(
    rows.map(async (r) => {
      const url = `${origin}/r/${await signEntryToken(r.id)}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#000000", light: "#FFFFFF" }, errorCorrectionLevel: "M" });
      return { ...r, url, svg };
    }),
  );
  return (
    <main className="page stack" style={{ maxWidth: 960 }}>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <ThemeSwitch current={await demoThemeOverride()} />
      <div className="qrgrid">
        {cards.map((c) => (
          <section key={c.id} className="card">
            <h2 style={{ fontSize: "1rem" }}>{t(`kinds.${c.kind}`)}</h2>
            <p className="help" style={{ margin: 0 }}>{c.label}, {c.city}</p>
            <div className="qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <a className="btn btn-secondary btn-block" href={c.url}>{t("open")}</a>
          </section>
        ))}
      </div>
    </main>
  );
}
