import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  // Prototype, demo and preview pages are never indexed.
  return { title: t("title"), robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** The tenant theme is applied per page by TenantShell; the root layout carries no brand values. */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
