import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { emergencyNumber } from "@/lib/config/countries";
import { EVIDENCE_SLOTS, SUPPORTED_LOCALES, type EvidenceSlot, type Locale } from "@/lib/domain/constants";
import { completeness, type Completeness } from "@/lib/domain/completeness";
import { evidenceFor } from "@/lib/domain/evidence";
import { DraftSchema, mergeDraft, type Draft } from "@/lib/domain/schema";
import {
  DOCREQ_TOKEN_TTL_S,
  INCIDENT_TOKEN_TTL_S,
  TokenError,
  hashToken,
  keyRingFromEnv,
  signToken,
  verifyToken,
  type KeyRing,
} from "@/lib/tokens";
import { q, q1, tx } from "./db";
import { HttpError } from "./guard";
import { storage } from "./storage";

let cachedRing: KeyRing | null = null;
export function ring(): KeyRing {
  if (!cachedRing) cachedRing = keyRingFromEnv();
  return cachedRing;
}

export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_INCIDENT = 60;

// ------------------------------------------------------------------ entry (QR) tokens

export type EntryContext = {
  entryId: string;
  tenantId: string;
  stationId: string;
  stationName: string;
  city: string;
  country: string;
  emergency: string;
  vehicleId: string | null;
  plate: string | null;
  rentalAgreement: string | null;
};

export async function resolveEntry(token: string): Promise<EntryContext> {
  let claims;
  try {
    claims = await verifyToken(token, "entry", ring());
  } catch (e) {
    throw new HttpError(e instanceof TokenError && e.code === "expired" ? 410 : 401, "invalid_link");
  }
  const row = await q1<{
    id: string; tenant_id: string; station_id: string; name: string; city: string; country: string;
    vehicle_id: string | null; plate: string | null; rental_agreement: string | null;
  }>(
    `select e.id, e.tenant_id, e.station_id, s.name, s.city, s.country, e.vehicle_id, v.plate, e.rental_agreement
       from public.entry_tokens e
       join public.stations s on s.id = e.station_id
       left join public.vehicles v on v.id = e.vehicle_id
      where e.id = $1 and e.revoked_at is null and e.tenant_id = $2`,
    [claims.jti, claims.ten],
  );
  if (!row) throw new HttpError(410, "invalid_link");
  return {
    entryId: row.id,
    tenantId: row.tenant_id,
    stationId: row.station_id,
    stationName: row.name,
    city: row.city,
    country: row.country,
    emergency: emergencyNumber(row.country),
    vehicleId: row.vehicle_id,
    plate: row.plate,
    rentalAgreement: row.rental_agreement,
  };
}

export async function signEntryToken(entryId: string): Promise<string> {
  const row = await q1<{ tenant_id: string; code: string; country: string; plate: string | null; rental_agreement: string | null }>(
    `select e.tenant_id, s.code, s.country, v.plate, e.rental_agreement
       from public.entry_tokens e join public.stations s on s.id = e.station_id
       left join public.vehicles v on v.id = e.vehicle_id where e.id = $1`,
    [entryId],
  );
  if (!row) throw new HttpError(404, "not_found");
  return signToken(
    {
      typ: "entry",
      jti: entryId,
      ten: row.tenant_id,
      stn: row.code,
      ctry: row.country,
      ...(row.plate ? { veh: row.plate } : {}),
      ...(row.rental_agreement ? { agr: row.rental_agreement } : {}),
    },
    ring(),
  );
}

// ------------------------------------------------------------------ incidents

async function audit(
  c: PoolClient | null,
  e: { tenantId: string; actorType: "driver" | "handler" | "system"; actorId?: string; action: string; entity: string; entityId?: string; detail?: unknown },
) {
  const sql = `insert into public.audit_log (tenant_id, actor_type, actor_id, action, entity, entity_id, detail) values ($1,$2,$3,$4,$5,$6,$7)`;
  const params = [e.tenantId, e.actorType, e.actorId ?? null, e.action, e.entity, e.entityId ?? null, e.detail ? JSON.stringify(e.detail) : null];
  if (c) await c.query(sql, params);
  else await q(sql, params);
}

export async function event(tenantId: string, incidentId: string | null, ev: string, step: string | null, locale: string | null, c?: PoolClient) {
  const sql = `insert into public.funnel_events (tenant_id, incident_id, event, step, locale) values ($1,$2,$3,$4,$5)`;
  const params = [tenantId, incidentId, ev, step, locale];
  if (c) await c.query(sql, params);
  else await q(sql, params);
}

