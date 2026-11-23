import type { Draft } from "./schema";

/** All screens of the driver flow, one question per screen. */
export type StepId =
  | "privacy"
  | "injured"
  | "police"
  | "police_reference"
  | "vehicle"
  | "contact"
  | "incident_type"
  | "when_where"
  | "collision_kind"
  | "other_party"
  | "irf"
  | "hit_object"
  | "found_at"
  | "theft_kind"
  | "theft_items"
  | "keys"
  | "glass_part"
  | "glass_damage"
  | "drivable"
  | "description"
  | "damage"
  | "photos"
  | "witnesses"
  | "review";

/**
 * The ordered list of steps for the current answers. Steps that do not apply are left out,
 * so the progress bar and the back button always match what the driver sees.
 */
export function stepsFor(draft: Draft): StepId[] {
  const steps: StepId[] = ["privacy", "injured", "police"];
  if (draft.safety?.policeInvolved === "yes") steps.push("police_reference");
  steps.push("vehicle", "contact", "incident_type", "when_where");

  const type = draft.incidentType;
  switch (type) {
    case "collision":
      steps.push("collision_kind", "other_party", "irf");
      break;
    case "single_vehicle":
      steps.push("hit_object");
      break;
    case "parked_unknown":
      steps.push("found_at");
      break;
    case "theft_breakin":
      steps.push("theft_kind");
      if (draft.details?.theftKind && draft.details.theftKind !== "whole_vehicle") steps.push("theft_items");
      if (draft.details?.theftKind === "whole_vehicle") steps.push("keys");
      break;
    case "glass":
      steps.push("glass_part", "glass_damage", "drivable");
      break;
    case "other":
    case undefined:
      break;
  }

  steps.push("description");
  if (!isWholeVehicleTheft(draft)) steps.push("damage");
  steps.push("photos");
  if (type === "collision" || type === "single_vehicle") steps.push("witnesses");
  steps.push("review");
  return steps;
}

export function isWholeVehicleTheft(draft: Draft): boolean {
  return draft.incidentType === "theft_breakin" && draft.details?.theftKind === "whole_vehicle";
}

export function nextStep(draft: Draft, current: StepId): StepId | null {
  const steps = stepsFor(draft);
  const i = steps.indexOf(current);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

export function previousStep(draft: Draft, current: StepId): StepId | null {
  const steps = stepsFor(draft);
  const i = steps.indexOf(current);
  return i > 0 ? steps[i - 1] : null;
}

/** When answers change the path, a step can disappear. Fall back to the closest valid step. */
export function resolveStep(draft: Draft, wanted: StepId | null | undefined): StepId {
  const steps = stepsFor(draft);
  if (wanted && steps.includes(wanted)) return wanted;
  return steps[0];
}
