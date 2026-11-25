"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PublicTheme } from "@/lib/theme/model";
import { TenantShell } from "./TenantShell";

export type DemoTenant = {
  id: string;
  name: string;
  theme: PublicTheme;
  cards: { id: string; kind: "station" | "vehicle" | "agreement"; label: string; city: string; url: string; svg: string }[];
};

/**
 * Presenter switch between tenants, without a reload. It changes the look of this page and shows
 * that tenant's QR codes. Once a QR code is opened, the tenant in the signed token decides the theme.
 */
export function DemoSwitcher({ tenants }: { tenants: DemoTenant[] }) {
  const t = useTranslations("demo");
  const [active, setActive] = useState(() => tenants.find((x) => !x.theme.isDefault)?.id ?? tenants[0]?.id);
  const current = tenants.find((x) => x.id === active) ?? tenants[0];
  if (!current) return null;
  return (
    <TenantShell theme={current.theme}>
      <main className="page stack" style={{ maxWidth: 960 }}>
        <h1>{t("title")}</h1>
        <p>{t("intro")}</p>
        <section className="card stack" aria-labelledby="switch-h">
          <h2 id="switch-h" style={{ fontSize: "1rem" }}>{t("switch")}</h2>
          <div className="choice-row">
            {tenants.map((x) => (
              <button key={x.id} type="button" className="choice" aria-pressed={x.id === current.id} onClick={() => setActive(x.id)}>
                <span>{x.theme.displayName}</span>
                <small>{x.theme.isDefault ? t("role_default") : t("role_tenant")}</small>
              </button>
            ))}
          </div>
          <p className="help" style={{ margin: 0 }}>{t("switch_note")}</p>
        </section>
        <div className="qrgrid" aria-live="polite">
          {current.cards.map((c) => (
            <section key={c.id} className="card">
              <h2 style={{ fontSize: "1rem" }}>{t(`kinds.${c.kind}`)}</h2>
              <p className="help" style={{ margin: 0 }}>{c.label}, {c.city}</p>
              <div className="qr" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <a className="btn btn-secondary btn-block" href={c.url}>{t("open")}</a>
            </section>
          ))}
        </div>
      </main>
    </TenantShell>
  );
}