export async function startIncident(entryToken: string, locale: Locale, locationConsent: boolean) {
  const ctx = await resolveEntry(entryToken);
  const jti = randomUUID();
  return tx(async (c) => {
    const ref = (await c.query<{ r: string }>("select public.next_incident_reference() as r")).rows[0].r;
    const draft: Draft = DraftSchema.parse({
      locale,
      consent: { privacy: true, location: locationConsent, acceptedAt: new Date().toISOString() },
      vehicle: {
        ...(ctx.plate ? { plate: ctx.plate } : {}),
        ...(ctx.rentalAgreement ? { rentalAgreement: ctx.rentalAgreement } : {}),
      },
    });
    const inc = (
      await c.query<{ id: string }>(
        `insert into public.incidents (tenant_id, reference, entry_token_id, station_id, vehicle_id, locale, draft, current_step, retention_until)
         select $1, $2, $3, $4, $5, $6, $7, 'injured', now() + make_interval(days => t.retention_days)
           from public.tenants t where t.id = $1
         returning id`,
        [ctx.tenantId, ref, ctx.entryId, ctx.stationId, ctx.vehicleId, locale, JSON.stringify(draft)],
      )
    ).rows[0];
    const token = await signToken({ typ: "incident", jti, sub: inc.id }, ring(), { ttlSeconds: INCIDENT_TOKEN_TTL_S });
    await c.query(
      `insert into public.access_links (id, incident_id, purpose, token_hash, expires_at) values ($1,$2,'incident',$3, now() + make_interval(secs => $4))`,
      [jti, inc.id, await hashToken(token), INCIDENT_TOKEN_TTL_S],
    );
    await event(ctx.tenantId, inc.id, "flow_started", null, locale, c);
    await audit(c, { tenantId: ctx.tenantId, actorType: "driver", actorId: jti, action: "create", entity: "incident", entityId: inc.id });
    return { token, reference: ref };
  });
}

type IncidentRow = {
  id: string; tenant_id: string; reference: string; status: "draft" | "submitted"; locale: string;
  current_step: string | null; draft: Draft; station_name: string | null; city: string | null; country: string | null;
  lat: number | null; lng: number | null; submitted_at: string | null; completeness_score: number;
};

export type Auth = {
  mode: "incident" | "docreq";
  linkId: string;
  incident: IncidentRow;
  request: { id: string; slots: EvidenceSlot[]; message: string | null } | null;
};

/** Checks the personal link: signature, expiry, stored hash and revocation. */
export async function authenticate(token: string): Promise<Auth> {
  let mode: Auth["mode"] = "incident";
  let claims: { jti: string; sub: string; rid?: string };
  try {
    claims = await verifyToken(token, "incident", ring());
  } catch (e) {
    if (e instanceof TokenError && e.code === "wrong_type") {
      try {
        claims = await verifyToken(token, "docreq", ring());
        mode = "docreq";
      } catch (e2) {
        throw new HttpError(e2 instanceof TokenError && e2.code === "expired" ? 410 : 401, "invalid_link");
      }
    } else {
      throw new HttpError(e instanceof TokenError && e.code === "expired" ? 410 : 401, "invalid_link");
    }
  }
  const link = await q1<{ token_hash: string; incident_id: string; document_request_id: string | null }>(
    `update public.access_links set last_used_at = now()
      where id = $1 and purpose = $2 and revoked_at is null and expires_at > now()
      returning token_hash, incident_id, document_request_id`,
    [claims.jti, mode],
  );
  if (!link || link.incident_id !== claims.sub || link.token_hash !== (await hashToken(token))) {
    throw new HttpError(410, "invalid_link");
  }
  const incident = await q1<IncidentRow>(
    `select i.id, i.tenant_id, i.reference, i.status, i.locale, i.current_step, i.draft, s.name as station_name, s.city, s.country, s.lat, s.lng,
            i.submitted_at, i.completeness_score
       from public.incidents i left join public.stations s on s.id = i.station_id where i.id = $1`,
    [link.incident_id],
  );
  if (!incident) throw new HttpError(410, "invalid_link");
  let request: Auth["request"] = null;
  if (mode === "docreq") {
    const r = await q1<{ id: string; requested_slots: EvidenceSlot[]; message: string | null }>(
      `select id, requested_slots, message from public.document_requests
        where id = $1 and incident_id = $2 and status = 'open' and expires_at > now()`,
      [link.document_request_id, incident.id],
    );
    if (!r) throw new HttpError(410, "request_closed");
    request = { id: r.id, slots: r.requested_slots, message: r.message };
  }
  return { mode, linkId: claims.jti, incident, request };
}

