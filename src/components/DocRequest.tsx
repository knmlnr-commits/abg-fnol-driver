"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api, errorKey, type IncidentView } from "@/lib/client/api";
import { EvidenceCapture } from "./EvidenceCapture";
import { ApplyTheme } from "./ApplyTheme";

/** A handler asked for specific items. Same capture component, limited to those items. */
export function DocRequest({ token }: { token: string }) {
  const t = useTranslations();
  const [view, setView] = useState<IncidentView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<IncidentView>(token, "/api/incident").then(setView).catch((e) => setError(errorKey(e)));
  }, [token]);

  if (error) return <main className="page"><p className="alert" role="alert">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.server_error")}</p></main>;
  if (!view || !view.request) return <main className="page"><p aria-busy="true">{t("common.loading")}</p></main>;

  const slots = view.request.slots;
  const complete = slots.every((s) => view.evidence.some((e) => e.slot === s));
  return (
    <main className="page stack">
      <ApplyTheme theme={view.theme} />
      <h1>{t("docreq.title")}</h1>
      <p>{t("docreq.intro", { reference: view.reference })}</p>
      {view.request.message && (
        <div className="panel-rose">
          <h2 style={{ fontSize: "1rem" }}>{t("docreq.message")}</h2>
          <p style={{ margin: 0 }}>{view.request.message}</p>
        </div>
      )}
      {complete && <p className="notice" role="status">{t("docreq.done")}</p>}
      <EvidenceCapture token={token} incidentKey={`${view.reference}:${view.request.id}`}
        requirements={slots.map((slot) => ({ slot, level: "required" as const }))}
        evidence={view.evidence.filter((e) => slots.includes(e.slot))} locationConsent={false} canRemove={false} showOptional={false}
        onChange={(ev) => setView({ ...view, evidence: ev })} />
    </main>
  );
}
