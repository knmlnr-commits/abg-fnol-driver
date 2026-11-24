/** Small colour helpers for theme tokens and the WCAG contrast check. */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** WCAG 2.1 relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, rounded down to two decimals so 4.499 never passes as 4.5. */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  return Math.floor(ratio * 100) / 100;
}

/** Mix colour a into colour b; weight 0 gives b, 1 gives a. */
export function mix(a: string, b: string, weight: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar * weight + br * (1 - weight), ag * weight + bg * (1 - weight), ab * weight + bb * (1 - weight)]);
}

/** White or near black, whichever reads better on the given colour. */
export function readableOn(bg: string): string {
  return contrast("#FFFFFF", bg) >= contrast("#111111", bg) ? "#FFFFFF" : "#111111";
}