async function evidenceList(incidentId: string) {
  return q<{ id: string; slot: EvidenceSlot; mime: string; storage_path: string; created_at: string; source: string }>(
    `select id, slot, mime, storage_path, created_at, source from public.evidence_items where incident_id = $1 order by created_at`,
    [incidentId],
  );
}

async function recompute(incidentId: string, draft: Draft, c?: PoolClient): Promise<Completeness> {
  const ev = await evidenceList(incidentId);
  const comp = completeness(draft, ev.map((e) => e.slot));
  const sql = `update public.incidents set completeness_score = $2, missing_items = $3, updated_at = now() where id = $1`;
  const params = [incidentId, comp.score, JSON.stringify(comp.missing.map((m) => ({ key: m.key, level: m.level })))];
  if (c) await c.query(sql, params);
  else await q(sql, params);
  return comp;
}

export async function view(auth: Auth) {
  const inc = auth.incident;
  const all = await evidenceList(inc.id);
  // A document request link (for example sent to a station) only sees the items it asks for.
  const ev = auth.request ? all.filter((e) => auth.request!.slots.includes(e.slot)) : all;
  const urls = await Promise.all(
    ev.map((e) => (e.mime.startsWith("image/") ? storage().createReadUrl(e.storage_path, 600).catch(() => null) : null)),
  );
  const comp = completeness(inc.draft, all.map((e) => e.slot));
  return {
    mode: auth.mode,
    reference: inc.reference,
    status: inc.status,
    step: inc.current_step,
    submittedAt: inc.submitted_at,
    draft: auth.mode === "docreq" ? { locale: inc.draft.locale, incidentType: inc.draft.incidentType } : inc.draft,
    context: {
      stationName: inc.station_name,
      city: inc.city,
      country: inc.country,
      emergency: emergencyNumber(inc.country),
      lat: inc.lat,
      lng: inc.lng,
    },
    evidence: ev.map((e, i) => ({ id: e.id, slot: e.slot, mime: e.mime, url: urls[i], createdAt: e.created_at })),
    requirements: evidenceFor(inc.draft),
    completeness: { score: comp.score, missing: comp.missing.map(({ key, level, step }) => ({ key, level, step })) },
    request: auth.request,
  };
}

export async function saveDraft(auth: Auth, patch: unknown, step: unknown) {
  if (auth.mode !== "incident") throw new HttpError(403, "not_allowed");
  if (auth.incident.status !== "draft") throw new HttpError(409, "already_submitted");
  const parsed = DraftSchema.safeParse(patch);
  if (!parsed.success) throw new HttpError(422, "invalid_input");
  const stepOk = typeof step === "string" && /^[a-z_]{1,40}$/.test(step) ? step : null;
  const draft = mergeDraft(auth.incident.draft, parsed.data);
  const locale = draft.locale && (SUPPORTED_LOCALES as readonly string[]).includes(draft.locale) ? draft.locale : auth.incident.locale;
  await q(
    `update public.incidents set draft = $2, incident_type = $3, current_step = coalesce($4, current_step), locale = $5, updated_at = now()
      where id = $1 and status = 'draft'`,
    [auth.incident.id, JSON.stringify(draft), draft.incidentType ?? null, stepOk, locale],
  );
  const comp = await recompute(auth.incident.id, draft);
  await audit(null, {
    tenantId: auth.incident.tenant_id, actorType: "driver", actorId: auth.linkId, action: "update", entity: "incident",
    entityId: auth.incident.id, detail: { fields: Object.keys(parsed.data) },
  });
  return { draft, completeness: { score: comp.score, missing: comp.missing.map(({ key, level, step }) => ({ key, level, step })) }, requirements: evidenceFor(draft) };
}

function allowedSlot(auth: Auth, slot: unknown): EvidenceSlot {
  if (typeof slot !== "string" || !(EVIDENCE_SLOTS as readonly string[]).includes(slot)) throw new HttpError(422, "invalid_slot");
  if (auth.mode === "docreq" && !auth.request!.slots.includes(slot as EvidenceSlot)) throw new HttpError(403, "slot_not_requested");
  return slot as EvidenceSlot;
}

