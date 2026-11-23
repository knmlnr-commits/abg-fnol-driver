import { getTranslations } from "next-intl/server";

export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  return (
    <main className="page stack">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
    </main>
  );
}
