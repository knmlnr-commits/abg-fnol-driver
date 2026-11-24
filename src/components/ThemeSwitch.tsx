"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { THEMES, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Demo only: switch between the Van Ameyde look and the neutral partner theme. */
function applyDemoTheme(v: Theme) {
  document.cookie = `${THEME_COOKIE}=${v}; path=/; max-age=2592000; samesite=lax; secure`;
  document.documentElement.dataset.theme = v;
}

export function ThemeSwitch({ current }: { current: Theme | null }) {
  const t = useTranslations("demo.theme");
  const router = useRouter();
  const set = (v: Theme) => {
    applyDemoTheme(v);
    router.refresh();
  };
  return (
    <section className="card stack" aria-labelledby="theme-h">
      <h2 id="theme-h" style={{ fontSize: "1rem" }}>{t("title")}</h2>
      <div className="choice-row">
        {THEMES.map((v) => (
          <button key={v} type="button" className="choice" aria-pressed={(current ?? "va") === v} onClick={() => set(v)}>
            {t(v)}
          </button>
        ))}
      </div>
      <p className="help" style={{ margin: 0 }}>{t("note")}</p>
    </section>
  );
}
