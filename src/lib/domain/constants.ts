// Core enumerations for the driver intake. Text labels live in the locale files.

export const INCIDENT_TYPES = [
  "collision",
  "single_vehicle",
  "parked_unknown",
  "theft_breakin",
  "glass",
  "other",
] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

export const EVIDENCE_SLOTS = [
  "scene_overview",
  "own_plate",
  "own_damage",
  "corner_front_left",
  "corner_front_right",
  "corner_rear_left",
  "corner_rear_right",
  "other_damage",
  "other_plate",
  "irf_front",
  "irf_back",
  "police_report",
  "glass_closeup",
  "other_document",
] as const;
export type EvidenceSlot = (typeof EVIDENCE_SLOTS)[number];

/** Zones on the simple top view car outline. */
export const DAMAGE_ZONES = [
  "front_bumper",
  "bonnet",
  "windscreen",
  "roof",
  "rear_window",
  "boot",
  "rear_bumper",
  "left_front",
  "left_rear",
  "right_front",
  "right_rear",
  "wheels",
] as const;
export type DamageZone = (typeof DAMAGE_ZONES)[number];

export const COLLISION_KINDS = ["rear_end", "side", "manoeuvring", "head_on", "other"] as const;
export const HIT_OBJECTS = ["object", "kerb", "animal", "pothole", "other"] as const;
export const THEFT_KINDS = ["whole_vehicle", "break_in", "parts"] as const;
export const GLASS_PARTS = ["windscreen", "side_window", "rear_window", "sunroof"] as const;
export const GLASS_DAMAGE = ["chip", "crack"] as const;
export const IRF_STATUS = ["completed", "not_completed", "no_form"] as const;

export const SUPPORTED_LOCALES = ["en", "de", "es", "it", "fr", "pt"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
/** Locales with complete translations; the others fall back to English. */
export const FILLED_LOCALES: readonly Locale[] = ["en", "de"];
export const DEFAULT_LOCALE: Locale = "en";
