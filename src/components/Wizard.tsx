"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { PLATE_COUNTRIES } from "@/lib/config/countries";
import { resolveStep, stepsFor, type StepId } from "@/lib/domain/branching";
import {
  COLLISION_KINDS, GLASS_DAMAGE, GLASS_PARTS, HIT_OBJECTS, INCIDENT_TYPES, IRF_STATUS, THEFT_KINDS,
  type DamageZone,
} from "@/lib/domain/constants";
import type { Draft } from "@/lib/domain/schema";
import { api, errorKey, track, type CompletenessView, type IncidentView } from "@/lib/client/api";
import { currentPosition } from "@/lib/client/uploadQueue";
import { CarOutline } from "./CarOutline";
import { EvidenceCapture } from "./EvidenceCapture";
import { Review } from "./Review";
import { Done } from "./Done";

const MapPicker = dynamic(() => import("./MapPicker").then((m) => m.MapPicker), { ssr: false, loading: () => <div className="map" /> });

/** Which part of the draft each step edits; only that part is sent to the server. */
const STEP_KEYS: Partial<Record<StepId, (keyof Draft)[]>> = {
  injured: ["safety"], police: ["safety"], police_reference: ["safety"], vehicle: ["vehicle"], contact: ["contact"],
  incident_type: ["incidentType"], when_where: ["occurredAt", "location"], collision_kind: ["details"],
  other_party: ["otherParty"], irf: ["details"], hit_object: ["details"], found_at: ["details"], theft_kind: ["details"],
  theft_items: ["details"], keys: ["details"], glass_part: ["details"], glass_damage: ["details"], drivable: ["details"],
  description: ["description"], damage: ["damageZones"], witnesses: ["witnesses"],
};

const toLocalInput = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);
const stepStoreKey = (ref: string) => `fnol:step:${ref}`;

