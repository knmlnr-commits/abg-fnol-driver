import type { EvidenceSlot } from "./constants";
import { isWholeVehicleTheft, type FlowContext } from "./branching";
import { STATION_UNKNOWN } from "./constants";
import { evidenceFor, type Level } from "./evidence";
import type { Draft } from "./schema";

export type CompletenessItem = {
  /** i18n key under `missing.*`; the same key explains why it matters. */
  key: string;
  kind: "field" | "evidence";
  level: Exclude<Level, "optional">;
  ok: boolean;
  /** The step where the driver can fix it. */
  step: string;
};

export type Completeness = {
  score: number; // 0..100
  items: CompletenessItem[];
  missing: CompletenessItem[];
};

const WEIGHT: Record<CompletenessItem["level"], number> = { required: 2, recommended: 1 };

const has = (v: unknown) => typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null;

export function fieldItems(d: Draft, ctx: FlowContext = { askStation: false }): CompletenessItem[] {
  const f = (key: string, ok: boolean, step: string, level: CompletenessItem["level"] = "required"): CompletenessItem => ({
    key,
    kind: "field",
    level,
    ok,
    step,
  });
  const items: CompletenessItem[] = [
    f("injured", has(d.safety?.injured), "injured"),
    f("police", has(d.safety?.policeInvolved), "police"),
    f("vehicle_plate", has(d.vehicle?.plate), "vehicle"),
    f("rental_agreement", has(d.vehicle?.rentalAgreement), "vehicle", "recommended"),
    f("contact", has(d.contact?.email) || has(d.contact?.phone), "contact"),
    f("incident_type", has(d.incidentType), "incident_type"),
    f("occurred_at", has(d.occurredAt), "when_where"),
    f("location", has(d.location), "when_where"),
    f("description", has(d.description), "description"),
  ];
  if (ctx.askStation) {
    const code = d.vehicle?.stationCode;
    items.push(f("station", Boolean(code) && code !== STATION_UNKNOWN, "station", "recommended"));
  }
  if (d.safety?.policeInvolved === "yes") {
    items.push(f("police_reference", has(d.safety?.policeReference), "police_reference", "recommended"));
  }
  if (!isWholeVehicleTheft(d) && d.incidentType) {
    items.push(f("damage_zones", (d.damageZones?.length ?? 0) > 0, "damage"));
  }
  switch (d.incidentType) {
    case "collision":
      items.push(
        f("collision_kind", has(d.details?.collisionKind), "collision_kind"),
        f("other_plate", has(d.otherParty?.plate), "other_party"),
        f("other_insurer", has(d.otherParty?.insurer), "other_party", "recommended"),
        f("other_contact", has(d.otherParty?.name) && (has(d.otherParty?.phone) || has(d.otherParty?.email)), "other_party", "recommended"),
        f("irf_status", has(d.details?.irfStatus), "irf"),
      );
      break;
    case "single_vehicle":
      items.push(f("hit_object", has(d.details?.hitObject), "hit_object"));
      break;
    case "parked_unknown":
      items.push(f("found_at", has(d.details?.foundAt), "found_at", "recommended"));
      break;
    case "theft_breakin":
      items.push(f("theft_kind", has(d.details?.theftKind), "theft_kind"));
      if (isWholeVehicleTheft(d)) items.push(f("keys_present", has(d.details?.keysPresent), "keys"));
      else items.push(f("items_taken", has(d.details?.itemsTaken), "theft_items", "recommended"));
      break;
    case "glass":
      items.push(
        f("glass_part", has(d.details?.glassPart), "glass_part"),
        f("glass_damage", has(d.details?.glassDamage), "glass_damage"),
        f("drivable", has(d.details?.drivable), "drivable"),
      );
      break;
  }
  return items;
}

export function evidenceItems(d: Draft, uploaded: Iterable<EvidenceSlot>): CompletenessItem[] {
  const have = new Set(uploaded);
  return evidenceFor(d)
    .filter((r) => r.level !== "optional")
    .map((r) => ({
      key: `photo_${r.slot}`,
      kind: "evidence" as const,
      level: r.level as CompletenessItem["level"],
      ok: have.has(r.slot),
      step: "photos",
    }));
}

/** Completeness score: weighted share of required (x2) and recommended (x1) items present. */
export function completeness(d: Draft, uploaded: Iterable<EvidenceSlot>, ctx: FlowContext = { askStation: false }): Completeness {
  const items = [...fieldItems(d, ctx), ...evidenceItems(d, uploaded)];
  const total = items.reduce((s, i) => s + WEIGHT[i.level], 0);
  const got = items.reduce((s, i) => s + (i.ok ? WEIGHT[i.level] : 0), 0);
  const score = total === 0 ? 0 : Math.round((got / total) * 100);
  const missing = items
    .filter((i) => !i.ok)
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "required" ? -1 : 1));
  return { score, items, missing };
}
