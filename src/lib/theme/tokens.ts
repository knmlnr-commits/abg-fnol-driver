import { mix, readableOn } from "./color";
import { FONT_PAIRS, type ThemeInput } from "./model";

/** Error colour is not a brand value; it stays the same in every theme and is checked too. */
export const DANGER = "#A3001B";

export type Tokens = {
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  background: string;
  text: string;
  muted: string;
  line: string;
  soft: string;
  surface: string;
  danger: string;
  fontHead: string;
  fontBody: string;
};

/** All design tokens of a theme. Derived colours are computed here, so the contrast check sees them. */
export function tokensFor(t: ThemeInput): Tokens {
  return {
    primary: t.primary,
    onPrimary: readableOn(t.primary),
    accent: t.accent,
    onAccent: readableOn(t.accent),
    background: t.background,
    text: t.text,
    muted: mix(t.text, t.background, 0.78),
    line: mix(t.text, t.background, 0.22),
    soft: mix(t.primary, t.background, 0.06),
    surface: t.surface ? mix(t.surface, t.background, 0.4) : mix(t.primary, t.background, 0.05),
    danger: DANGER,
    fontHead: FONT_PAIRS[t.fontPair].head,
    fontBody: FONT_PAIRS[t.fontPair].body,
  };
}

/** CSS custom properties for a theme, applied on the page wrapper. */
export function cssVars(t: ThemeInput): Record<string, string> {
  const k = tokensFor(t);
  return {
    "--primary": k.primary,
    "--on-primary": k.onPrimary,
    "--accent": k.accent,
    "--on-accent": k.onAccent,
    "--background": k.background,
    "--ink": k.text,
    "--muted": k.muted,
    "--line": k.line,
    "--soft": k.soft,
    "--surface": k.surface,
    "--danger": k.danger,
    "--font-head": k.fontHead,
    "--font-body": k.fontBody,
  };
}
