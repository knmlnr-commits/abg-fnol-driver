import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/domain/constants";
import { pickLocale } from "./locale";

export const LOCALE_COOKIE = "NEXT_LOCALE";

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] = v && typeof v === "object" && b && typeof b === "object" ? deepMerge(b as Messages, v as Messages) : v;
  }
  return out;
}

async function load(locale: Locale): Promise<Messages> {
  return (await import(`../messages/${locale}.json`)).default as Messages;
}

/** Language follows the visible switch (cookie), then the browser, then English. */
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale =
    cookie && (SUPPORTED_LOCALES as readonly string[]).includes(cookie)
      ? (cookie as Locale)
      : pickLocale((await headers()).get("accept-language"));
  const en = await load(DEFAULT_LOCALE);
  // Empty or partial locale files fall back to English per key.
  const messages = locale === DEFAULT_LOCALE ? en : deepMerge(en, await load(locale));
  return { locale, messages };
});
