import "server-only";
import { cookies } from "next/headers";
import { flags } from "@/lib/config/flags";
import { DEFAULT_THEME, THEME_COOKIE, isTheme, type Theme } from "@/lib/theme";

/** The presenter's choice on /demo (demo mode only), otherwise null. */
export async function demoThemeOverride(): Promise<Theme | null> {
  if (!flags.DEMO_MODE) return null;
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(v) ? v : null;
}

/** Theme to show: demo override first, then the rental partner's own setting. */
export async function effectiveTheme(tenantTheme: string | null | undefined): Promise<Theme> {
  return (await demoThemeOverride()) ?? (isTheme(tenantTheme) ? tenantTheme : DEFAULT_THEME);
}
