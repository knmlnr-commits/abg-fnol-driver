import { z } from "zod";
import {
  COLLISION_KINDS,
  DAMAGE_ZONES,
  GLASS_DAMAGE,
  GLASS_PARTS,
  HIT_OBJECTS,
  INCIDENT_TYPES,
  IRF_STATUS,
  SUPPORTED_LOCALES,
  THEFT_KINDS,
} from "./constants";

// Every field carries a `purpose` (data minimisation). No field without a purpose.
const p = (purpose: string) => ({ purpose });

const trimmed = (max: number) => z.string().trim().max(max);
const yesNo = z.enum(["yes", "no"]);

export const PlateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(16)
  .regex(/^[A-Z0-9ÄÖÜ\- ]*$/u, "plate_format");

export const EmailSchema = z.string().trim().max(254).pipe(z.union([z.literal(""), z.email()]));
export const PhoneSchema = z
  .string()
  .trim()
  .max(24)
  .regex(/^[+0-9 ()\-]*$/, "phone_format");

export const ConsentSchema = z
  .object({
    privacy: z.boolean().meta(p("Legal basis: the driver accepted the privacy notice.")),
    location: z.boolean().meta(p("Permission to read device location for the incident place and photo positions.")),
    acceptedAt: z.iso.datetime().optional().meta(p("Proof of when consent was given.")),
  })
  .strict();

export const SafetySchema = z
  .object({
    injured: yesNo.optional().meta(p("Triage: injuries change urgency and the claim route.")),
    policeInvolved: yesNo.optional().meta(p("Tells the handler whether a police report can be requested.")),
    policeReference: trimmed(64).optional().meta(p("Lets the handler request the police report.")),
  })
  .strict();

export const VehicleSchema = z
  .object({
    plate: PlateSchema.optional().meta(p("Identifies the rental vehicle; prefilled from the QR code.")),
    rentalAgreement: trimmed(32)
      .regex(/^[A-Za-z0-9\-/]*$/, "agreement_format")
      .optional()
      .meta(p("Links the incident to the rental and the driver; replaces asking for the driver's name.")),
    confirmed: z.boolean().optional().meta(p("Driver confirmed the prefilled vehicle data.")),
    stationCode: z.string().trim().max(20).regex(/^[A-Za-z0-9-]*$/, "station_format").optional()
      .meta(p("Rental station, asked only when the link did not say (email link); routes the claim to the right station.")),
  })
  .strict();

export const ContactSchema = z
  .object({
    email: EmailSchema.optional().meta(p("Sends the confirmation and lets the handler ask questions.")),
    phone: PhoneSchema.optional().meta(p("Fast contact for urgent questions and SMS document requests.")),
  })
  .strict();

export const LocationSchema = z
  .object({
    lat: z.number().min(-90).max(90).meta(p("Incident place for liability and recovery.")),
    lng: z.number().min(-180).max(180).meta(p("Incident place for liability and recovery.")),
    accuracyM: z.number().min(0).max(100000).optional().meta(p("Shows how reliable the position is.")),
    source: z.enum(["gps", "manual"]).meta(p("Whether the driver moved the pin.")),
  })
  .strict();

export const DetailsSchema = z
  .object({
    collisionKind: z.enum(COLLISION_KINDS).optional().meta(p("Basic liability indication for a collision.")),
    irfStatus: z.enum(IRF_STATUS).optional().meta(p("Whether the incident report form from the glove box was filled in.")),
    hitObject: z.enum(HIT_OBJECTS).optional().meta(p("Cause of single vehicle damage; drives recovery options.")),
    foundAt: z.iso.datetime().optional().meta(p("When unexplained damage was found; narrows the time window.")),
    theftKind: z.enum(THEFT_KINDS).optional().meta(p("Theft route: whole vehicle, break-in or parts.")),
    itemsTaken: trimmed(500).optional().meta(p("What was stolen; needed for the police report and the claim.")),
    keysPresent: yesNo.optional().meta(p("Insurers require the keys after a vehicle theft.")),
    glassPart: z.enum(GLASS_PARTS).optional().meta(p("Which glass is damaged; decides repair or replacement.")),
    glassDamage: z.enum(GLASS_DAMAGE).optional().meta(p("Chip or crack; decides repair or replacement.")),
    drivable: yesNo.optional().meta(p("Whether the station needs to arrange a replacement vehicle.")),
  })
  .strict();

export const OtherPartySchema = z
  .object({
    plate: PlateSchema.optional().meta(p("Identifies the other vehicle and its insurer for recovery.")),
    country: z.string().trim().max(5).optional().meta(p("Country of registration; decides the recovery route.")),
    insurer: trimmed(120).optional().meta(p("Recovery from the other party's insurer.")),
    name: trimmed(120).optional().meta(p("Contact for liability questions.")),
    phone: PhoneSchema.optional().meta(p("Contact for liability questions.")),
    email: EmailSchema.optional().meta(p("Contact for liability questions.")),
  })
  .strict();

export const WitnessSchema = z
  .object({
    name: trimmed(120).meta(p("Witness statement for liability.")),
    phone: PhoneSchema.optional().meta(p("Contact the witness.")),
    email: EmailSchema.optional().meta(p("Contact the witness.")),
    consentToContact: z.boolean().meta(p("The driver confirms the witness agreed to be contacted.")),
  })
  .strict();

/** The driver's draft. Every part is optional so it can be saved step by step. */
export const DraftSchema = z
  .object({
    locale: z.enum(SUPPORTED_LOCALES).optional().meta(p("Language for messages to the driver.")),
    consent: ConsentSchema.optional(),
    safety: SafetySchema.optional(),
    vehicle: VehicleSchema.optional(),
    contact: ContactSchema.optional(),
    incidentType: z.enum(INCIDENT_TYPES).optional().meta(p("Decides the follow-up questions and required evidence.")),
    occurredAt: z.iso.datetime().optional().meta(p("When the incident happened; cover and liability.")),
    location: LocationSchema.optional(),
    description: trimmed(2000).optional().meta(p("The driver's own account in a few sentences.")),
    details: DetailsSchema.optional(),
    otherParty: OtherPartySchema.optional(),
    witnesses: z.array(WitnessSchema).max(5).optional(),
    damageZones: z.array(z.enum(DAMAGE_ZONES)).max(DAMAGE_ZONES.length).optional().meta(p("Where the vehicle is damaged; helps the station and the surveyor.")),
  })
  .strict();

export type Draft = z.infer<typeof DraftSchema>;

/** Merge a validated patch into an existing draft (one level deep for nested objects). */
export function mergeDraft(base: Draft, patch: Draft): Draft {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const prev = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && prev && typeof prev === "object" && !Array.isArray(prev)) {
      out[k] = { ...(prev as object), ...(v as object) };
    } else {
      out[k] = v;
    }
  }
  return DraftSchema.parse(out);
}
