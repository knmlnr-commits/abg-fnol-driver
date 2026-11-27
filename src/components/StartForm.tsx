"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type Ctx = { stationName: string | null; city: string | null; plate: string | null; rentalAgreement: string | null; emergency: string };

export function StartForm({ entry, context, retentionDays }: { entry: string; context: Ctx; retentionDays: number }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [privacy, setPrivacy] = useState(false);
  const [location, setLocation] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entry, locale, consent: { privacy, location } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "server_error");
      if (location && "geolocation" in navigator) {
        // Ask for the permission now, while the driver sees why.
        navigator.geolocation.getCurrentPosition(() => undefined, () => undefined, { timeout: 5000 });
      }
      router.replace(`/i/${data.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "server_error");
      setBusy(false);
    }
  }

  return (
    <main className="page stack">
      <h1>{t("start.title")}</h1>
      <p>{t("start.intro")}</p>
      <p className="alert">{t("start.safety_first", { number: context.emergency })}</p>
      <section className="card" aria-labelledby="known-h">
        <h2 id="known-h">{t("start.known")}</h2>
        {!context.stationName && !context.plate && !context.rentalAgreement && <p style={{ margin: 0 }}>{t("start.known_none")}</p>}
        <dl className="facts">
          {context.stationName && (<><dt>{t("start.station")}</dt><dd>{context.stationName}, {context.city}</dd></>)}
          {context.plate && (<><dt>{t("start.vehicle")}</dt><dd>{context.plate}</dd></>)}
          {context.rentalAgreement && (<><dt>{t("start.agreement")}</dt><dd>{context.rentalAgreement}</dd></>)}
        </dl>
      </section>
      <section className="panel-surface stack" aria-labelledby="priv-h">
        <h2 id="priv-h">{t("start.privacy_title")}</h2>
        <p>{t("start.privacy_text", { days: retentionDays })}</p>
        <p><a href="/privacy" target="_blank" rel="noopener">{t("start.privacy_more")}</a></p>
        <label className="check">
          <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
          <span>{t("start.consent_privacy")}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={location} onChange={(e) => setLocation(e.target.checked)} />
          <span>{t("start.consent_location")}</span>
        </label>
      </section>
      <p className="help">{t("start.resume_hint")}</p>
      {error && <p className="alert" role="alert">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.server_error")}</p>}
      <nav className="actions" aria-label={t("start.title")}>
        <div className="inner">
          <button type="button" className="btn btn-primary" disabled={!privacy || busy} onClick={start}>
            {busy ? t("common.loading") : t("start.start")}
          </button>
        </div>
      </nav>
    </main>
  );
}
