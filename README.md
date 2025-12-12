# CathShield.ai Mobile Suite

Hospital-grade, mobile-first catheter surveillance workflow built with Next.js App Router, Prisma, and MySQL. The app enforces the mandatory sequence Patient → Consent → Capture → Dashboard → Alerts → Ward Analytics → Resource Module while keeping all UI spacing, typography, and colors consistent with the CathShield specification.

## Getting started

1. **Install dependencies**

	```bash
	npm install
	```

2. **Configure environment**

	Create `.env` with your MySQL connection and Gemini API key:

	```bash
	DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
	GEMINI_API_KEY="your_google_generative_ai_key"
	# Optional overrides
	# GEMINI_MODEL="gemini-1.5-pro-latest"
	# GEMINI_API_URL="https://generativelanguage.googleapis.com/v1beta/models/...:generateContent"
	```

3. **Create & seed the database**

	```bash
	npx prisma migrate dev --name init
	npm run db:seed
	```

	The seed script provisions sample patients, risk snapshots, ward metrics, and resource metrics so the dashboards render immediately.

4. **Run the dev server**

	```bash
	npm run dev
	```

5. **Build & start (Vercel parity)**

	```bash
	npm run build
	npm start
	```

## Key folders

- `app/` - App Router routes for each workflow step plus API handlers under `app/api/**` (Vercel-ready serverless functions).
- `components/` - Mobile-first UI primitives (cards, nav, modals, trend chart, alerts).
- `context/WorkflowContext.tsx` - Enforces sequential workflow state, persisted in localStorage.
- `lib/` - Prisma client, deterministic risk engine, Gemini helper, alert utilities.
- `prisma/` - Database schema + `seed.ts` for mock operational data.
- `public/audio/` - Placeholder consent audio assets (replace with validated recordings before production).

## Risk & analytics logic

- `lib/riskEngine.ts` contains deterministic heuristics for CLISA, traction, patient/systemic factors, and dwell time; it now consumes signals returned by `lib/gemini.ts` whenever a `GEMINI_API_KEY` is configured.
- `lib/alerts.ts` derives CLABSI / venous / traction / dressing / resource alerts and feeds `/api/alerts`.
- `app/api/dashboard`, `app/api/ward-metrics`, and `app/api/resource-metrics` expose REST endpoints consumed via SWR on mobile screens.

## Implementation (ideal state) & detection logic

This system is implemented as a **two-stage pipeline**:

1. **Signal extraction (from image + device telemetry)** → produces normalized “signals” (e.g., erythema score, dressing lift %, traction pull counts).
2. **Risk scoring + alerting (deterministic rules)** → converts those signals into risk scores/bands and generates actionable alerts.

### What runs where

- **API entrypoint (capture):** `app/api/captures/route.ts`
	- Accepts `catheterImageUrl` (Data URL / base64), optional traction module image, and shift telemetry (`tractionCounts`, `events`, `adaptiveTractionAlert`).
	- Persists captures in `ImageCapture` and shift telemetry in `ShiftEvents` (12-hour rolling window; see `lib/shiftWindow.ts`).
	- Calls model-assisted image analysis (`lib/gemini.ts`) and then computes a `RiskSnapshot` via `lib/riskEngine.ts`.
	- Derives `Alert` rows from the computed bands + dressing failure checks (`lib/alerts.ts`).

### “Model” usage (what it does today)


The “model” in this repo is a **Gemini vision call** that performs *feature extraction* (not end-to-end risk prediction). It turns an image into a small structured `ImageSignals` object that the deterministic risk engine can score.

**Step-by-step flow (what `lib/gemini.ts` does):**

1. **Input format**
	- `app/api/captures/route.ts` sends `catheterImageUrl` as a Data URL (e.g., `data:image/jpeg;base64,...`).
	- `lib/gemini.ts` splits it into `{ mimeType, data }` using a regex. If the string is *not* a Data URL, it assumes JPEG and treats the entire input as base64.

2. **Prompt contract (feature schema)**
	- Gemini is instructed: “Score each feature from 0–3 and respond with compact JSON only”.
	- Expected JSON keys (the stable contract consumed by the backend):
		- `erythema`, `drainage`, `ooze`, `moisture`: ordinal severity scores in `[0..3]`
		- `dressingLift`: percentage in `[0..100]`
		- `chgPatch`, `maceration`: JSON booleans (`true`/`false`)