export async function createUpload(auth: Auth, body: { slot?: unknown; mime?: unknown; size?: unknown }) {
  const slot = allowedSlot(auth, body.slot);
  const mime = typeof body.mime === "string" && (ALLOWED_MIME as readonly string[]).includes(body.mime) ? body.mime : null;
  const size = typeof body.size === "number" && body.size > 0 && body.size <= MAX_UPLOAD_BYTES ? body.size : null;
  if (!mime) throw new HttpError(422, "invalid_type");
  if (!size) throw new HttpError(413, "too_large");
  const count = await q1<{ n: number }>(`select count(*)::int as n from public.evidence_items where incident_id = $1`, [auth.incident.id]);
  if ((count?.n ?? 0) >= MAX_FILES_PER_INCIDENT) throw new HttpError(429, "too_many_files");
  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
  const objectPath = `${auth.incident.tenant_id}/${auth.incident.id}/${slot}/${randomUUID()}.${ext}`;
  const url = await storage().createUploadUrl(objectPath);
  return { path: objectPath, url };
}

export async function confirmEvidence(
  auth: Auth,
  body: { path?: unknown; slot?: unknown; mime?: unknown; capturedAt?: unknown; lat?: unknown; lng?: unknown; source?: unknown },
) {
  const slot = allowedSlot(auth, body.slot);
  const prefix = `${auth.incident.tenant_id}/${auth.incident.id}/${slot}/`;
  if (typeof body.path !== "string" || !body.path.startsWith(prefix) || !/^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/.test(body.path.slice(prefix.length))) {
    throw new HttpError(422, "invalid_path");
  }
  const mime = typeof body.mime === "string" && (ALLOWED_MIME as readonly string[]).includes(body.mime) ? body.mime : null;
  if (!mime) throw new HttpError(422, "invalid_type");
  const size = await storage().size(body.path);
  if (!size) throw new HttpError(409, "upload_missing");
  const capturedAt = typeof body.capturedAt === "string" && !Number.isNaN(Date.parse(body.capturedAt)) ? new Date(body.capturedAt).toISOString() : null;
  const geoOk = auth.incident.draft.consent?.location === true;
  const lat = geoOk && typeof body.lat === "number" && Math.abs(body.lat) <= 90 ? body.lat : null;
  const lng = geoOk && typeof body.lng === "number" && Math.abs(body.lng) <= 180 ? body.lng : null;
  const source = body.source === "station" ? "station" : "driver";

  return tx(async (c) => {
    const ins = await c.query<{ id: string }>(
      `insert into public.evidence_items (tenant_id, incident_id, slot, storage_path, mime, size_bytes, captured_at, lat, lng, source, document_request_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (storage_path) do nothing returning id`,
      [auth.incident.tenant_id, auth.incident.id, slot, body.path, mime, size, capturedAt, lat, lng, source, auth.request?.id ?? null],
    );
    const id = ins.rows[0]?.id;
    if (!id) throw new HttpError(409, "duplicate");
    const late = auth.incident.status === "submitted";
    await event(auth.incident.tenant_id, auth.incident.id, late ? "docs_added" : "evidence_added", slot, auth.incident.locale, c);
    await audit(c, {
      tenantId: auth.incident.tenant_id, actorType: "driver", actorId: auth.linkId, action: "add_evidence",
      entity: "evidence_item", entityId: id, detail: { slot, late, request: auth.request?.id ?? null },
    });
    if (auth.request) {
      const have = await c.query<{ slot: string }>(
        `select distinct slot from public.evidence_items where incident_id = $1 and slot = any($2::text[])`,
        [auth.incident.id, auth.request.slots],
      );
      if (have.rows.length >= auth.request.slots.length) {
        await c.query(`update public.document_requests set status = 'fulfilled' where id = $1`, [auth.request.id]);
      }
    }
    const comp = await recomputeTx(c, auth.incident.id, auth.incident.draft);
    return { id, completeness: comp };
  });
}

async function recomputeTx(c: PoolClient, incidentId: string, draft: Draft) {
  const ev = await c.query<{ slot: EvidenceSlot }>(`select slot from public.evidence_items where incident_id = $1`, [incidentId]);
  const comp = completeness(draft, ev.rows.map((r) => r.slot));
  await c.query(`update public.incidents set completeness_score = $2, missing_items = $3, updated_at = now() where id = $1`, [
    incidentId, comp.score, JSON.stringify(comp.missing.map((m) => ({ key: m.key, level: m.level }))),
  ]);
  return { score: comp.score, missing: comp.missing.map(({ key, level, step }) => ({ key, level, step })) };
}

