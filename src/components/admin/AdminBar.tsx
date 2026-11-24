"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function AdminBar({ name }: { name: string }) {
  const t = useTranslations("admin");
  const router = useRouter();
  return (
    <nav className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }} aria-label={t("title")}>
      <Link href="/admin/themes">{t("themes_title")}</Link>
      <span className="help">{t("signed_in_as", { name })}</span>
      <button type="button" className="linkbtn" onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
      }}>{t("logout")}</button>
    </nav>
  );
}