3. **Endpoint/model selection**
	- Default model is `gemini-2.0-flash` (override with `GEMINI_MODEL`).
	- API base switches between `v1` and `v1beta` depending on whether the model name contains `"1.5"`.
	- You can override the full endpoint via `GEMINI_API_URL`.

4. **Request payload shape**
	- The request uses `generateContent` with two parts:
		- `{ text: <PROMPT> }`
		- `{ inline_data: { mime_type: <mimeType>, data: <base64> } }`

5. **Response extraction**
	- The implementation concatenates any returned `text` parts from `candidates[0].content.parts`.

6. **Parsing & coercion**
	- The parser searches for the first JSON-like object in the text (regex for `{ ... }`), then `JSON.parse`s it.
	- Numeric fields are coerced via `Number(value) || 0`.
	- Boolean fields are coerced via `Boolean(value)` — so the prompt expects *real JSON booleans* (not strings like `"false"`).
	- If parsing fails, it returns `null`.

7. **Failure behavior (no hard dependency on the model)**
	- If `GEMINI_API_KEY` is missing, the request fails, or parsing fails, the function returns `null`.
	- `lib/riskEngine.ts` then falls back to a fixed default `ImageSignals` profile (`defaultSignals`) so risk scoring still works end-to-end.

**How these model outputs affect detection**

- The model outputs do **not** directly decide “alert vs no alert.” They only influence computed site/dressing features.
- Those features feed into:
	- `clisaScore` (site inflammation/exudate + dressing integrity modifiers)
	- Dressing-failure detection (e.g., `dressingLift > 30` or `maceration === true`)
- The *final* `predictiveClabsiBand` / `predictiveVenousResistanceBand` and alerts are produced by transparent deterministic rules in `lib/riskEngine.ts` + `lib/alerts.ts`.

This design keeps the system functional without the external model, while allowing model-assisted signal extraction when configured.

### Risk scoring theory (what the backend computes)

All scoring is performed in `lib/riskEngine.ts` and stored as a `RiskSnapshot`.

**1) CLISA-like site score (0–4)**

- `clisaScore = f(erythema, drainage, ooze, moisture, dressingIntact, dressingLift, maceration, chgPatch)`
- Intuition: visible inflammation/exudate + dressing integrity issues increase local-site risk.

**2) Traction score (0–3)**

- Derived from traction pull counts (yellow/red) and whether dressing/catheter changes occurred in the current shift window.
- Intuition: repeated traction events correlate with line instability and downstream complications.

**3) Patient factor score (0–3)**

- Computed as a count-based severity of boolean flags (`patientFactors` JSON on `Patient`).
- Intuition: more systemic/behavioral risk factors increase baseline complication susceptibility.

**4) Dwell time + phase-aware scoring**

- `daysSinceInsertion = differenceInDays(now, insertionDate)`
- `riskPhase = early` if `daysSinceInsertion <= 3`, else `late` (override supported).
- The pipeline computes:
	- `earlyClabsiScore` (local + patient + basic dwell)
	- `lateClabsiScore` (early score + traction + trend/dwell penalties + late-phase boost)
- Final **predictive CLABSI score** is phase-dependent:
	- `predictiveClabsiScore = earlyClabsiScore` when `riskPhase=early`
	- `predictiveClabsiScore = lateClabsiScore` when `riskPhase=late`

**5) Risk bands (green/yellow/red)**

- Bands are derived from numeric scores using configurable thresholds:
	- Defaults: `greenMax=3`, `yellowMax=6` (see `lib/riskConfig.ts`)
	- Override via `RISK_BAND_THRESHOLDS` env (JSON: `{ "greenMax": number, "yellowMax": number }`).

**6) Venous resistance band**

- `predictiveVenousResistanceBand` is derived directly from traction pull counts (heuristic mapping), with an escalation if `adaptiveTractionAlert` is true.

### Alert generation logic (what triggers an alert)

Alerts are created in `app/api/captures/route.ts` via `lib/alerts.ts`.