export async function removeEvidence(auth: Auth, id: unknown) {
  if (auth.mode !== "incident" || auth.incident.status !== "draft") throw new HttpError(403, "not_allowed");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(422, "invalid_input");
  const row = await q1<{ storage_path: string }>(
    `delete from public.evidence_items where id = $1 and incident_id = $2 returning storage_path`,
    [id, auth.incident.id],
  );
  if (!row) throw new HttpError(404, "not_found");
  await storage().remove([row.storage_path]);
  await audit(null, { tenantId: auth.incident.tenant_id, actorType: "driver", actorId: auth.linkId, action: "remove_evidence", entity: "evidence_item", entityId: id });
  return recompute(auth.incident.id, auth.incident.draft);
}

export async function submit(auth: Auth) {
  if (auth.mode !== "incident") throw new HttpError(403, "not_allowed");
  if (auth.incident.status !== "draft") throw new HttpError(409, "already_submitted");
  if (!auth.incident.draft.consent?.privacy) throw new HttpError(422, "consent_missing");
  return tx(async (c) => {
    const comp = await recomputeTx(c, auth.incident.id, auth.incident.draft);
    const upd = await c.query(
      `update public.incidents i set status = 'submitted', submitted_at = now(), current_step = 'done',
              first_submission_score = $2, first_submission_missing = $3,
              retention_until = now() + make_interval(days => t.retention_days)
         from public.tenants t
        where i.id = $1 and i.status = 'draft' and t.id = i.tenant_id`,
      [auth.incident.id, comp.score, JSON.stringify(comp.missing)],
    );
    if (upd.rowCount !== 1) throw new HttpError(409, "already_submitted");
    await event(auth.incident.tenant_id, auth.incident.id, "submitted", "review", auth.incident.locale, c);
    await audit(c, {
      tenantId: auth.incident.tenant_id, actorType: "driver", actorId: auth.linkId, action: "submit", entity: "incident",
      entityId: auth.incident.id, detail: { score: comp.score, missing: comp.missing.map((m) => m.key) },
    });
    return { reference: auth.incident.reference, completeness: comp };
  });
}

const CLIENT_EVENTS = new Set(["step_viewed", "step_completed", "flow_resumed"]);
export async function clientEvent(auth: Auth, body: { event?: unknown; step?: unknown }) {
  if (typeof body.event !== "string" || !CLIENT_EVENTS.has(body.event)) throw new HttpError(422, "invalid_event");
  const step = typeof body.step === "string" && /^[a-z_]{1,40}$/.test(body.step) ? body.step : null;
  await event(auth.incident.tenant_id, auth.incident.id, body.event, step, auth.incident.locale);
}

/** Used by the handler side (phase 2) and the demo: creates a document request link. */
export async function createDocumentRequest(incidentId: string, slots: EvidenceSlot[], message: string | null, channel: "email" | "sms" | "link") {
  const jti = randomUUID();
  return tx(async (c) => {
    const inc = (await c.query<{ tenant_id: string }>(`select tenant_id from public.incidents where id = $1`, [incidentId])).rows[0];
    if (!inc) throw new HttpError(404, "not_found");
    const req = (
      await c.query<{ id: string }>(
        `insert into public.document_requests (tenant_id, incident_id, requested_slots, message, channel, expires_at)
         values ($1,$2,$3,$4,$5, now() + make_interval(secs => $6)) returning id`,
        [inc.tenant_id, incidentId, slots, message, channel, DOCREQ_TOKEN_TTL_S],
      )
    ).rows[0];
    const token = await signToken({ typ: "docreq", jti, sub: incidentId, rid: req.id }, ring(), { ttlSeconds: DOCREQ_TOKEN_TTL_S });
    await c.query(
      `insert into public.access_links (id, incident_id, purpose, document_request_id, token_hash, expires_at)
       values ($1,$2,'docreq',$3,$4, now() + make_interval(secs => $5))`,
      [jti, incidentId, req.id, await hashToken(token), DOCREQ_TOKEN_TTL_S],
    );
    return { requestId: req.id, token };
  });
}
