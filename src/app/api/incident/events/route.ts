import { handle, json, readJson } from "@/lib/server/guard";
import { clientEvent } from "@/lib/server/intake";
import { incidentAuth } from "@/lib/server/incidentRoute";

export const dynamic = "force-dynamic";

/** Measurement events (step viewed or completed). No personal data. */
export const POST = handle(async (req) => {
  const auth = await incidentAuth(req);
  await clientEvent(auth, (await readJson(req, 512)) as Record<string, unknown>);
  return json({ ok: true });
});