- **High CLABSI risk:** if `predictiveClabsiBand !== green` → `AlertType=high_clabsi` (severity escalates to `critical` if red).
- **High venous resistance band:** if `predictiveVenousResistanceBand !== green` → `AlertType=high_venous_resistance`.
- **Traction event alert:** if `tractionPullsRed >= 2` within the shift window → `AlertType=traction`.
- **Dressing failure:** if any of the following are true:
	- Safety checklist says dressing is not intact (`safetyChecklist.dressingIntact === false`), or
	- Model signal indicates significant lift (`dressingLift > 30`), or
	- Model flags maceration (`maceration === true`).

### Ideal-state implementation (what “production-grade” would look like)

The repo currently uses Gemini to extract features as a pragmatic stand-in for a dedicated vision model. The intended “ideal” architecture is:

- Replace `lib/gemini.ts` feature extraction with a **catheter-site computer vision model** (classification/segmentation) that outputs the same `ImageSignals` contract.
- Store **model confidence/uncertainty** per signal and surface low-confidence cases for manual review.
- Calibrate scores per site/camera/lighting (domain shift) and implement drift monitoring.
- Keep the deterministic `lib/riskEngine.ts` scoring layer (transparent + auditable) while allowing thresholds to be tuned clinically (`RISK_BAND_THRESHOLDS`).

### Error / accuracy determination (how to evaluate this system)

This repo does not currently compute “accuracy” automatically; evaluation requires labeled ground truth. Because the pipeline is two-stage, accuracy should be measured at both levels:

**A) Image signal extraction accuracy (model-level)**

- Create a labeled dataset where clinicians annotate the target schema (`erythema/drainage/ooze/moisture`, dressing lift, CHG patch present, maceration).
- Recommended metrics:
	- Ordinal scores (`0..3`): mean absolute error (MAE) and/or weighted Cohen’s $\kappa$.
	- Booleans (`chgPatch`, `maceration`): precision/recall/F1.
	- `dressingLift` (%): MAE and calibration plots across bins.

**B) Risk/alert accuracy (system-level)**

- Define ground truth outcomes (e.g., clinician-confirmed dressing failure, suspected infection escalation, confirmed CLABSI event, patency/occlusion events).
- Evaluate:
	- Confusion matrix for `predictiveClabsiBand` vs. labels.
	- Sensitivity/recall for `red` (high-risk) cases and precision to control alarm fatigue.
	- Time-to-detection (lead time) for events that occur later.
- Threshold selection:
	- Tune `RISK_BAND_THRESHOLDS` on a validation set to balance sensitivity vs false alerts, then lock on a held-out test set.

**Important:** The current scoring rules and Gemini prompt are suitable for prototyping and demos, but they are not a substitute for validated clinical decision support. Any real-world use should include prospective validation, governance, and human-in-the-loop review.

## Deployment (Vercel)

1. **Configure environment variables** in the Vercel dashboard:
	- `DATABASE_URL` - production MySQL (PlanetScale, Neon for MySQL, etc.).

2. **Build command**: `npm run build`

3. **Install command**: `npm install`

4. **Run command**: `npm start`

5. **Prisma on Vercel**:
	- Run `npx prisma migrate deploy` against the production database after pushing migrations.
	- Seeding can be executed locally via `npm run db:seed` (avoid running in serverless environments by default).

## Audio consent

The repo ships with short placeholder WAV files to enforce the consent workflow. Replace `public/audio/consent-en.wav` and `public/audio/consent-kannada.wav` with hospital-approved voiceovers before clinical use.

## Testing & linting

- `npm run lint` - Next.js + ESLint config.
- `npm run db:migrate` / `npm run db:deploy` - Prisma helpers for local vs production migrations.
- `npx tsx scripts/testCapture.ts` - Creates a throwaway patient, uploads `test_image.jpeg`, and prints the risk snapshot payload (useful smoke test for capture + Gemini fallbacks).

## Notes

- Patient privacy banner appears on first load; patient identity is limited to Bed No. + initials across the UI.
- All layouts are tuned for 320-430 px mobile screens with consistent Tailwind spacing and teal/medical-blue + risk (G/Y/R) colors.
- Offline/poor connectivity states surface via inline status text; extend with real toasts as needed.
