import { handle, json, readJson } from "@/lib/server/guard";
import { saveDraft, view } from "@/lib/server/intake";
import { incidentAuth } from "@/lib/server/incidentRoute";

export const dynamic = "force-dynamic";

export const GET = handle(async (req) => json(await view(await incidentAuth(req))));

/** Saves a validated part of the draft. Server side validation with the same zod schema. */
export const PATCH = handle(async (req) => {
  const auth = await incidentAuth(req, { bot: true });
  const body = (await readJson(req)) as { patch?: unknown; step?: unknown };
  return json(await saveDraft(auth, body.patch ?? {}, body.step));
});
