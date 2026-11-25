import { describe, expect, it } from "vitest";
import { contrast } from "@/lib/theme/color";
import { checkTheme } from "@/lib/theme/contrast";
import { VAN_AMEYDE_THEME } from "@/lib/theme/defaults";
import type { ThemeInput } from "@/lib/theme/model";

// A neutral sample palette that passes, used to vary one colour at a time.
const sample: ThemeInput = {
  displayName: "Sample brand", primary: "#4A1F5C", accent: "#0E7C86", background: "#FAF8F5", text: "#1E1B24", surface: "", fontPair: "system_sans",
};

describe("contrast ratio", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#FFFFFF")).toBe(21);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrast("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(4.5); // lightest grey that passes on white
    expect(contrast("#777777", "#FFFFFF")).toBeLessThan(4.5);
  });

  it("never rounds a failing value up to a pass", () => {
    expect(contrast("#777777", "#FFFFFF")).toBe(4.47);
  });
});

describe("theme contrast check", () => {
  it("passes the Van Ameyde default and a sample palette", () => {
    expect(checkTheme(VAN_AMEYDE_THEME).ok).toBe(true);
    expect(checkTheme(sample).ok).toBe(true);
  });

  it("refuses light text on a light background", () => {
    const r = checkTheme({ ...sample, text: "#C8C8C8" });
    expect(r.ok).toBe(false);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.key)).toContain("text_on_background");
  });

  it("refuses a primary colour too light for headings and focus rings", () => {
    const r = checkTheme({ ...sample, primary: "#FFD84D" });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.key === "primary_on_background")?.ok).toBe(false);
  });

  it("refuses a dark background where the error colour can not be read", () => {
    const r = checkTheme({ ...sample, background: "#202020", text: "#FFFFFF", primary: "#FFFFFF" });
    expect(r.checks.find((c) => c.key === "error_on_background")?.ok).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("reports a light accent as decoration without failing the theme", () => {
    const r = checkTheme(VAN_AMEYDE_THEME);
    const accent = r.info.find((c) => c.key === "accent_on_background")!;
    expect(accent.ratio).toBeLessThan(3);
    expect(r.ok).toBe(true);
  });

  it("chooses readable button text automatically", () => {
    const r = checkTheme({ ...sample, primary: "#F4C430" });
    expect(r.checks.find((c) => c.key === "button_text")?.ok).toBe(true);
  });
});
