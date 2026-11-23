// Feature flags. Read on the server only; defaults are the safe choice.

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const flags = {
  /** Phase 1/2: handler login is mocked instead of Microsoft Entra ID. Never on in production. */
  get AUTH_MOCK_ENTRA() {
    return bool("AUTH_MOCK_ENTRA", false);
  },
  /** AI hooks (photo quality, plate reading, form reading, voice, summary). Mocked and off. */
  get AI_ASSIST_ENABLED() {
    return bool("AI_ASSIST_ENABLED", false);
  },
  /** Shows the demo page with fictional QR codes. */
  get DEMO_MODE() {
    return bool("DEMO_MODE", false);
  },
  /** Bot check on the public flow. Only off for automated local tests. */
  get BOT_CHECK() {
    return bool("BOT_CHECK", true);
  },
};
