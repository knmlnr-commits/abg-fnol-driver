import type { EvidenceSlot } from "./constants";
import { isWholeVehicleTheft } from "./branching";
import type { Draft } from "./schema";

export type Level = "required" | "recommended" | "optional";
export type EvidenceRequirement = { slot: EvidenceSlot; level: Level };

const CORNERS: EvidenceSlot[] = [
  "corner_front_left",
  "corner_front_right",
  "corner_rear_left",
  "corner_rear_right",
];

/**
 * Required photo set per incident type. Based on the current JotForm plus the brief.
 * [CONFIRM] the levels with the handling team.
 */
export function evidenceFor(draft: Draft): EvidenceRequirement[] {
  const req = (slot: EvidenceSlot, level: Level = "required") => ({ slot, level });
  const police: EvidenceRequirement[] =
    draft.safety?.policeInvolved === "yes" ? [req("police_report", "recommended")] : [];
  let list: EvidenceRequirement[];

  switch (draft.incidentType) {
    case "collision":
      list = [
        req("scene_overview"),
        req("own_plate"),
        req("own_damage"),
        req("other_damage"),
        req("other_plate"),
        req("irf_front", draft.details?.irfStatus === "no_form" ? "optional" : "required"),
        req("irf_back", draft.details?.irfStatus === "no_form" ? "optional" : "required"),
        ...CORNERS.map((s) => req(s, "optional")),
        ...police,
      ];
      break;
    case "single_vehicle":
      list = [
        req("scene_overview"),
        req("own_plate"),
        req("own_damage"),
        req("irf_front", "recommended"),
        req("irf_back", "recommended"),
        ...CORNERS.map((s) => req(s, "optional")),
        ...police,
      ];
      break;
    case "parked_unknown":
      // Earlier damage is the usual dispute here, so the four corners are required.
      list = [req("own_plate"), req("own_damage"), ...CORNERS.map((s) => req(s)), ...police];
      break;
    case "theft_breakin":
      list = isWholeVehicleTheft(draft)
        ? [req("police_report")]
        : [req("own_plate"), req("own_damage"), req("police_report")];
      break;
    case "glass":
      list = [req("own_plate"), req("glass_closeup"), req("own_damage", "recommended"), ...police];
      break;
    case "other":
      list = [req("own_plate"), req("own_damage"), ...police];
      break;
    default:
      list = [];
  }
  return [...list, req("other_document", "optional")];
}
