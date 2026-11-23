/* eslint-disable @next/next/no-img-element -- previews are local blob URLs */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { EvidenceSlot } from "@/lib/domain/constants";
import type { EvidenceRequirement } from "@/lib/domain/evidence";
import { api, ApiError, errorKey, type CompletenessView, type EvidenceView } from "@/lib/client/api";
import { currentPosition, prepareFile, queueStore, uploadItem, type ItemState, type QueueItem } from "@/lib/client/uploadQueue";
import { SlotIcon } from "./SlotIcon";

/** Camera photos carry the moment they were taken; fall back to now. */
function captureTime(file: File): string {
  return new Date(file.lastModified || Date.now()).toISOString();
}

type Props = {
  token: string;
  incidentKey: string;
  requirements: EvidenceRequirement[];
  evidence: EvidenceView[];
  locationConsent: boolean;
  canRemove: boolean;
  showOptional?: boolean;
  optionalOpen?: boolean;
  onChange: (evidence: EvidenceView[], completeness?: CompletenessView) => void;
};

/**
 * Guided photo capture, reused for the first report, for adding documents later and for
 * document requests from a handler. One row per required shot with an example outline.
 */
export function EvidenceCapture({ token, incidentKey, requirements, evidence, locationConsent, canRemove, showOptional = true, optionalOpen = false, onChange }: Props) {
  const t = useTranslations("steps.photos");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [pending, setPending] = useState<ItemState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(optionalOpen);
  const running = useRef(false);
  const memQueue = useRef<QueueItem[]>([]);
  const evRef = useRef(evidence);
  useEffect(() => {
    evRef.current = evidence;
  }, [evidence]);

  const setStatus = (id: string, status: ItemState["status"] | null, extra?: Partial<ItemState>) =>
    setPending((p) => (status === null ? p.filter((x) => x.id !== id) : p.map((x) => (x.id === id ? { ...x, status, ...extra } : x))));

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const items = await queueStore.list(incidentKey);
        const item = items.find((i) => i) ?? memQueue.current.find((i) => i.incidentKey === incidentKey);
        if (!item) break;
        setStatus(item.id, "uploading");
        let done = false;
        for (let attempt = 0; attempt < 5 && !done; attempt++) {
          try {
            const r = await uploadItem(token, item);
            const preview = URL.createObjectURL(item.blob);
            const ev: EvidenceView = { id: r.id, slot: item.slot, mime: item.mime, url: item.mime.startsWith("image/") ? preview : null, createdAt: new Date().toISOString() };
            onChange([...evRef.current, ev], r.completeness);
            done = true;
          } catch (e) {
            if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) {
              setError(te.has(e.code) ? te(e.code) : te("server_error"));
              done = true; // not retryable, drop it
            } else {
              setStatus(item.id, navigator.onLine ? "failed" : "queued");
              await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
              setStatus(item.id, "uploading");
            }
          }
        }
        if (!done) {
          // Keep it on the phone; the next "online" event or visit tries again.
          setStatus(item.id, "failed");
          break;
        }
        await queueStore.remove(item.id);
        memQueue.current = memQueue.current.filter((i) => i.id !== item.id);
        setStatus(item.id, null);
      }
    } finally {
      running.current = false;
    }
  }, [incidentKey, onChange, te, token]);

  // Resume uploads left over from an earlier visit, and retry when back online.
  useEffect(() => {
    queueStore.list(incidentKey).then((items) => {
      if (items.length) {
        setPending(items.map((i) => ({ id: i.id, slot: i.slot, status: "queued", preview: URL.createObjectURL(i.blob) })));
        run();
      }
    });
    const online = () => run();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [incidentKey, run]);

  async function onFile(slot: EvidenceSlot, files: FileList | null) {
    setError(null);
    // Copy first: the FileList is live and the input is cleared right after this call.
    const list = Array.from(files ?? []).slice(0, 5);
    if (!list.length) return;
    const pos = locationConsent ? await currentPosition() : null;
    for (const file of list) {
      try {
        const { blob, mime } = await prepareFile(file);
        if (blob.size > 15 * 1024 * 1024) throw new ApiError(413, "too_large");
        const item: QueueItem = {
          id: crypto.randomUUID(),
          incidentKey,
          slot,
          blob,
          mime,
          capturedAt: captureTime(file),
          ...(pos ? { lat: pos.lat, lng: pos.lng } : {}),
        };
        const stored = await queueStore.put(item);
        if (stored === undefined) memQueue.current.push(item);
        setPending((p) => [...p, { id: item.id, slot, status: "queued", preview: URL.createObjectURL(blob) }]);
      } catch (e) {
        setError(te.has(errorKey(e)) ? te(errorKey(e)) : te("server_error"));
      }
    }
    run();
  }

  async function remove(id: string) {
    try {
      const r = await api<{ completeness: CompletenessView }>(token, "/api/incident/evidence", { method: "DELETE", body: { id } });
      onChange(evRef.current.filter((e) => e.id !== id), r.completeness);
    } catch (e) {
      setError(te.has(errorKey(e)) ? te(errorKey(e)) : te("server_error"));
    }
  }

  const main = requirements.filter((r) => r.level !== "optional");
  const optional = requirements.filter((r) => r.level === "optional");
  const required = main.filter((r) => r.level === "required");
  const doneRequired = required.filter((r) => evidence.some((e) => e.slot === r.slot)).length;

  const row = (r: EvidenceRequirement) => {
    const have = evidence.filter((e) => e.slot === r.slot);
    const waiting = pending.filter((p) => p.slot === r.slot);
    const first = have.find((h) => h.url)?.url ?? waiting[0]?.preview;
    const inputId = `f-${r.slot}`;
    const accept = r.slot === "police_report" || r.slot === "other_document" ? "image/*,application/pdf" : "image/*";
    return (
      <div className="slot" key={r.slot}>
        <div className="outline" aria-hidden="true">
          {first ? <img src={first} alt="" /> : <SlotIcon slot={r.slot} />}
        </div>
        <div>
          <h3>{t(`slots.${r.slot}.title`)}</h3>
          <div className="meta">
            {have.length > 0 ? (
              <span className="tag tag-ok">{t("uploaded")}</span>
            ) : (
              <span className={`tag ${r.level === "required" ? "tag-required" : ""}`}>{tc(r.level)}</span>
            )}
            <span>{t(`slots.${r.slot}.hint`)}</span>
          </div>
          <div className="filebtns">
            <label className="btn btn-secondary" htmlFor={`${inputId}-cam`}>
              {have.length ? t("another") : t("take")}
            </label>
            <input id={`${inputId}-cam`} className="sr-only" type="file" accept={accept} capture="environment" onChange={(e) => { onFile(r.slot, e.target.files); e.target.value = ""; }} />
            <label className="btn btn-secondary" htmlFor={`${inputId}-file`}>
              {t("file")}
            </label>
            <input id={`${inputId}-file`} className="sr-only" type="file" accept={accept} multiple onChange={(e) => { onFile(r.slot, e.target.files); e.target.value = ""; }} />
          </div>
          {(have.length > 0 || waiting.length > 0) && (
            <div className="thumbs">
              {have.map((h) => (
                <div className="thumb" key={h.id}>
                  {h.url ? <img src={h.url} alt={t(`slots.${r.slot}.title`)} /> : <span>PDF</span>}
                  {canRemove && (
                    <button type="button" aria-label={`${tc("remove")}: ${t(`slots.${r.slot}.title`)}`} onClick={() => remove(h.id)}>
                      ×
                    </button>
                  )}
                </div>
              ))}
              {waiting.map((w) => (
                <div className="thumb" key={w.id} aria-live="polite">
                  <img src={w.preview} alt="" style={{ opacity: 0.4 }} />
                  <span className="sr-only">{t(w.status === "uploading" ? "uploading" : w.status === "failed" ? "failed" : "queued")}</span>
                </div>
              ))}
            </div>
          )}
          {waiting.length > 0 && (
            <p className="help" aria-live="polite">
              {t(waiting[0].status === "uploading" ? "uploading" : waiting[0].status === "failed" ? "failed" : "queued")}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {required.length > 0 && (
        <p className="notice" aria-live="polite">{t("progress", { done: doneRequired, total: required.length })}</p>
      )}
      {locationConsent && <p className="help">{t("location_note")}</p>}
      {error && <p className="alert" role="alert">{error}</p>}
      <div>{main.map(row)}</div>
      {showOptional && optional.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button type="button" className="linkbtn" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
            {tc("optional")} ({optional.length})
          </button>
          {moreOpen && <div>{optional.map(row)}</div>}
        </div>
      )}
    </div>
  );
}
