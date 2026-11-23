"use client";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { FILLED_LOCALES } from "@/lib/domain/constants";

/** Visible language switch. Only languages with complete texts are offered. */
export function LanguageSwitch({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();
  return (
    <div className="lang" role="group" aria-label={label}>
      {FILLED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          onClick={() => {
            document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax; secure`;
            window.dispatchEvent(new CustomEvent("fnol:locale", { detail: l }));
            router.refresh();
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
