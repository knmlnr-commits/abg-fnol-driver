import { handle, json } from "@/lib/server/guard";
import { submit } from "@/lib/server/intake";
import { incidentAuth } from "@/lib/server/incidentRoute";

export const dynamic = "force-dynamic";

/** Submit is allowed with gaps; the gaps are recorded with the first submission. */
export const POST = handle(async (req) => json(await submit(await incidentAuth(req, { bot: true }))));
