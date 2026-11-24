"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { EVIDENCE_SLOTS } from "@/lib/domain/constants";
import type { CompletenessView, EvidenceView, IncidentView } from "@/lib/client/api";
import { EvidenceCapture } from "./EvidenceCapture";
import { Summary } from "./Review";

/** Confirmation: reference, summary, next steps, personal link and adding documents later. */
export function Done({ token, view, onChange }: { token: string; view: IncidentView; onChange: (ev: EvidenceView[], c?: CompletenessView) => void }) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const link = typeof window !== "undefined" ? window.location.href : "";
  const missingEvidence = view.completeness.missing.filter((m) => m.key.startsWith("photo_")).map((m) => m.key.slice(6));
  // Missing photos first, then every other slot as optional.
  const reqs = [
    ...view.requirements.filter((r) => missingEvidence.includes(r.slot)),
    ...EVIDENCE_SLOTS.filter((s) => !missingEvidence.includes(s)).map((slot) => ({ slot, level: "optional" as const })),
  ];

  return (
    <main className="page stack">
      <h1 tabIndex={-1}>{t("done.title")}</h1>
      <section className="card" aria-labelledby="ref-h">
        <h2 id="ref-h" className="help" style={{ fontFamily: "var(--font-body)", fontSize: "0.95rem" }}>{t("done.reference")}</h2>
        <p className="ref">{view.reference}</p>
      </section>
      {view.completeness.missing.length > 0 && (
        <p className="notice">{t("done.gaps", { count: view.completeness.missing.length })}</p>
      )}
      <section aria-labelledby="next-h">
        <h2 id="next-h">{t("done.next_title")}</h2>
        <ol style={{ paddingLeft: 22, margin: 0 }}>
          <li>{t("done.next_1")}</li>
          <li>{t("done.next_2")}</li>
          <li>{t("done.next_3")}</li>
        </ol>
      </section>
      <section className="card stack" aria-labelledby="link-h">
        <h2 id="link-h">{t("done.link_title")}</h2>
        <p className="help">{t("done.link_help")}</p>
        <button type="button" className="btn btn-secondary btn-block" onClick={async () => {
          try { await navigator.clipboard.writeText(link); setCopied(true); } catch {}
        }}>
          {copied ? t("done.copied") : t("done.copy")}
        </button>
      </section>
      <section className="panel-surface" aria-labelledby="sum-h">
        <h2 id="sum-h">{t("done.summary")}</h2>
        <Summary draft={view.draft} view={view} />
      </section>
      {adding ? (
        <section aria-labelledby="add-h">
          <h2 id="add-h">{t("docreq.added_title", { reference: view.reference })}</h2>
          <EvidenceCapture token={token} incidentKey={view.reference} requirements={reqs} evidence={view.evidence}
            locationConsent={view.draft.consent?.location === true} canRemove={false} optionalOpen onChange={onChange} />
        </section>
      ) : (
        <button type="button" className="btn btn-primary btn-block" onClick={() => setAdding(true)}>{t("done.add_docs")}</button>
      )}
    </main>
  );
}
