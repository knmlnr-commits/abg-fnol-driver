import { handle, json, readJson } from "@/lib/server/guard";
import { confirmEvidence, removeEvidence } from "@/lib/server/intake";
import { incidentAuth } from "@/lib/server/incidentRoute";

export const dynamic = "force-dynamic";

/** Registers an uploaded file after checking it exists in storage under this incident. */
export const POST = handle(async (req) => {
  const auth = await incidentAuth(req, { bot: true });
  return json(await confirmEvidence(auth, (await readJson(req, 4096)) as Record<string, unknown>), 201);
});

export const DELETE = handle(async (req) => {
  const auth = await incidentAuth(req, { bot: true });
  const body = (await readJson(req, 1024)) as { id?: unknown };
  const comp = await removeEvidence(auth, body.id);
  return json({ completeness: { score: comp.score, missing: comp.missing.map(({ key, level, step }) => ({ key, level, step })) } });
});
