import { handle, json, readJson } from "@/lib/server/guard";
import { createUpload } from "@/lib/server/intake";
import { incidentAuth } from "@/lib/server/incidentRoute";

export const dynamic = "force-dynamic";

/** Returns a signed upload URL for one slot of this incident only. */
export const POST = handle(async (req) => {
  const auth = await incidentAuth(req, { bot: true });
  return json(await createUpload(auth, (await readJson(req, 2048)) as Record<string, unknown>));
});
