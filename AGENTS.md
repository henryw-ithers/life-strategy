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
  past migrations — forward-only, ADR-0002). Inside `src/`: `db/` is
  one module per concern (`today.ts` assembles a day; completions,
  activities, journal, photos, placements and the stored `dayGrades`
  each have their own), `hooks/` holds screen state, `lib/` is pure
  helpers (`calendar.ts` owns "what day is it"), and `components/` is
  grouped by feature. **The data layer never imports from
  `components/`**; a rule both need belongs in `@glide/scoring` or
  `lib/`.
- `packages/scoring` — the pure scoring engine (`@glide/scoring` — an
  internal name the rename deliberately left alone, see Conventions).
  **No React Native imports allowed here, ever** (ADR-0001).
  All derivation/grading math lives here as pure functions with vitest
  tests — including which days a task is scheduled on (`schedule.ts`),
  which the app reads rather than reimplementing.
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

Root commands: `npm test` (both packages, plus the app's pure-logic
tests — every `__tests__` folder under `apps/mobile/src`; ADR-0013 put
a vitest runner in the app workspace, and anything those tests import
must stay free of React Native), `npm run typecheck` (packages and
app), `npm run lint` (ESLint over the app), `npm run mobile` (Expo dev
server). CI runs test, typecheck and lint on every push and pull
request (`.github/workflows/ci.yml`).

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
| **Commitment** | A custom `life_unit` (`is_custom`) holding tasks and **sub-commitments** — School, Work, Basketball Club. At most three. Scored from its **own band**, not the 18 units' pool (ADR-0035, ADR-0032) |
| **Sub-commitment** | A commitment's child unit (School → COMP2521), via `parent_unit_id`. Uncapped, and **prices nothing** — the band divides across eligible *tasks*. A commitment is either **split** into sub-commitments (`uses_sub_commitments`) and holds no work itself, or holds its own work and has none. A split commitment starts with a sub-commitment called **General**, renamable and deletable like any other. Each opens its own screen; hold its row to rename or delete it. Turning the switch off archives them, remembering each task's place; turning it on restores them and puts the work back (ADR-0035 §1 as amended) |
| **Event** | A time you attend — a class, a shift, a doctor's visit. A task with `kind = 'event'`, a **required** start and end, and an optional location; ticked and paid like any task. "Event" in code and on screen (ADR-0038) |
| **Window** | A stretch of the day work is placed into: the gaps between commitments where there are any, morning/afternoon/evening where there are not. Gaps under 30 min are *buffer*, not free time. Unfinished work **carries forward** to the window open now — a display rule, never a write; clock-timed tasks stay put (ADR-0033) |
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
(ADR-0035).

## Product invariants — do not violate

- Active SLU weights always sum to exactly **100**.
- Weight derivation reads **priority rank and nothing else**
  (ADR-0028 §1, formula v8). ADR-0003 §1's satisfaction-gap boost is
  withdrawn and `GAP_COEFFICIENT` retired. Satisfaction is still
  diagnosed, stored, plotted, and read by `unitProfile` — it is the
  measure of whether the plan is working, never an input to it. The
  rank score is flattened to `WEIGHT_SPREAD` (2) before normalizing, so
  no unit in the portfolio is too small to hold a task worth having.
- Every derived value is user-overridable, and every override still
  displays the recommended value beside it.
- Daily grades measure consistency, never one-time achievements;
  achievements feed monthly/yearly summaries only.
- **A day is the fraction of itself you got through** (ADR-0029,
  formula v9). The day's denominator is the weight of the work actually
  **due** that day: every-day tasks and anything pinned to today count
  in full, and flexible work — anything with no weekday pin — is pooled
  and divided evenly over the days the week has left. Do what the day
  asked and the planned band pays 90 of the 100; the other 10 is the
  unplanned pool. Cadence decides how often something is due, never
  what it is worth, and how many tasks a unit holds never changes what
  that unit is worth.
- **A task's point value is a property of the day, not the task.**
  `task.point_value` stores a *weight* (a share of the 100); points are
  `90 × weight ÷ that day's expected load`, computed per day. Do not
  reintroduce a fixed stored point value.
- **Obligations are weekly** (ADR-0029 §3). The grade reads
  `planned_weekdays` — ADR-0024 §2 is withdrawn — but nothing anywhere
  compares a completion's date to the day it was pinned to. Doing
  Friday's run on Tuesday is still a perfect week; a missed pinned day
  lapses silently and never returns as a debt; no adherence rate,
  streak, or plan-completion percentage is computed, stored, or
  derivable. Adding one would be the schedule-violation mechanic
  ADR-0024 §2 existed to prevent.
- **Planned work is what pays** (ADR-0023). At most `UNPLANNED_CAP`
  points of a day may come from anything the user didn't plan —
  activity credit and the special-day rating bonus share that one
  pool (scaled with the life share on a commitment day). Two routes sit outside it, deliberately, and both are your own
  plan: extra runs of planned tasks, and work done off the day it was
  planned for — commitment work (ADR-0032 §4) and runs pinned to another
  day (ADR-0037 §3) — paid what that day would have paid. Those are the
  only uncapped routes above 100. Do not add a new
  credit source without deciding which side of that line it falls on.
- **A day that asks nothing becomes a rest day automatically**
  (ADR-0037, `isRestDay`): no life work due, no commitment work
  scheduled, a plan behind it, **and** either nothing open later this
  week or something open done early today. It scores **70**; activities
  fill the last 30 at three times the usual rate; early work is paid on
  top, uncapped, at **what its planned day would have paid** — as it is
  on every other day too. **Every open task is listed before its
  planned day**, at the bottom of the open list, soonest first, so it
  can be done early. That section opens collapsed and loads its
  one-offs only when opened (`loadPlannedAhead`). It is
  never offered or chosen and is not a day kind; a day off stays
  ungraded. An empty day with work open and none done is ungraded.
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
  (ADR-0036, superseding ADR-0024 §1) — **except an event**, whose
  start and end are what it is (ADR-0038). `anytime` and part-of-day remain
  the **defaults**, and that is now the only place the product's
  opinion about granularity lives — do not let a flow default to a
  time, and do not make one a required field.
- **A commitment task never takes a scoring slot in a life unit.** It
  may tag one, and that `task_unit` row must be `membership = 'note'`
  (ADR-0035 §3). A `scoring` row would double-pay across two bands,
  which is the one route to inflating a day.
- **There is no mark, grade or result anywhere in the commitment
  model** (ADR-0035 §§2–4). **Events are ticked when attended**
  (ADR-0038), so `attended ÷ scheduled` is now computable — and it is
  **never computed, stored or shown**: no attendance rate, no count of
  missed events, nothing derived from events not ticked, and a missed
  event is never mentioned.
- **On a day with scheduled commitment work, the commitment band is
  that share of the whole day** (user-set from 10, capped at 60, 70 or
  80 for one, two or three commitments — `commitmentBandMax`), with each
  commitment's share a percentage of it,
  paid as the share of today's commitment work done, and ADR-0029's
  whole day — planned 90, unplanned 10, extra runs — is scaled into
  what it leaves. **Commitments are the band, never more**: doing only
  the commitment work scores the band, and a day with no life work due
  tops out there. Every other day is ADR-0029's day exactly
  (ADR-0032 as amended 2026-10-01). Commitment tasks have **no weight**
  and are never in the day's load. Commitment work is **scheduled, not
  counted**: it pays its scheduled-day value on its day, the same
  value uncapped on any other, and never an extra-run rate. **An early
  session is the next session done early** — it takes that session's
  value, and that session is then done on its own day — so each
  session pays once. Formula v10.
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
