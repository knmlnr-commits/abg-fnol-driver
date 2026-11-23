// Phase 1 definition of done, automated:
// a driver scans a QR code on a phone, reports a collision in German, adds six photos,
// marks the damage, submits, gets a reference and reopens the link to add a police report.
//
//   BASE_URL=http://localhost:3100 node tests/e2e/driver-journey.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR; // optional: save screenshots per step
const LOCALE = process.env.LOCALE ?? "de";
const t0 = Date.now();
const log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s  ${m}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["Pixel 7"],
  locale: LOCALE === "de" ? "de-DE" : "en-GB",
  geolocation: { latitude: 53.6331, longitude: 9.9969, accuracy: 12 },
  permissions: ["geolocation"],
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
if (process.env.DEBUG) { page.on("console", (m) => console.log("console:", m.type(), m.text().slice(0, 200))); page.on("response", (r) => { if (r.url().includes("/api/")) console.log("resp", r.status(), r.request().method(), r.url().slice(0, 90)); }); }
let n = 0;
const shot = async (name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, "0")}-${name}.png` });
};

// Test photos made in the browser, so the test needs no files.
async function photo(label, color) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 800, height: 600 });
  await p.setContent(`<body style="margin:0;background:${color};display:grid;place-items:center;height:600px;font:48px Verdana;color:#fff">${label}</body>`);
  const buffer = await p.screenshot({ type: "jpeg", quality: 80 });
  await p.close();
  return { name: `${label}.jpg`, mimeType: "image/jpeg", buffer };
}

// 1. Scan: open a vehicle sticker QR from the demo page.
await page.goto(`${BASE}/demo`);
const qrUrl = await page.locator("section.card", { hasText: "HH-VA 101" }).first().locator("a").getAttribute("href");
const driverStart = Date.now();
await page.goto(qrUrl);
log("QR opened");
await shot("start");

const T = LOCALE === "de"
  ? { privacy: "Ich habe den Datenschutzhinweis gelesen", start: "Starten", no: "Nein", confirm: "Ja, das stimmt", next: "Weiter",
      collision: "Zusammenstoß mit einem anderen Beteiligten", rear: "Auffahrunfall", irf: "Ja, ausgefüllt und unterschrieben",
      bumper: "Stoßstange hinten", uploaded: "Hochgeladen", noWitness: "Keine Zeugen", sendGaps: "Mit Lücken senden",
      thanks: "Danke. Ihre Meldung ist eingegangen.", addDocs: "Dokumente nachreichen" }
  : { privacy: "I have read the privacy notice", start: "Start", no: "No", confirm: "Yes, this is correct", next: "Next",
      collision: "Collision with another party", rear: "Rear end", irf: "Yes, filled in and signed",
      bumper: "Rear bumper", uploaded: "Uploaded", noWitness: "No witnesses", sendGaps: "Send with gaps",
      thanks: "Thank you. Your report is in.", addDocs: "Add documents" };

await page.getByLabel(T.privacy).check();
await page.getByRole("button", { name: T.start }).click();
await page.waitForURL(/\/i\//);
const personalLink = page.url();
log("started, personal link created");

const tap = async (name) => page.getByRole("button", { name, exact: true }).click();
const heading = async () => (await page.locator("h1").textContent())?.trim();

await page.locator("h1").waitFor();
await shot("injured");
await tap(T.no); // injured
await page.waitForFunction((h) => document.querySelector("h1")?.textContent !== h, await heading());
await tap(T.no); // police
await page.getByRole("button", { name: T.confirm }).waitFor();
await shot("vehicle");
await tap(T.confirm);
await page.getByLabel("E-Mail").or(page.getByLabel("Email")).fill("driver@example.test");
await shot("contact");
await tap(T.next);
await page.getByRole("button", { name: new RegExp(T.collision) }).click();
await page.locator(".leaflet-marker-icon").waitFor({ timeout: 10000 });
await shot("when-where");
await tap(T.next);
await tap(T.rear);
await page.locator("#op-plate").fill("B-XY 1234");
await page.locator("#op-insurer").fill("Example Insurance");
await page.locator("#op-name").fill("Alex Example");
await page.locator("#op-phone").fill("+49 30 1234567");
await shot("other-party");
await tap(T.next);
await tap(T.irf);
await page.locator("#desc").fill(LOCALE === "de" ? "Ich stand an der Ampel, das Auto hinter mir hat zu spät gebremst." : "I was stopped at the lights and the car behind me braked too late.");
await tap(T.next);
await page.getByRole("checkbox", { name: T.bumper }).last().click();
await shot("damage");
await tap(T.next);
log("questions answered");

// Six photos.
const slots = [
  ["scene_overview", "#3b5"], ["own_plate", "#07017E"], ["own_damage", "#a33"],
  ["other_damage", "#663"], ["other_plate", "#335"], ["irf_front", "#777"],
];
for (const [slot, color] of slots) {
  await page.locator(`#f-${slot}-file`).setInputFiles(await photo(slot, color));
}
await page.waitForFunction((n) => document.querySelectorAll(".tag-ok").length >= n, slots.length, { timeout: 30000 });
await shot("photos");
log("six photos uploaded");
await tap(T.next);
await tap(T.noWitness);
await page.locator(".score").waitFor();
await shot("review");
const missing = await page.locator(".missing li").count();
log(`review shows ${missing} missing item(s)`);
await tap(T.sendGaps);
await page.getByText(T.thanks).waitFor();
const reference = (await page.locator(".ref").textContent())?.trim();
const seconds = (Date.now() - driverStart) / 1000;
await shot("done");
log(`submitted, reference ${reference}, driver time ${seconds.toFixed(0)}s (automated)`);

// Reopen the personal link later and add the police report.
const later = await ctx.newPage();
await later.goto(personalLink);
await later.getByText(reference).waitFor();
await later.getByRole("button", { name: T.addDocs }).click();
await later.locator("#f-police_report-file").setInputFiles(await photo("police_report", "#225"));
await later.waitForFunction(() => document.querySelectorAll(".tag-ok").length >= 1, null, { timeout: 30000 });
if (SHOTS) await later.screenshot({ path: `${SHOTS}/${String(++n).padStart(2, "0")}-added-police-report.png`, fullPage: true });
log("reopened link and added the police report");

if (!reference?.match(/^FN-\d{4}-\d{6}$/)) throw new Error(`bad reference ${reference}`);
await browser.close();
console.log("PASS");
