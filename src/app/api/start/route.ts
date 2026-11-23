import { SUPPORTED_LOCALES, type Locale } from "@/lib/domain/constants";
import { HttpError, botCheck, clientKey, handle, json, rateLimit, readJson } from "@/lib/server/guard";
import { startIncident } from "@/lib/server/intake";

export const dynamic = "force-dynamic";

/** Driver starts a notification from a scanned QR code. Requires privacy consent. */
export const POST = handle(async (req) => {
  await botCheck();
  await rateLimit(`start:${clientKey(req)}`, 10, 600);
  const body = (await readJson(req, 4096)) as { entry?: unknown; locale?: unknown; consent?: { privacy?: unknown; location?: unknown } };
  if (typeof body.entry !== "string") throw new HttpError(422, "invalid_input");
  if (body.consent?.privacy !== true) throw new HttpError(422, "consent_missing");
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(body.locale as string) ? (body.locale as Locale) : "en";
  const r = await startIncident(body.entry, locale, body.consent?.location === true);
  return json(r, 201);
});
