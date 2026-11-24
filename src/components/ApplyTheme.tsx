"use client";
import { useEffect } from "react";
import type { Theme } from "@/lib/theme";

/** Sets the rental partner's theme once the page knows which partner it is. */
export function ApplyTheme({ theme }: { theme: Theme | null | undefined }) {
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
  return null;
}
