/* eslint-disable @next/next/no-img-element -- logos come from our own route, sized by CSS */
import { useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { cssVars } from "@/lib/theme/tokens";
import type { PublicTheme } from "@/lib/theme/model";
import { LanguageSwitch } from "./LanguageSwitch";

/**
 * Page frame for one tenant theme: theme tokens, demo banner, header with logo, footer.
 * Every theme other than the default shows the demo banner. The footer always says Powered by Van Ameyde.
 */
export function TenantShell({ theme, children }: { theme: PublicTheme; children: ReactNode }) {
  const t = useTranslations("shell");
  const contact = [theme.contactPhone, theme.contactEmail].filter(Boolean);
  return (
    <div className="shell" style={cssVars(theme) as CSSProperties}>
      {!theme.isDefault && (
        <div className="demo-banner" role="note">
          {t("banner")}
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          {theme.logoUrl ? (
            <img className="logo" src={theme.logoUrl} alt={theme.displayName} />
          ) : (
            <span className="wordmark">{theme.displayName}</span>
          )}
          <div className="badge">{t("prototype")}</div>
        </div>
        <LanguageSwitch label={t("language")} />
      </header>
      {children}
      <footer className="footer">
        {contact.length > 0 && (
          <p>
            {t("contact")}: {theme.contactPhone && <a href={`tel:${theme.contactPhone.replace(/[^+0-9]/g, "")}`}>{theme.contactPhone}</a>}
            {theme.contactPhone && theme.contactEmail && ", "}
            {theme.contactEmail && <a href={`mailto:${theme.contactEmail}`}>{theme.contactEmail}</a>}
          </p>
        )}
        {theme.footerText && <p>{theme.footerText}</p>}
        <p className="powered">{t("powered")}</p>
      </footer>
    </div>
  );
}
