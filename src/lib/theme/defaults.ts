import type { PublicTheme } from "./model";

/**
 * Van Ameyde default theme. Used for tenants without their own published theme, and as a fallback
 * when the database has no default row. This file is the only place with Van Ameyde colour values.
 */
export const VAN_AMEYDE_THEME: PublicTheme = {
  id: "default",
  isDefault: true,
  logoUrl: null,
  displayName: "Van Ameyde",
  primary: "#07017E", // Navy
  accent: "#00D8B9", // Turquoise
  background: "#FFFFFF",
  text: "#07017E",
  surface: "#E5D3D1", // Misty Rose
  fontPair: "georgia_verdana",
  contactPhone: "",
  contactEmail: "",
  footerText: "",
};
