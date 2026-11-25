# Driver FNOL prototype (car rental)

A clickable, working prototype of a mobile first notice of loss for drivers of rental cars.
It replaces a generic online form that drivers open through a QR link, and shows that a
purpose-built intake delivers a complete incident file at the source: fewer missing documents,
less chasing, and structured data instead of free text.

Prototype with **fictional data only**. No real drivers, rentals, claims, customer names or logos.
The seeded rental company is called "Demo rental company". Van Ameyde is the claims and recovery partner; its look is the default theme.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Driver flow, seeded data, measurement events | Built and tested locally. Cloud deployment waits for the Supabase project (see open questions). |
| 2 | Handler inbox, detail page, document request action, QR generator, measurement page | Not started. Data model and RLS are ready for it. |
| 3 | IntakePayload schema, IntakeTarget adapter, email and SMS adapters, AI hooks | Not started. Designed below. |

## What is better than the current form

The current form has 14 cards: vehicle plate and rental agreement number (typed), email and
phone, date and time, GPS, free text, "damaged or injured items" checkboxes (with "call 911"),
police yes or no plus reference, and seven photo uploads plus "other documents".
**No field is required**, there is no privacy notice, it is English only, and the other party
is two photos.

| Feature | How it shows in the demo |
|---|---|
| Prefilled context | The QR code carries a signed token with station, country and, where known, plate and rental agreement. The driver confirms instead of typing. |
| One question per screen, branching | Six incident types; follow-up questions depend on the answer (`src/lib/domain/branching.ts`). Safety first, with the emergency number of the station's country (112 in the EU). |
| Guided evidence | Required photo set per incident type with an example outline per shot, compression on the phone, retry queue that survives a lost connection or a closed tab, time and place per photo with consent. |
| Damage marking | Tap zones on a car outline; the same choice as a list for screen readers. |
| Location and time | Device GPS with a pin the driver can drag; date and time default to now. No address lookup service. |
| Other party and witnesses | Structured plate, country, insurer, name, contact; witnesses with consent to be contacted. |
| Save and resume | Every step is saved on the server. The phone keeps only the current step and photos still waiting to upload. |
| Completeness check | Score, what is missing and why it matters, "Add now" jumps to the step. Submit with gaps is allowed and the gaps are recorded. |
| Confirmation | Reference number (`FN-2026-000123`), summary, next steps, personal link to add documents later. |
| Document request link | Same capture component, limited to the requested items (`/d/<token>`). The handler action that creates it comes in phase 2; the server function exists (`createDocumentRequest`). |

## White label theming

Every colour, font, logo and brand text comes from the tenant theme (`src/lib/theme`), applied as CSS
variables by `TenantShell`. Components and `globals.css` carry no brand values.

| Rule | Where |
|---|---|
| The tenant in the signed token decides the theme (QR code, personal link, document request link). Anything invalid falls back to the default. | `src/lib/theme/resolve.ts`, tested in `tests/unit/theme-resolve.test.ts` |
| Default theme: Van Ameyde, Navy, Turquoise, Misty Rose, white, Georgia and Verdana. | `src/lib/theme/defaults.ts`, seed |
| Other tenant themes are added in the admin; the seed contains no third party brands. | seed |
| Every theme other than the default shows "Demo environment, fictional data". The footer always says "Powered by Van Ameyde". | `src/components/TenantShell.tsx` |
| WCAG 2.1 AA contrast check; a failing theme can not be saved. Accent colours are decoration only and never the only signal. | `src/lib/theme/contrast.ts`, tested in `tests/unit/contrast.test.ts` |
| A logo can only be saved with the written permission tick; name and date are stored (also enforced by a database constraint). | `PUT /api/admin/themes/[tenantId]`, `20261124000200_tenant_themes.sql` |
| A theme without that confirmation is a draft: only visible in the admin preview behind login, never on a public link. | `PUBLISHED` filter in `src/lib/server/themes.ts`, tested in `tests/e2e/theme-guard.mjs` |
| SVG logos with scripts, event handlers or external links are refused; logos are served with a sandbox policy. | `src/lib/theme/logo.ts` |
| All pages carry noindex (meta tag and `X-Robots-Tag`). | `layout.tsx`, `next.config.ts` |
| Fonts from an allowlist of fonts already on phones; nothing is loaded from third parties. | `FONT_PAIRS` in `src/lib/theme/model.ts` |

Admin: `/admin` (theme overview, editor with live preview and contrast check, preview behind login).
Until Microsoft Entra ID is connected, the login is a mock behind `AUTH_MOCK_ENTRA` with one demo
password (`ADMIN_DEMO_PASSWORD`, at least 12 characters, set as a sensitive variable in Vercel).
The name entered at login is stored with every theme change and permission confirmation.

