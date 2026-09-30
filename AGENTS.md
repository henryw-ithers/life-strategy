# AGENTS.md

Orientation for AI coding agents working in this repository.

## What this project is

**Life Strategy** — a personal planning app where users rate the
importance and satisfaction of 18 Strategic Life Units, and the app
derives a 100-point daily scoring system of goals and tasks from those
ratings. Read [vision.md](vision.md) before making any product-shaped
decision; it is the source of truth for what the app is and is not.

## Current phase

**Core loop closed; extending it.** All ten foundational ADRs in
[docs/adr/](docs/adr/) are **accepted**; follow them. Strategic design
context lives in [PRODUCT.md](PRODUCT.md); the visual system (tokens,
components, and the bubble-backdrop signature every screen carries) in
[DESIGN.md](DESIGN.md). If a task requires a decision the ADRs don't
cover, check the Planned-ADRs table in the
[ADR index](docs/adr/README.md) and surface the question rather than
silently picking an answer.

## Repository layout

npm workspaces monorepo:

- `apps/mobile` — the Expo app (TypeScript, Expo Router, `src/app/`
  file-based routes). **Expo SDK 54, deliberately pinned** — not the
  latest; the test iPhone's Expo Go caps there, so check
  [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md) and read the v54 docs
  before writing Expo API code. Database: `expo-sqlite` + Drizzle;
  schema at `src/db/schema.ts`, migrations generated into `drizzle/`
  via `npm run db:generate -w apps/mobile` (never hand-edit or delete
  past migrations — forward-only, ADR-0002).
- `packages/scoring` — the pure scoring engine (`@glide/scoring` — an
  internal name the rename deliberately left alone, see Conventions).
  **No React Native imports allowed here, ever** (ADR-0001).
  All derivation/grading math lives here as pure functions with vitest
  tests.
- `packages/backup` — the pure backup envelope (`@glide/backup`):
  header encode/decode and the seal/open flow. Same rule — **no React
  Native imports** — so the format is testable off-device. It
  **performs no cryptography**: AES-256-GCM and PBKDF2 arrive injected
  as a `BackupCrypto` (ADR-0020). The device half (SQLite serialize,
  share sheet, file picker) stays in `apps/mobile/src/backup/`.
- `apps/mobile/modules/glide-crypto` — a local Expo module wrapping
  **Apple's** CryptoKit and CommonCrypto. Swift, iOS-only, deliberately
  thin. Because it is custom native code, **backup and restore do not
  work in Expo Go** — they need a development or TestFlight build.

**iOS is the only target** (ADR-0020 amended ADR-0001; Android was
dropped along with its `android` block and adaptive icons). The app
also runs in a browser as a **development preview only** — a way to
look at UI without a device, never a target. It needs three pieces of
setup that are easy to break; read
[docs/web-preview.md](docs/web-preview.md) before touching
`metro.config.js`, `src/db/client.web.ts`, or the `expo-sqlite` patch
in `patches/`. Backup does not work there either — same native-module
reason as Expo Go.

Root commands: `npm test` (both packages, plus the pure-logic tests
under `apps/mobile/src/lib` — ADR-0013 put a vitest runner in the app
workspace for the crash-log redactor; anything there must stay free of
React Native imports to be testable), `npm run typecheck` (packages and
app), `npm run mobile` (Expo dev server).

## Domain vocabulary

Use these terms consistently in code, docs, and UI copy:

