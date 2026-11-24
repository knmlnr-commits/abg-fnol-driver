import { getTranslations } from "next-intl/server";
import { TenantShell } from "@/components/TenantShell";
import { defaultTheme } from "@/lib/server/themes";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <TenantShell theme={await defaultTheme()}>
      <main className="page stack">
        <h1>{t("title")}</h1>
        <p>{t("body")}</p>
      </main>
    </TenantShell>
  );
}
