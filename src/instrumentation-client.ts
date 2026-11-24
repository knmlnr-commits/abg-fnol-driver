import { initBotId } from "botid/client/core";

// Vercel BotID: the browser side of the bot check. Every route listed here is verified
// on the server with checkBotId() (src/lib/server/guard.ts). Keep both lists in sync.
// NEXT_PUBLIC_BOT_CHECK=false only for local automated tests outside Vercel (build time flag).
if (process.env.NEXT_PUBLIC_BOT_CHECK !== "false") initBotId({
  protect: [
    { path: "/api/start", method: "POST" },
    { path: "/api/incident", method: "PATCH" },
    { path: "/api/incident/upload", method: "POST" },
    { path: "/api/incident/evidence", method: "POST" },
    { path: "/api/incident/evidence", method: "DELETE" },
    { path: "/api/incident/submit", method: "POST" },
  ],
  });
