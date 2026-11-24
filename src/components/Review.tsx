"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Draft } from "@/lib/domain/schema";
import { api, errorKey, type IncidentView } from "@/lib/client/api";

export function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" style={{ stroke: "var(--soft)" }} strokeWidth="8" />
      <circle cx="36" cy="36" r={r} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth="8" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 36 36)" strokeLinecap="round" />
      <text x="36" y="41" textAnchor="middle" fontWeight="700" fontSize="15" style={{ fill: "var(--primary)", fontFamily: "var(--font-body)" }}>{score}%</text>
    </svg>
  );
}

/** Completeness check: what is missing and why it matters. Submit is allowed with gaps. */
export function Review({ token, view, draft, onFix, onBack, onSubmitted }: {
  token: string; view: IncidentView; draft: Draft; onFix: (step: string) => void; onBack: () => void; onSubmitted: (v: IncidentView) => void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { score, missing } = view.completeness;
  const requiredMissing = missing.filter((m) => m.level === "required").length;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api(token, "/api/incident/submit", { method: "POST" });
      onSubmitted(await api<IncidentView>(token, "/api/incident"));
    } catch (e) {
      setError(errorKey(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="score">
        <ScoreRing score={score} />
        <p style={{ margin: 0 }}><strong>{t("steps.review.score", { score })}</strong></p>
      </div>
      {missing.length === 0 ? (
        <p className="notice">{t("steps.review.all_good")}</p>
      ) : (
        <section aria-labelledby="missing-h">
          <h2 id="missing-h">{t("steps.review.missing_title")}</h2>
          <ul className="missing">
            {missing.map((m) => (
              <li key={m.key}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <strong>{t(`missing.${m.key}.label`)}</strong>
                  <span className={`tag ${m.level === "required" ? "tag-required" : ""}`}>{t(`common.${m.level}`)}</span>
                </div>
                <div className="why">{t(`missing.${m.key}.why`)}</div>
                <button type="button" className="linkbtn" onClick={() => onFix(m.step)}>{t("steps.review.fix")}</button>
              </li>
            ))}
          </ul>
          <p className="help">{t("steps.review.gaps_note")}</p>
        </section>
      )}
      <section className="panel-rose" aria-labelledby="sum-h">
        <h2 id="sum-h">{t("steps.review.summary")}</h2>
        <Summary draft={draft} view={view} />
      </section>
      {error && <p className="alert" role="alert">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.server_error")}</p>}
      <nav className="actions" aria-label={t("steps.review.title")}>
        <div className="inner">
          <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy}>{t("common.back")}</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? t("common.saving") : requiredMissing > 0 ? t("steps.review.submit_anyway") : t("steps.review.submit")}
          </button>
        </div>
      </nav>
    </div>
  );
}

export function Summary({ draft, view }: { draft: Draft; view: IncidentView }) {
  const t = useTranslations();
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString(draft.locale ?? undefined, { dateStyle: "medium", timeStyle: "short" }) : "");
  const rows: [string, string | undefined][] = [
    [t("steps.vehicle.plate"), draft.vehicle?.plate],
    [t("steps.vehicle.agreement"), draft.vehicle?.rentalAgreement],
    [t("steps.incident_type.title"), draft.incidentType && t(`steps.incident_type.${draft.incidentType}`)],
    [t("steps.when_where.date"), fmt(draft.occurredAt)],
    [t("steps.other_party.plate"), draft.otherParty?.plate],
    [t("steps.damage.title"), draft.damageZones?.map((z) => t(`steps.damage.zones.${z}`)).join(", ")],
    [t("steps.photos.title"), t("done.photos", { count: view.evidence.length })],
  ];
  return (
    <dl className="facts">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