On `/demo`, the presenter switch changes the look and the QR codes shown without a reload. A scanned
QR code always shows its own tenant's theme.


## Five minute demo script

1. **(30 s) The problem.** Show a screenshot of the current form: 14 optional cards, "call 911", other party as two photos.
2. **(2.5 min) Driver journey on a phone, in German.**
   - Open `/demo` on a laptop and scan the "Vehicle sticker HH-VA 101" QR code with a phone.
   - Point out: station and plate are already filled in, privacy notice and consent, "call 112" banner.
   - Injured: No. Police: No. Confirm the vehicle. Enter an email.
   - Collision with another party. The map pin is set from GPS; drag it to correct.
   - Rear end. Fill in the other vehicle's plate and insurer. Incident report form: filled in and signed.
   - One sentence of description. Tap the rear bumper on the car outline.
   - Six photos, each with its outline. Turn on flight mode for one photo to show the retry.
   - Witnesses: none. The check shows 93% and what is missing (report form back side) and why. Send with gaps.
   - Reference number, next steps, personal link.
3. **(1 min) Add documents later.** Open the personal link again, tap "Add documents", add the police report.
4. **(1 min) The proof.** Show the measurement data: started, completed, completion rate, time to complete, drop-off per step, completeness at first submission. (Phase 2 shows this on a page; in phase 1 it is a query on `funnel_events` and `incidents`.)

## Setup

Requirements: Node 20.9 or newer, pnpm 10, Postgres 16 for local development.

```bash
pnpm install
cp .env.example .env.local   # then fill in TOKEN_KEYS and RATE_LIMIT_SALT
```

Create a local database (any Postgres 16; the shim adds the Supabase roles):

```bash
createdb fnol_dev
psql -d fnol_dev -f tests/db/supabase-shim.sql
psql -d fnol_dev -f supabase/migrations/20261123000100_init.sql
psql -d fnol_dev -f supabase/seed.sql
```

Run:

```bash
NEXT_PUBLIC_BOT_CHECK=false pnpm build && BOT_CHECK=false pnpm start   # bot check only works on Vercel
```

Open `http://localhost:3000/demo` (needs `DEMO_MODE=true`).

### Tests

```bash
pnpm test                                                   # tokens, branching, completeness
DATABASE_TEST_URL=postgres://postgres@localhost:5432/postgres pnpm test:db   # row level security
BASE_URL=http://localhost:3000 node tests/e2e/driver-journey.mjs            # definition of done, German
BASE_URL=http://localhost:3000 node tests/e2e/theme-guard.mjs               # white label safeguards (needs DATABASE_URL, ADMIN_DEMO_PASSWORD)
LOCALE=en BASE_URL=http://localhost:3000 node tests/e2e/driver-journey.mjs  # same in English
```

The RLS test creates and drops its own database `fnol_rls_test`.

### Deployment (Vercel and Supabase, EU)

