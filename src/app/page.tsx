import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { flags } from "@/lib/config/flags";

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <main className="page stack">
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      {flags.DEMO_MODE && (
        <Link className="btn btn-primary btn-block" href="/demo">
          {t("demo")}
        </Link>
      )}
    </main>
  );
}