| Term | Meaning |
|------|---------|
| **SLA** — Strategic Life Area | One of 6 top-level life areas (e.g., Relationships) |
| **SLU** — Strategic Life Unit | One of 18 sub-areas under the SLAs (e.g., Friendship); the unit of diagnosis and scoring. Taxonomy revisions preserve unit ids (renames/re-homes are labels); retired units are archived by the launch-time sync, never deleted. **Three of the 18 are diagnosed and *dimensioned* rather than scored directly** — see Motivation kind |
| **Motivation kind** | `instrumental` or `communal` (ADR-0025 §1). The three Relationships units — Significant other, Family, Friendship — are **communal**: dimensions, not containers. They hold no tasks and cannot be a task's home unit; anything may *tag* them instead, per completion, by press-and-hold. "Autotelic" is editorial only — guidance copy, never a stored value, the same demotion ADR-0021 gave areas |
| **Diagnostic** | The periodic assessment: importance (1–10) and satisfaction (1–10) per SLU. **User-facing copy always says "Priority," never "Importance"** — everything on the list is important; the rating is relative standing. Schema, scoring engine, and formulas keep `importance` as the domain term |
| **Snapshot** | One saved diagnostic; snapshots form the portfolio history |
| **Portfolio graph** | Bubble chart: importance (y) × satisfaction (x), bubble size = effort invested |
| **Weight** | An SLU's share of the 100 daily points, derived from the diagnostic |
| **Goal** | A specific, measurable, temporary objective within an SLU |
| **Milestone** | A checkpoint inside a larger goal |
| **Task** | The unit of execution; happens N times per week (`times_per_week`, 1–7; 0 = once every two weeks) on whichever days, and earns points from its unit's weight |
| **Commitment** | A custom `life_unit` (`is_custom`) holding tasks and **sub-commitments** — School, Work, Basketball Club. At most three. Scored from its **own band**, not the 18 units' pool (ADR-0029, ADR-0032) |
| **Sub-commitment** | A commitment's child unit (School → COMP2521), via `parent_unit_id`. Uncapped, and **prices nothing** — the band divides across eligible *tasks* |
| **Window** | A stretch of the day work is placed into: the gaps between commitments where there are any, morning/afternoon/evening where there are not. Gaps under 30 min are *buffer*, not free time (ADR-0033) |
| **Pool** | Up to three equal-priced candidate tasks in a window, any of which satisfies it. Carries a *planned count* that sets the day's ceiling (ADR-0033) |
| **Activity** | A spontaneous one-off logged event, tagged to ≤3 SLUs. Credit is `size × the unit's daily share` and draws from the day's shared `UNPLANNED_CAP` pool (ADR-0009 as amended by ADR-0023) |
| **Grade** | Points earned out of 100 (daily), aggregated weekly/monthly |
| **Achievement** | Generated by completing a goal/milestone; feeds monthly summaries, never daily grades |
| **Contentment check-in** | Weekly 1–10 "how content did you feel?" question used to calibrate grading |
| **Memory flag** | User mark on a day or activity meaning "worth remembering"; feeds look-back views. Journal entries, photos, and flags stay addable after a grade settles, and since 2026-08-13 notes are editable and deletable and photos removable (ADR-0002 amendment; press and hold in the day record) |

## Hierarchy

    SLA → SLU → Goal → Task

A **commitment** is an `is_custom` SLU with children
(`parent_unit_id`), so it lives in the same hierarchy rather than a
second one. What separates it is its **band**, not its table
(ADR-0029).

## Product invariants — do not violate

- Active SLU weights always sum to exactly **100**.
- Weight derivation is **importance first, satisfaction-gap boost
  second** (see ADR-0003).
- Every derived value is user-overridable, and every override still
  displays the recommended value beside it.
- Daily grades measure consistency, never one-time achievements;
  achievements feed monthly/yearly summaries only.
- **Planned work is what pays** (ADR-0023). At most `UNPLANNED_CAP`
  points of a day may come from anything the user didn't plan —
  activity credit, the special-day rating bonus, and commitment work
  done on a day it wasn't scheduled for (ADR-0032 §4) share that one
  pool. Extra runs of planned tasks sit outside it, deliberately: the
  only uncapped route above 100 is doing more of your own plan. Do not
  add a new credit source without deciding which side of that line it
  falls on.
- Daily grades are **private by default**. Never add leaderboards,
  score comparisons, or competitive rankings — these are excluded by
  design, not omitted by accident.
- **The app never shames.** Scores are framed as guidelines in all
  copy; low grades get neutral, kind presentation; no alarm colors,
  streak guilt, or loss-aversion mechanics. Stored grades are never
  altered for emotional effect — kindness lives in the presentation
  layer, truth lives in the data.
- **Kindness is ambient, never targeted** (ADR-0008). No copy, prompt,
  or feature may condition on low grades or low contentment —
  encouragement reads identically on good and bad weeks. Celebration
  may condition on positive events only. Support resources are always
  discoverable, never reactively surfaced. Calibration suggestions
  apply only on explicit user confirmation, and dismissed suggestions
  never re-appear unless the user seeks them out.
