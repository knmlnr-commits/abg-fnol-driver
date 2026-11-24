import { clearAdminSession } from "@/lib/server/adminAuth";
import { handle, json } from "@/lib/server/guard";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  await clearAdminSession();
  return json({ ok: true });
});