1. Supabase project in an EU region. Apply `supabase/migrations/*` in order, then `supabase/seed.sql`.
2. Vercel project with these environment variables: `DATABASE_URL` (transaction pooler), `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, `TOKEN_KEYS`, `TOKEN_ACTIVE_KID`, `RATE_LIMIT_SALT`, `DEMO_MODE`, `AUTH_MOCK_ENTRA`.
   Never `STORAGE_DRIVER=local` (it refuses to run on Vercel).
3. Vercel functions in an EU region (`fra1`), set in `vercel.json`.

## Architecture

- **Next.js 16** (App Router, TypeScript), **next-intl** without locale routing, **zod 4** for one schema used on client and server.
- **Postgres via `pg`** on the server only. The public flow never talks to the database or storage directly.
- **Storage** behind a small interface (`src/lib/server/storage.ts`): Supabase Storage with signed upload URLs in the cloud, a local folder with HMAC signed URLs in development.
- **No middleware.** Language comes from a cookie set by the visible switch, then the browser.

### Security

| Control | Where |
|---|---|
| RLS on every table; anon has no access to any table or function; handlers read only their own tenant; no direct writes | `supabase/migrations/20261123000100_init.sql`, tested in `tests/db/rls.test.ts` |
| Private bucket; signed upload URL per incident and slot; server checks the object exists under that incident before registering it | `20261123000200_storage.sql`, `src/lib/server/intake.ts` |
| Signed tokens (HS256, key ring with `kid` for rotation), typed (entry, incident, docreq), expiry, stored as a hash, revocable | `src/lib/tokens.ts`, tested in `tests/unit/tokens.test.ts` |
| Rate limiting in Postgres (works across serverless instances), client address hashed | `rate_limit_hit`, `src/lib/server/guard.ts` |
| Bot check with Vercel BotID on every write of the public flow | `next.config.ts`, `src/lib/server/guard.ts` |
| Server side validation of every input with strict zod schemas (unknown fields rejected) | `src/lib/domain/schema.ts` |
| No secrets in the repository; `.env*` ignored | `.gitignore`, `.env.example` |
| Security headers, no referrer, tokens in paths never cached | `next.config.ts` |
| Audit log of who changed what | `audit_log`, written by every server change |

## Data model

| Table | Purpose |
|---|---|
| `tenants` | Rental companies; `retention_days` per tenant |
| `stations`, `vehicles` | Fictional master data |
| `entry_tokens` | One row per printed QR code (station card, vehicle sticker, rental agreement); revoke to disable a print |
| `incidents` | One notification: reference, status, the validated draft as JSON, completeness now and at first submission, retention date |
| `evidence_items` | Photos and documents: slot, storage path, type, size, time and place (with consent), source |
| `access_links` | Personal and document request links (hash only), expiry, revocation |
| `document_requests` | Items a handler asks for, message, channel, status |
| `funnel_events` | Measurement without personal data: started, resumed, step viewed and completed, evidence added, submitted |
| `audit_log` | Who viewed or changed what |
| `handler_users` | Phase 2: handlers and admins per tenant (Entra ID object id) |
| `outbound_messages`, `intake_deliveries` | Phase 3: mocked email and SMS, deliveries to the intake target |
| `rate_limits` | Rate limiter windows |

The driver draft is one JSON document validated by `DraftSchema`. Every field documents its
**purpose** in the schema (`.meta({ purpose })`) for data minimisation. The draft deliberately has
no driver name: the rental agreement number links the incident to the driver.

### Measurement (for the business case)

All figures come from `funnel_events` and `incidents`:
started (`flow_started`), completed (`submitted`), completion rate, median time from start to submit,
drop-off per step (last `step_viewed` without `step_completed`), and completeness at first submission
(`first_submission_score`, `first_submission_missing`).

## Phase 3 design (not built yet)

- `IntakePayload`: one typed object (zod, exported as JSON schema into `schema/intake-payload.schema.json`) holding the full notification, evidence references and completeness.
- `IntakeTarget` interface with a mock that writes to `intake_deliveries` and a log. The mapping to the Van Ameyde Intake and Triage CREATE INTAKE API lives in one file once the specification arrives. No field names are guessed.
- `Messenger` interface (email, SMS) with a mock that writes to `outbound_messages`.
- AI hooks behind `AI_ASSIST_ENABLED` (off): photo quality, plate reading, report form reading, voice to text, handler summary. Mocked results only; no personal data to any external AI service without explicit approval.

## Decisions taken

- **pnpm** instead of npm: npm 10 crashed on this dependency tree.
- **`pg` instead of supabase-js for data**: one SQL path that is tested end to end against a real Postgres. supabase-js is used for storage only.
- **No image compression library**: the common library loads its worker from a public CDN and hung in tests. A small canvas resize (max 2048 px, JPEG) replaces it and also strips EXIF data.
- **Draft as one JSON column** instead of separate party and witness tables: one validated object, simple partial saves, simple deletion. Phase 2 can add views for reporting.
- **Only filled languages in the switch** (EN, DE). ES, IT, FR, PT files exist and fall back to English per key.

## [CONFIRM] Open questions

- [CONFIRM] Supabase: the connected account only has a personal organisation. You accepted it for this dummy-data prototype; a project still has to be restored or created (see below).
- [CONFIRM] Required and recommended photos per incident type (`src/lib/domain/evidence.ts`), especially four corners optional for a collision and required for parked or unknown cause.
- [CONFIRM] Branch questions per incident type; they are a proposal, the current form has none.
- [CONFIRM] Driver data: email or phone only, no name, as in the current form.
- [CONFIRM] Privacy notice text, controller and legal basis (placeholder now).
- [CONFIRM] Link lifetimes: personal link 30 days, document request 14 days, entry QR until revoked.
- [CONFIRM] Retention per tenant (30 days for test data).
- [CONFIRM] Map tiles from OpenStreetMap's public servers are fine for a prototype; production needs a tile provider under contract.
- [CONFIRM] Australia (000, en-AU) is prepared but switched off.
- [CONFIRM] Admin login: replace the demo password by Microsoft Entra ID before any real tenant uses the admin page.
- [CONFIRM] Incident report form (IRF) is the rental partner's own form in the glove box; front and back are separate photos as today.
