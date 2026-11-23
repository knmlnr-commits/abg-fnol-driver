import "server-only";
import { bearer, botCheck, clientKey, rateLimit } from "./guard";
import { authenticate, type Auth } from "./intake";

/** Common checks for every call with a personal link: rate limit, optional bot check, token. */
export async function incidentAuth(req: Request, opts: { bot?: boolean } = {}): Promise<Auth> {
  if (opts.bot) await botCheck();
  await rateLimit(`ip:${clientKey(req)}`, 600, 600);
  const auth = await authenticate(bearer(req));
  await rateLimit(`inc:${auth.incident.id}`, 400, 600);
  return auth;
}
