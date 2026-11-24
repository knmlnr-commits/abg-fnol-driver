/**
 * Logo upload rules. SVG files can carry script, so they are checked strictly and only ever
 * served as an image with a locked down Content-Security-Policy.
 */
export const MAX_LOGO_BYTES = 200 * 1024;
export type LogoMime = "image/svg+xml" | "image/png";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SVG_FORBIDDEN = /<script|<foreignobject|<iframe|<embed|<object|<!entity|<!doctype|\bon[a-z]+\s*=|javascript:|data:text|(?:xlink:)?href\s*=\s*["'](?!#)|@import|url\(\s*["']?(?!#)/i;

export type LogoCheck = { ok: true; mime: LogoMime } | { ok: false; code: "logo_too_large" | "logo_type" | "logo_unsafe" | "logo_empty" };

export function checkLogo(bytes: Uint8Array, declared: string): LogoCheck {
  if (!bytes.length) return { ok: false, code: "logo_empty" };
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, code: "logo_too_large" };
  if (declared === "image/png") {
    return PNG_MAGIC.every((b, i) => bytes[i] === b) ? { ok: true, mime: "image/png" } : { ok: false, code: "logo_type" };
  }
  if (declared === "image/svg+xml") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const start = text.replace(/^﻿/, "").trimStart();
    if (!/^(<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(start)) return { ok: false, code: "logo_type" };
    if (SVG_FORBIDDEN.test(text)) return { ok: false, code: "logo_unsafe" };
    return { ok: true, mime: "image/svg+xml" };
  }
  return { ok: false, code: "logo_type" };
}

/** Headers for serving a logo: image only, nothing in it can run. */
export const LOGO_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
