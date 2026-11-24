import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { TenantShell } from "@/components/TenantShell";
import { flags } from "@/lib/config/flags";
import { defaultTheme } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <TenantShell theme={await defaultTheme()}>
      <main className="page stack">
        <h1>{t("title")}</h1>
        <p>{t("body")}</p>
        {flags.DEMO_MODE && (
          <Link className="btn btn-primary btn-block" href="/demo">
            {t("demo")}
          </Link>
        )}
      </main>
    </TenantShell>
  );
}
