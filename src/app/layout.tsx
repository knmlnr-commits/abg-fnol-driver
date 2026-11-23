import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("app");
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <div className="shell">
            <header className="topbar">
              <div>
                <div className="brand">{t("partner")}</div>
                <div className="badge">{t("prototype")}</div>
              </div>
              <LanguageSwitch label={t("language")} />
            </header>
            {children}
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
