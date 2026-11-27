import { describe, expect, it } from "vitest";
import { nextStep, previousStep, resolveStep, stepsFor } from "@/lib/domain/branching";
import { evidenceFor } from "@/lib/domain/evidence";
import { DraftSchema, mergeDraft } from "@/lib/domain/schema";

describe("branching", () => {
  it("starts with privacy and safety and ends with review", () => {
    const s = stepsFor({});
    expect(s.slice(0, 3)).toEqual(["privacy", "injured", "police"]);
    expect(s.at(-1)).toBe("review");
    expect(s).not.toContain("police_reference");
  });

  it("asks for the police reference only when police were involved", () => {
    expect(stepsFor({ safety: { policeInvolved: "yes" } })).toContain("police_reference");
    expect(stepsFor({ safety: { policeInvolved: "no" } })).not.toContain("police_reference");
  });

  it("collision asks about the other party, the report form and witnesses", () => {
    const s = stepsFor({ incidentType: "collision" });
    expect(s).toEqual(expect.arrayContaining(["collision_kind", "other_party", "irf", "damage", "photos", "witnesses"]));
    expect(s).not.toContain("glass_part");
  });

  it("glass asks glass questions and no witnesses", () => {
    const s = stepsFor({ incidentType: "glass" });
    expect(s).toEqual(expect.arrayContaining(["glass_part", "glass_damage", "drivable"]));
    expect(s).not.toContain("witnesses");
    expect(s).not.toContain("other_party");
  });

  it("whole vehicle theft skips damage marking and asks for the keys", () => {
    const s = stepsFor({ incidentType: "theft_breakin", details: { theftKind: "whole_vehicle" } });
    expect(s).toContain("keys");
    expect(s).not.toContain("damage");
    expect(s).not.toContain("theft_items");
    const b = stepsFor({ incidentType: "theft_breakin", details: { theftKind: "break_in" } });
    expect(b).toContain("theft_items");
    expect(b).toContain("damage");
  });

  it("each type has its own follow up", () => {
    expect(stepsFor({ incidentType: "single_vehicle" })).toContain("hit_object");
    expect(stepsFor({ incidentType: "parked_unknown" })).toContain("found_at");
    const other = stepsFor({ incidentType: "other" });
    expect(other).toContain("description");
    expect(other).not.toContain("witnesses");
  });

  it("asks for the rental station only when the link did not say (email link)", () => {
    expect(stepsFor({})).not.toContain("station");
    const s = stepsFor({}, { askStation: true });
    expect(s.indexOf("station")).toBe(s.indexOf("vehicle") - 1);
    expect(nextStep({ safety: { policeInvolved: "no" } }, "police", { askStation: true })).toBe("station");
    expect(resolveStep({}, "station")).toBe("privacy");
    expect(resolveStep({}, "station", { askStation: true })).toBe("station");
  });

  it("navigates forward and back on the current path", () => {
    const d = { safety: { policeInvolved: "no" as const } };
    expect(nextStep(d, "police")).toBe("vehicle");
    expect(previousStep(d, "vehicle")).toBe("police");
    expect(previousStep(d, "privacy")).toBeNull();
    expect(nextStep(d, "review")).toBeNull();
  });

  it("falls back when a saved step no longer applies", () => {
    expect(resolveStep({ incidentType: "glass" }, "other_party")).toBe("privacy");
    expect(resolveStep({ incidentType: "glass" }, "drivable")).toBe("drivable");
  });
});

describe("evidence per incident type", () => {
  const required = (d: Parameters<typeof evidenceFor>[0]) =>
    evidenceFor(d).filter((r) => r.level === "required").map((r) => r.slot);

  it("collision needs the JotForm photo set", () => {
    expect(required({ incidentType: "collision" })).toEqual([
      "scene_overview", "own_plate", "own_damage", "other_damage", "other_plate", "irf_front", "irf_back",
    ]);
  });

  it("report form photos become optional when there was no form", () => {
    expect(required({ incidentType: "collision", details: { irfStatus: "no_form" } })).not.toContain("irf_front");
  });

  it("parked or unknown cause needs four corners", () => {
    expect(required({ incidentType: "parked_unknown" })).toEqual(
      expect.arrayContaining(["corner_front_left", "corner_front_right", "corner_rear_left", "corner_rear_right"]),
    );
  });

  it("theft needs the police report", () => {
    expect(required({ incidentType: "theft_breakin", details: { theftKind: "whole_vehicle" } })).toEqual(["police_report"]);
  });
});

describe("draft validation", () => {
  it("rejects unknown fields and bad values", () => {
    expect(DraftSchema.safeParse({ hacker: 1 }).success).toBe(false);
    expect(DraftSchema.safeParse({ incidentType: "meteor" }).success).toBe(false);
    expect(DraftSchema.safeParse({ contact: { email: "nope" } }).success).toBe(false);
    expect(DraftSchema.safeParse({ location: { lat: 200, lng: 0, source: "gps" } }).success).toBe(false);
    expect(DraftSchema.safeParse({ otherParty: { plate: "<script>" } }).success).toBe(false);
  });

  it("normalises plates and merges nested patches", () => {
    const d = mergeDraft({ vehicle: { plate: "hh-va 101" } }, { vehicle: { confirmed: true } });
    expect(d.vehicle).toEqual({ plate: "HH-VA 101", confirmed: true });
  });
});