- **Areas are presentational** (ADR-0021). An SLA may determine colour,
  grouping, and the diagnostic's opening seed — never weight, rank,
  points, or any stored score. `life_unit.area_id` is a soft attribute:
  re-homing a unit is a label change, like a rename. No UI may let the
  user re-rank, re-weight, or reorder *areas* into a stored value; that
  has been built once and it destroyed data.
- **Clock times are permitted on any task, and required on none**
  (ADR-0030, superseding ADR-0024 §1). `anytime` and part-of-day remain
  the **defaults**, and that is now the only place the product's
  opinion about granularity lives — do not let a flow default to a
  time, and do not make one a required field.
- **A commitment task never takes a scoring slot in a life unit.** It
  may tag one, and that `task_unit` row must be `membership = 'note'`
  (ADR-0029 §3). A `scoring` row would double-pay across two bands,
  which is the one route to inflating a day.
- **There is no mark, grade, result or absence record anywhere in the
  commitment model** (ADR-0029 §§2–4), so `attended ÷ scheduled` is not
  merely forbidden, it is uncomputable. Keep it that way.
- **On a day with scheduled commitment work the day is three bands**,
  not two: the commitment band (user-set, 10–60, capped flat at 60)
  then 80/20 on what remains. Every other day is unchanged
  (ADR-0032). Commitment work is **scheduled, not counted**: it pays
  its scheduled-day value on its day, the same value from the
  unplanned pool on any other, and never an extra-run rate. Formula
  v9.
- The daily surface stays checklist-simple; complexity belongs in the
  periodic strategy layer.
- **All cryptography is Apple's, and adding any bundled crypto library
  is a decision with legal consequences** (ADR-0020). Shipping only
  CryptoKit/CommonCrypto is what makes the app export-exempt and lets
  `app.json` declare `usesNonExemptEncryption: false` honestly. A JS
  cipher — most temptingly, a fallback so backup works in Expo Go
  again — silently makes that declaration false and pulls the app back
  under EAR reporting. If you genuinely need one, say so and update
  [docs/release.md](docs/release.md); do not add it quietly.

## Conventions

- Tech stack, repo layout, and tooling are decided in ADR-0001/0002 —
  follow them once accepted.
- **The app is called Life Strategy.** It was Life Strategy, became
  Glide, and was renamed back on 2026-08-13. The home-screen label is
  the shorter **"Strategy"** so iOS does not truncate it. Only
  user-facing strings moved. **Every internal `glide` identifier
  deliberately stayed** — the bundle id `com.glidelifestrategy.app`
  (changing it costs every tester their data), the Expo slug, the
  `glide://` URL scheme, the `@glide/*` package names, and the
  `glide-crypto` native module. Do not "finish" the rename by
  changing them; the reasoning for each is in
  [docs/release.md](docs/release.md). The feedback address **did**
  move, separately, to `henrywithersfeedback@gmail.com`.
- **Accepted ADRs still say "Glide" and are not rewritten.** They are
  dated records of decisions made under that name, and editing them
  would be rewriting history — the same principle ADR-0022 applies to
  the snapshot scale. Read "Glide" in an ADR as "this app."
- **Three names are compatibility surfaces, not branding, and predate
  both renames:** the `life-strategy.db` SQLite filename, the `LSBK`
  magic bytes, and the `.lsbk` extension. Renaming any of them orphans
  user data or invalidates existing backups. See
  [docs/release.md](docs/release.md).
- New architecturally significant decisions get an ADR in
  `docs/adr/` using [template.md](docs/adr/template.md), numbered
  sequentially, and a line in the ADR index.
- Keep documents wrapped at ~72–80 columns to match existing files.
- **Never run `npm audit fix --force`.** `npm audit` reports ~21
  findings (down from ~39 since ADR-0020 dropped `@noble`); they
  collapse to a handful of CVEs (brace-expansion, postcss ×3, uuid,
  esbuild) and npm's stated fix for all but one is
  `expo@57.0.8` — it would silently undo the SDK 54 pin. Every one of
  them is in build tooling (dev server, PostCSS, CLI globbing), not in
  anything that ships in the app, and nothing here is
  network-exposed in production. The esbuild advisory (a website can
  reach the dev server) is the only one worth thinking about, and only
  while `npm run mobile` is running on an untrusted network. Clear
  them when the Expo Go constraint lifts and the SDK moves — not
  before, and not one dependency at a time.