export function Wizard({ token }: { token: string }) {
  const t = useTranslations();
  const [data, setData] = useState<IncidentView | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [step, setStep] = useState<StepId>("injured");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const steps: StepId[] = useMemo(() => stepsFor(draft).filter((s) => s !== "privacy"), [draft]);
  const index = Math.max(0, steps.indexOf(step));

  // Load the draft. The phone only remembers the current step, never the answers.
  useEffect(() => {
    api<IncidentView>(token, "/api/incident")
      .then((v) => {
        setData(v);
        setDraft(v.draft);
        let saved: string | null = null;
        try { saved = localStorage.getItem(stepStoreKey(v.reference)); } catch {}
        const wanted = (saved || v.step || "injured") as StepId;
        const s = resolveStep(v.draft, wanted === "privacy" ? "injured" : wanted);
        setStep(s === "privacy" ? "injured" : s);
        if (v.status === "draft" && v.step && v.step !== "injured") track(token, "flow_resumed", s);
      })
      .catch((e) => setError(errorKey(e)));
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [token]);

  // Measurement: every step view. Move focus to the heading for screen readers.
  useEffect(() => {
    if (!data || data.status !== "draft") return;
    track(token, "step_viewed", step);
    try { localStorage.setItem(stepStoreKey(data.reference), step); } catch {}
    heading.current?.focus();
  }, [step, data, token]);

  const update = useCallback((patch: Partial<Draft>) => {
    setFieldError(null);
    setDraft((d) => {
      const out: Draft = { ...d };
      for (const [k, v] of Object.entries(patch) as [keyof Draft, unknown][]) {
        const prev = d[k];
        (out as Record<string, unknown>)[k] =
          v && typeof v === "object" && !Array.isArray(v) && prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev, ...v } : v;
      }
      return out;
    });
  }, []);

  async function save(current: StepId, d: Draft, next: StepId | null) {
    const keys = STEP_KEYS[current] ?? [];
    const patch = Object.fromEntries(keys.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ draft: Draft; completeness: CompletenessView; requirements: IncidentView["requirements"] }>(token, "/api/incident", {
        method: "PATCH",
        body: { patch, step: next ?? current },
      });
      setDraft(r.draft);
      setData((x) => (x ? { ...x, completeness: r.completeness, requirements: r.requirements } : x));
      track(token, "step_completed", current);
      return r.draft;
    } catch (e) {
      setError(errorKey(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function goNext(d: Draft = draft) {
    // Date and time default to now when the driver does not change them.
    if (step === "when_where" && !d.occurredAt) d = { ...d, occurredAt: new Date().toISOString() };
    const v = validate(step, d);
    if (v) { setFieldError(v); return; }
    const list: StepId[] = stepsFor(d).filter((s) => s !== "privacy");
    const next = list[list.indexOf(step) + 1] ?? null;
    const saved = await save(step, d, next);
    if (saved && next) {
      const target = resolveStep(saved, next);
      setStep(target);
      // Ask the device for the incident place, with consent only.
      if (target === "when_where" && !saved.location && saved.consent?.location) locate();
    }
  }

  /** One tap answers: set the value and move on. */
  function choose(patch: Partial<Draft>) {
    const d = { ...draft, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => {
      const prev = draft[k as keyof Draft];
      return [k, v && typeof v === "object" && !Array.isArray(v) && prev && typeof prev === "object" ? { ...prev, ...v } : v];
    })) } as Draft;
    setDraft(d);
    goNext(d);
  }

  function goBack() {
    setFieldError(null);
    if (index > 0) setStep(steps[index - 1]);
  }

  function validate(s: StepId, d: Draft): string | null {
    if (s === "contact" && !d.contact?.email?.trim() && !d.contact?.phone?.trim()) return t("steps.contact.need_one");
    if (s === "contact" && d.contact?.email && !/^\S+@\S+\.\S+$/.test(d.contact.email)) return t("errors.invalid_input");
    return null;
  }

  // GPS on the "when and where" step, with consent only.
  const [geo, setGeo] = useState<"idle" | "locating" | "ok" | "denied">("idle");
  const locate = useCallback(async () => {
    setGeo("locating");
    const p = await currentPosition();
    if (p) {
      update({ location: { lat: p.lat, lng: p.lng, accuracyM: Math.round(p.accuracy), source: "gps" } });
      setGeo("ok");
    } else setGeo("denied");
  }, [update]);

  if (error && !data) {
    return (
      <main className="page">
        <p className="alert" role="alert">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.server_error")}</p>
      </main>
    );
  }
  if (!data) return <main className="page"><p aria-busy="true">{t("common.loading")}</p></main>;

  if (data.status === "submitted") {
    return <Done token={token} view={data} onChange={(ev, c) => setData({ ...data, evidence: ev, completeness: c ?? data.completeness })} />;
  }

  const yesNo = (field: (v: "yes" | "no") => Partial<Draft>, current?: "yes" | "no") => (
    <div className="choice-row">
      {(["yes", "no"] as const).map((v) => (
        <button key={v} type="button" className="choice" aria-pressed={current === v} disabled={busy} onClick={() => choose(field(v))}>
          {t(`common.${v}`)}
        </button>
      ))}
    </div>
  );

  const choices = <T extends string>(ns: string, options: readonly T[], current: T | undefined, field: (v: T) => Partial<Draft>, hints = false) => (
    <div className="choices">
      {options.map((o) => (
        <button key={o} type="button" className="choice" aria-pressed={current === o} disabled={busy} onClick={() => choose(field(o))}>
          <span>{t(`${ns}.${o}` as string)}</span>
          {hints && <small>{t(`${ns}.${o}_hint` as string)}</small>}
        </button>
      ))}
    </div>
  );

  const text = (id: string, label: string, value: string | undefined, onChange: (v: string) => void, opts: { type?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; autoComplete?: string; help?: string; max?: number } = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" type={opts.type ?? "text"} inputMode={opts.inputMode} autoComplete={opts.autoComplete ?? "off"} maxLength={opts.max ?? 120}
        value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-describedby={opts.help ? `${id}-help` : undefined} />
      {opts.help && <p id={`${id}-help`} className="help">{opts.help}</p>}
    </div>
  );

  const area = (id: string, label: string, value: string | undefined, onChange: (v: string) => void, max = 2000) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="input" maxLength={max} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  // Steps answered with one tap have no Next button.
  const autoSteps: StepId[] = ["police", "incident_type", "collision_kind", "irf", "hit_object", "theft_kind", "keys", "glass_part", "glass_damage", "drivable"];
  const showNext = !autoSteps.includes(step) && !(step === "injured" && draft.safety?.injured !== "yes") && step !== "review";

  const body = (() => {
    switch (step) {
      case "injured":
        return (
          <>
            <div className="choice-row">
              {(["yes", "no"] as const).map((v) => (
                <button key={v} type="button" className="choice" aria-pressed={draft.safety?.injured === v} disabled={busy}
                  onClick={() => (v === "yes" ? update({ safety: { injured: "yes" } }) : choose({ safety: { injured: "no" } }))}>
                  {t(`common.${v}`)}
                </button>
              ))}
            </div>
            {draft.safety?.injured === "yes" && (
              <div className="stack" style={{ marginTop: 16 }}>
                <a className="emergency" href={`tel:${data.context.emergency}`}>{t("steps.injured.call", { number: data.context.emergency })}</a>
                <p className="help">{t("steps.injured.call_hint")}</p>
              </div>
            )}
          </>
        );
      case "police":
        return yesNo((v) => ({ safety: { policeInvolved: v } }), draft.safety?.policeInvolved);
      case "police_reference":
        return (<><p className="help">{t("steps.police_reference.help")}</p>
          {text("police-ref", t("steps.police_reference.label"), draft.safety?.policeReference, (v) => update({ safety: { policeReference: v } }), { max: 64 })}</>);
      case "vehicle":
        return (
          <div className="stack">
            {text("plate", t("steps.vehicle.plate"), draft.vehicle?.plate, (v) => update({ vehicle: { plate: v.toUpperCase() } }), { max: 16 })}
            {text("agreement", t("steps.vehicle.agreement"), draft.vehicle?.rentalAgreement, (v) => update({ vehicle: { rentalAgreement: v } }), { max: 32, help: t("steps.vehicle.agreement_help") })}
          </div>
        );
      case "contact":
        return (
          <div className="stack">
            <p className="help">{t("steps.contact.help")}</p>
            {text("email", t("steps.contact.email"), draft.contact?.email, (v) => update({ contact: { email: v } }), { type: "email", inputMode: "email", autoComplete: "email", max: 254 })}
            {text("phone", t("steps.contact.phone"), draft.contact?.phone, (v) => update({ contact: { phone: v } }), { type: "tel", inputMode: "tel", autoComplete: "tel", max: 24 })}
          </div>
        );
      case "incident_type":
        return choices("steps.incident_type", INCIDENT_TYPES, draft.incidentType, (v) => ({ incidentType: v }), true);
      case "when_where": {
        const loc = draft.location;
        const center = loc ?? { lat: data.context.lat ?? 50.1, lng: data.context.lng ?? 8.7 };
        return (
          <div className="stack">
            <div className="field">
              <label htmlFor="occurred">{t("steps.when_where.date")}, {t("steps.when_where.time")}</label>
              <input id="occurred" className="input" type="datetime-local" max={toLocalInput()} value={toLocalInput(draft.occurredAt)}
                onChange={(e) => update({ occurredAt: fromLocalInput(e.target.value) })} />
            </div>
            <MapPicker value={loc ? { lat: loc.lat, lng: loc.lng } : null} center={center} label={t("steps.when_where.map_label")}
              onChange={(p) => update({ location: { lat: p.lat, lng: p.lng, source: "manual" } })} />
            <p className="help" aria-live="polite">
              {geo === "locating" ? t("steps.when_where.locating")
                : loc?.source === "manual" ? t("steps.when_where.manual")
                : loc?.source === "gps" ? `${t("steps.when_where.located")} ${loc.accuracyM ? t("steps.when_where.accuracy", { meters: loc.accuracyM }) : ""}`
                : t("steps.when_where.denied")}
            </p>
            {draft.consent?.location && (
              <button type="button" className="btn btn-secondary btn-block" onClick={locate}>{t("steps.when_where.locate")}</button>
            )}
          </div>
        );
      }
      case "collision_kind":
        return choices("steps.collision_kind", COLLISION_KINDS, draft.details?.collisionKind, (v) => ({ details: { collisionKind: v } }));
      case "other_party":
        return (
          <div className="stack">
            <p className="help">{t("steps.other_party.help")}</p>
            <div className="grid2">
              {text("op-plate", t("steps.other_party.plate"), draft.otherParty?.plate, (v) => update({ otherParty: { plate: v.toUpperCase() } }), { max: 16 })}
              <div className="field">
                <label htmlFor="op-country">{t("steps.other_party.country")}</label>
                <select id="op-country" className="input" value={draft.otherParty?.country ?? data.context.country ?? ""} onChange={(e) => update({ otherParty: { country: e.target.value } })}>
                  <option value="">{t("steps.other_party.choose")}</option>
                  {PLATE_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {text("op-insurer", t("steps.other_party.insurer"), draft.otherParty?.insurer, (v) => update({ otherParty: { insurer: v } }))}
            {text("op-name", t("steps.other_party.name"), draft.otherParty?.name, (v) => update({ otherParty: { name: v } }))}
            {text("op-phone", t("steps.other_party.phone"), draft.otherParty?.phone, (v) => update({ otherParty: { phone: v } }), { type: "tel", inputMode: "tel", max: 24 })}
            {text("op-email", t("steps.other_party.email"), draft.otherParty?.email, (v) => update({ otherParty: { email: v } }), { type: "email", inputMode: "email", max: 254 })}
          </div>
        );
      case "irf":
        return (<><p className="help">{t("steps.irf.help")}</p>{choices("steps.irf", IRF_STATUS, draft.details?.irfStatus, (v) => ({ details: { irfStatus: v } }))}</>);
      case "hit_object":
        return choices("steps.hit_object", HIT_OBJECTS, draft.details?.hitObject, (v) => ({ details: { hitObject: v } }));
      case "found_at":
        return (
          <div className="field">
            <p className="help">{t("steps.found_at.help")}</p>
            <label htmlFor="found" className="sr-only">{t("steps.found_at.title")}</label>
            <input id="found" className="input" type="datetime-local" max={toLocalInput()} value={toLocalInput(draft.details?.foundAt)}
              onChange={(e) => update({ details: { foundAt: fromLocalInput(e.target.value) } })} />
          </div>
        );
      case "theft_kind":
        return choices("steps.theft_kind", THEFT_KINDS, draft.details?.theftKind, (v) => ({ details: { theftKind: v } }));
      case "theft_items":
        return (<><p className="help">{t("steps.theft_items.help")}</p>{area("items", t("steps.theft_items.label"), draft.details?.itemsTaken, (v) => update({ details: { itemsTaken: v } }), 500)}</>);
      case "keys":
        return (<><p className="help">{t("steps.keys.help")}</p>{yesNo((v) => ({ details: { keysPresent: v } }), draft.details?.keysPresent)}</>);
      case "glass_part":
        return choices("steps.glass_part", GLASS_PARTS, draft.details?.glassPart, (v) => ({ details: { glassPart: v } }));
      case "glass_damage":
        return choices("steps.glass_damage", GLASS_DAMAGE, draft.details?.glassDamage, (v) => ({ details: { glassDamage: v } }));
      case "drivable":
        return (<><p className="help">{t("steps.drivable.help")}</p>{yesNo((v) => ({ details: { drivable: v } }), draft.details?.drivable)}</>);
      case "description":
        return (<><p className="help">{t("steps.description.help")}</p>{area("desc", t("steps.description.label"), draft.description, (v) => update({ description: v }))}</>);
      case "damage":
        return (<><p className="help">{t("steps.damage.help")}</p><CarOutline value={(draft.damageZones ?? []) as DamageZone[]} onChange={(v) => update({ damageZones: v })} /></>);
      case "photos":
        return (
          <>
            <p className="help">{t("steps.photos.help")}</p>
            <EvidenceCapture token={token} incidentKey={data.reference} requirements={data.requirements} evidence={data.evidence}
              locationConsent={draft.consent?.location === true} canRemove
              onChange={(ev, c) => setData((x) => (x ? { ...x, evidence: ev, completeness: c ?? x.completeness } : x))} />
          </>
        );
      case "witnesses": {
        const list = draft.witnesses ?? [];
        const set = (i: number, w: Partial<(typeof list)[number]>) => update({ witnesses: list.map((x, j) => (j === i ? { ...x, ...w } : x)) });
        return (
          <div className="stack">
            <p className="help">{t("steps.witnesses.help")}</p>
            {list.map((w, i) => (
              <fieldset key={i} className="card stack">
                <legend className="label">{t("steps.witnesses.number", { n: i + 1 })}</legend>
                {text(`w${i}-name`, t("steps.witnesses.name"), w.name, (v) => set(i, { name: v }))}
                {text(`w${i}-phone`, t("steps.witnesses.phone"), w.phone, (v) => set(i, { phone: v }), { type: "tel", inputMode: "tel", max: 24 })}
                {text(`w${i}-email`, t("steps.witnesses.email"), w.email, (v) => set(i, { email: v }), { type: "email", inputMode: "email", max: 254 })}
                <label className="check">
                  <input type="checkbox" checked={w.consentToContact} onChange={(e) => set(i, { consentToContact: e.target.checked })} />
                  <span>{t("steps.witnesses.consent")}</span>
                </label>
                <button type="button" className="linkbtn" onClick={() => update({ witnesses: list.filter((_, j) => j !== i) })}>{t("common.remove")}</button>
              </fieldset>
            ))}
            {list.length < 5 && (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => update({ witnesses: [...list, { name: "", consentToContact: false }] })}>
                {t("steps.witnesses.add")}
              </button>
            )}
          </div>
        );
      }
      case "review":
        return (
          <Review token={token} view={data} draft={draft} onFix={(s) => setStep(resolveStep(draft, s as StepId))} onBack={goBack}
            onSubmitted={(v) => {
              try { localStorage.removeItem(stepStoreKey(data.reference)); } catch {}
              setData(v);
            }} />
        );
      default:
        return null;
    }
  })();

  const witnessesInvalid = step === "witnesses" && (draft.witnesses ?? []).some((w) => !w.name.trim() || !w.consentToContact);
  const nextLabel = step === "vehicle" ? t("steps.vehicle.confirm") : step === "witnesses" && !(draft.witnesses ?? []).length ? t("steps.witnesses.none") : t("common.next");

  return (
    <main className="page">
      <div className="stepcount">{t("common.step", { current: index + 1, total: steps.length })}</div>
      <div className="progress" aria-hidden="true"><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
      {offline && <p className="notice" role="status">{t("common.offline")}</p>}
      <h1 ref={heading} tabIndex={-1}>{t(`steps.${step}.title`)}</h1>
      {body}
      {fieldError && <p className="error" role="alert">{fieldError}</p>}
      {error && <p className="alert" role="alert">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.server_error")}</p>}
      {step !== "review" && <nav className="actions" aria-label={t("app.title")}>
        <div className="inner">
          {index > 0 && <button type="button" className="btn btn-secondary" onClick={goBack} disabled={busy}>{t("common.back")}</button>}
          {showNext && (
            <button type="button" className="btn btn-primary" onClick={() => {
              if (step === "vehicle") { const d = { ...draft, vehicle: { ...draft.vehicle, confirmed: true } }; setDraft(d); goNext(d); }
              else goNext();
            }} disabled={busy || witnessesInvalid}>
              {busy ? t("common.saving") : nextLabel}
            </button>
          )}
        </div>
      </nav>}
    </main>
  );
}
