import { z } from "zod";

/** Font pairs on the allowlist. Only fonts already on phones; nothing is loaded from third parties. */
export const FONT_PAIRS = {
  georgia_verdana: { head: 'Georgia, "Times New Roman", serif', body: "Verdana, Geneva, sans-serif" },
  system_sans: {
    head: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  trebuchet_verdana: { head: '"Trebuchet MS", Tahoma, sans-serif', body: "Verdana, Geneva, sans-serif" },
  palatino_arial: { head: '"Palatino Linotype", Palatino, "Book Antiqua", serif', body: "Arial, Helvetica, sans-serif" },
} as const;
export type FontPair = keyof typeof FONT_PAIRS;
export const FONT_PAIR_IDS = Object.keys(FONT_PAIRS) as FontPair[];

const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "color_format").transform((v) => v.toUpperCase());
const text = (max: number) => z.string().trim().max(max);

/** What an admin can edit. The logo is handled separately (binary upload). */
export const ThemeInputSchema = z
  .object({
    displayName: text(60).min(1),
    primary: hex,
    accent: hex,
    background: hex,
    text: hex,
    /** Optional panel colour (Van Ameyde: Misty Rose). Derived from the background when empty. */
    surface: z.union([hex, z.literal("")]).optional(),
    fontPair: z.enum(FONT_PAIR_IDS as [FontPair, ...FontPair[]]),
    contactPhone: text(30).regex(/^[+0-9 ()\-]*$/, "phone_format").optional(),
    contactEmail: z.union([z.literal(""), z.email().max(254)]).optional(),
    footerText: text(160).optional(),
  })
  .strict();
export type ThemeInput = z.infer<typeof ThemeInputSchema>;

/** A theme as the public pages receive it. Never contains permission details. */
export type PublicTheme = ThemeInput & {
  id: string;
  isDefault: boolean;
  /** URL of the logo, or null for a text wordmark. */
  logoUrl: string | null;
};
