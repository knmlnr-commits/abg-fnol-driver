import { describe, expect, it } from "vitest";
import { completeness } from "@/lib/domain/completeness";
import type { Draft } from "@/lib/domain/schema";
import type { EvidenceSlot } from "@/lib/domain/constants";

const fullCollision: Draft = {
  safety: { injured: "no", policeInvolved: "no" },
  vehicle: { plate: "HH-VA 101", rentalAgreement: "RA-100234", confirmed: true },
  contact: { email: "driver@example.test" },
  incidentType: "collision",
  occurredAt: "2026-11-20T09:15:00.000Z",
  location: { lat: 53.63, lng: 9.99, source: "gps" },
  description: "Car behind me did not brake in time.",
  details: { collisionKind: "rear_end", irfStatus: "completed" },
  otherParty: { plate: "B-XY 1234", country: "DE", insurer: "Example Insurance", name: "Alex Example", phone: "+49 30 1234567" },
  damageZones: ["rear_bumper"],
};
const allPhotos: EvidenceSlot[] = ["scene_overview", "own_plate", "own_damage", "other_damage", "other_plate", "irf_front", "irf_back"];

describe("completeness score", () => {
  it("is 0 for an empty draft", () => {
    expect(completeness({}, []).score).toBe(0);
  });

  it("is 100 when every required and recommended item is present", () => {
    const c = completeness(fullCollision, allPhotos);
    expect(c.missing).toEqual([]);
    expect(c.score).toBe(100);
  });

  it("lists a missing required photo and lowers the score", () => {
    const c = completeness(fullCollision, allPhotos.filter((s) => s !== "irf_back"));
    expect(c.missing.map((m) => m.key)).toEqual(["photo_irf_back"]);
    expect(c.score).toBeLessThan(100);
    expect(c.score).toBeGreaterThan(90);
  });

  it("weighs required items more than recommended ones", () => {
    const noInsurer = completeness({ ...fullCollision, otherParty: { ...fullCollision.otherParty, insurer: "" } }, allPhotos);
    const noPlate = completeness({ ...fullCollision, otherParty: { ...fullCollision.otherParty, plate: "" } }, allPhotos);
    expect(noInsurer.score).toBeGreaterThan(noPlate.score);
  });

  it("lists required gaps before recommended ones", () => {
    const c = completeness({ ...fullCollision, vehicle: { plate: "HH-VA 101" }, description: "" }, allPhotos);
    expect(c.missing.map((m) => [m.key, m.level])).toEqual([
      ["description", "required"],
      ["rental_agreement", "recommended"],
    ]);
  });

  it("accepts phone instead of email as contact", () => {
    const c = completeness({ ...fullCollision, contact: { phone: "+49 40 123" } }, allPhotos);
    expect(c.missing).toEqual([]);
  });

  it("does not ask for damage zones after a whole vehicle theft", () => {
    const c = completeness(
      { incidentType: "theft_breakin", details: { theftKind: "whole_vehicle", keysPresent: "yes" } },
      ["police_report"],
    );
    expect(c.items.find((i) => i.key === "damage_zones")).toBeUndefined();
  });

  it("asks for the police reference when police were involved", () => {
    const c = completeness({ ...fullCollision, safety: { injured: "no", policeInvolved: "yes" } }, allPhotos);
    expect(c.missing.map((m) => m.key)).toEqual(["police_reference", "photo_police_report"]);
  });
});
