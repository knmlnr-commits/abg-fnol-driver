import { contrast } from "./color";
import type { ThemeInput } from "./model";
import { tokensFor } from "./tokens";

export type ContrastCheck = {
  /** i18n key under admin.checks */
  key: string;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  ok: boolean;
};

/**
 * WCAG 2.1 AA contrast check for a theme, based on how the interface uses each token.
 * - Normal text needs 4.5:1 (1.4.3).
 * - Focus rings and borders that show state need 3:1 (1.4.11); the app draws those in the primary colour.
 * - The accent colour is decoration only: it always sits next to a primary coloured border or next to
 *   text that says the same thing (step count, tags). So accent against the background is reported,
 *   but not required. Text on the accent is required.
 */
export function checkTheme(t: ThemeInput): { ok: boolean; checks: ContrastCheck[]; info: ContrastCheck[] } {
  const k = tokensFor(t);
  const c = (key: string, fg: string, bg: string, required: number): ContrastCheck => {
    const ratio = contrast(fg, bg);
    return { key, fg, bg, ratio, required, ok: ratio >= required };
  };
  const checks = [
    c("text_on_background", k.text, k.background, 4.5),
    c("muted_on_background", k.muted, k.background, 4.5),
    c("text_on_surface", k.text, k.surface, 4.5),
    c("primary_on_background", k.primary, k.background, 4.5),
    c("button_text", k.onPrimary, k.primary, 4.5),
    c("text_on_accent", k.onAccent, k.accent, 4.5),
    c("error_on_background", k.danger, k.background, 4.5),
    c("borders_on_background", k.primary, k.soft, 3),
  ];
  const info = [{ ...c("accent_on_background", k.accent, k.background, 3), ok: true }];
  return { ok: checks.every((x) => x.ok), checks, info };
}
