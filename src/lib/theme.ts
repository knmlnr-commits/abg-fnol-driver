export const THEMES = ["va", "partner_red"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "va";
/** Demo only: lets the presenter switch the theme on /demo. */
export const THEME_COOKIE = "fnol_theme";

export function isTheme(v: unknown): v is Theme {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}
