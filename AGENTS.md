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

**The windows redesign is accepted and being built** (ADRs 0039–0045,
accepted 2026-10-13). The behaviour is specified in
[docs/design/redesign-spec.md](docs/design/redesign-spec.md), and the
build runs in phases: Expo upgrade, fixes, native shell, scoring
engine, data layer, then the screens. The vocabulary and invariants
below describe the accepted design. Where a phase hasn't landed yet,
the code still follows the older rule its ADR amends. Change it in the
phase that owns it, not along the way. Which phases are done and what
the next one must do is tracked in
[docs/design/redesign-build.md](docs/design/redesign-build.md).

## Repository layout

npm workspaces monorepo:

- `apps/mobile` — the Expo app (TypeScript, Expo Router, `src/app/`
  file-based routes). **Expo SDK 57** (React Native 0.86, React
  19.2), run on the iPhone as an **EAS development build**, not Expo
  Go (ADR-0043). Read the v57 docs before writing Expo API code; see
  [apps/mobile/AGENTS.md](apps/mobile/AGENTS.md). Database: `expo-sqlite` + Drizzle;
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
- `packages/backup` — the pure backup file format (`@glide/backup`):
  writing a backup and reading one back, with a header and a CRC-32.
  Same rule, **no React Native imports**, so the format is testable
  off-device. A backup is a **plain file, not encrypted** (ADR-0046).
  The device half (SQLite serialize, share sheet, file picker) stays
  in `apps/mobile/src/backup/`.

**iOS is the only target** (ADR-0020 amended ADR-0001, and ADR-0046
kept it; Android was
dropped along with its `android` block and adaptive icons). The app
also runs in a browser as a **development preview only** — a way to
look at UI without a device, never a target. Its setup is easy to
break; read [docs/web-preview.md](docs/web-preview.md) before touching
`metro.config.js`, `src/db/client.web.ts`, the `expo-sqlite` patch in
`patches/`, or the web entry `index.web.js` (which loads Skia's
WebAssembly build before the router starts). Backup is untested
there; it is a device feature.

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
| **SLU** — Strategic Life Unit | One of 18 sub-areas under the SLAs (e.g., Friendship); the unit of priority and scoring. Taxonomy revisions preserve unit ids (renames/re-homes are labels); retired units are archived by the launch-time sync, never deleted |
| **Motivation kind** | `instrumental` or `communal` (ADR-0025 §1). Since ADR-0027 §4 the three Relationships units are ordinary units: they hold tasks and are planned like any other. `motivation_kind` is editorial context only, and tagging a completion with them no longer pays. "Autotelic" is editorial only too |
| **Priorities** | Where the user sorts the 18 SLUs into four tiers (Top, Important, Background, Not now) and orders them within each (ADR-0041). Replaced the diagnostic's ranking and satisfaction rating; satisfaction is no longer asked. **User-facing copy says "Priority," never "Importance"**; schema and engine keep `importance` as the domain term. Not now is out of the plan: no weight, no tasks |
| **Snapshot** | One saved set of priorities, written when the user taps Done on Priorities; snapshots form the history |
| **Effort share** | Each unit's share of all completed work over the last 4 weeks, shown on Life with no target. Replaced the portfolio graph (ADR-0041) |
| **Weight** | An SLU's share of the 100 daily points, derived from its tier and its order within the tier |
| **Goal** | Optional. One of four types the app can count: times done, time spent, points earned (a running total) or streak (ADR-0042). Which tasks count depends on the type. Made from templates |
| **Goal template** | A ready-made goal of one type for a unit or kind of commitment; the goal library is made of these (ADR-0042 §7) |
| **Task** | The unit of execution; happens N times per week (`times_per_week`, 1–7; 0 = once every two weeks) on whichever days, and earns points from its unit's weight |
| **Commitment** | A custom `life_unit` (`is_custom`) holding tasks, events and **sub-commitments**: School, Work, Basketball Club. At most three. Scored from its **own share of the day**, not the 18 units' 100 (ADR-0035, ADR-0032, ADR-0044) |
| **Sub-commitment** | A commitment's child unit (School → COMP2521), via `parent_unit_id`. Uncapped, and **prices nothing**: the share divides across eligible *tasks*. A commitment either holds sub-commitments and no work of its own, or holds its own work and has none. There is no switch: adding the first sub-commitment splits the commitment and moves its work into one called **General**; removing the last one puts the work back (ADR-0035 §1, ADR-0044 §7). Tap a title to rename it |
| **Event** | A time you attend: a class, a shift, a doctor's visit. A task with `kind = 'event'` and a **required** start and end; ticked and paid like any task. A repeating event can run for N weeks or until a date, and weeks can be skipped (ADR-0038, ADR-0040). No location |
| **Working hours** | The weekly template of when the user is free to work, set like iOS Sleep schedules: groups of days, each with time ranges (ADR-0039 §1) |
| **Window** | A stretch of free time to work in: working hours minus events (with a 10-minute buffer) minus named gaps; pieces under 30 min are buffer. **Windows have no names**; they are shown by their times. A day's windows can be added, changed or removed from Home or Plan (ADR-0039) |
| **Gap** | Time between two windows. Implicit, and may be given a name ("Lunch"). Not the same as a rest day |
| **Suggestion / pin** | Suggestions fill windows live and are never stored. A pin is a task the user placed in a window; the app never moves it while that window is current or upcoming (ADR-0039 §§5–6) |
| **Do N of these** | The old pool: up to three equal-priced tasks pinned in a window, any N of which satisfy it. Its planned count sets the day's ceiling (ADR-0033 §3) |
| **Clear today / Away** | Clear today sets aside today's windows and unticked events; the day is still graded, or ungraded if nothing is left due. Away is a date range of days off (ADR-0040) |
| **Activity** | A spontaneous one-off logged event, tagged to ≤3 SLUs. Credit is `size × the unit's daily share` and draws from the day's shared `UNPLANNED_CAP` pool (ADR-0009 as amended by ADR-0023) |
| **Grade** | Points earned out of 100 (daily), aggregated weekly/monthly |
| **Achievement** | Generated by reaching a goal's target and completing it; feeds monthly summaries, never daily grades |
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
- Weight derivation reads **tier and order within the tier, and
  nothing else** (ADR-0041). Top, Important and Background have bases
  of 1.6, 1.0 and 0.6, adjusted from ×1.1 to ×0.9 by order, then scaled
  to 100. Not now is out of the plan: zero weight, no tasks. There is no
  floor (Henry, 2026-10-13). Satisfaction is no longer asked; old
  ratings stay in their snapshots, read-only, and the weekly
  contentment question is the only check on whether the plan works.
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
  ADR-0024 §2 existed to prevent. Unfinished work is *shown* again
  later in the same week as "Still open" (ADR-0039 §8); that is a
  display rule, it is never counted as owed, and repeating tasks stop
  carrying at the week's end. One-offs carry until done.
- **Planned work is what pays** (ADR-0023). At most `UNPLANNED_CAP`
  points of a day may come from anything the user didn't plan —
  activity credit and the special-day rating bonus share that one
  pool (scaled with the life share on a commitment day). Two routes sit outside it, deliberately, and both are your own
  plan: extra runs of planned tasks, and work done off the day it was
  planned for — commitment work (ADR-0032 §4), runs pinned to another
  day done early (ADR-0037 §3), and carried work done late (ADR-0039
  §8) — paid what that day would have paid. A carried task is never
  added to the later day's load. Those are the only uncapped routes
  above 100. Do not add a new
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
  **A rest day needs a day that had nothing due when it started**
  (ADR-0040): a day emptied on the day itself, by Clear today or a
  same-day skip, is ungraded instead, so emptying a day can never
  score 70.
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
  that share of the whole day.** By default each commitment's share is
  its time that day (event hours plus the size-hours of its tasks
  scheduled that day; pins and carried tasks never count, and an undated
  one-off counts only on the day it's ticked) divided by
  the day's working hours as they stood at the start of the day
  (ADR-0044). The total is kept between 10 and `shareLimit` (70, 70 or
  80 for one, two or three commitments; the user-set band still caps
  at 60 for one until the app scores with the share), and a user-set share
  overrides the automatic one. It is
  paid as the share of today's commitment work done, and ADR-0029's
  whole day — planned 90, unplanned 10, extra runs — is scaled into
  what it leaves. **Commitments are the band, never more**: doing only
  the commitment work scores the band, and a day with no life work due
  tops out there. Every other day is ADR-0029's day exactly
  (ADR-0032 as amended 2026-10-01). Commitment tasks have **no weight
  in the 18 units' 100** and are never in the day's load; they are paid
  from the commitment's own share. Commitment work is **scheduled, not
  counted**: it pays its scheduled-day value on its day, the same
  value uncapped on any other, and never an extra-run rate. **An early
  session is the next session done early** — it takes that session's
  value, and that session is then done on its own day — so each
  session pays once. Formula v10.
- **Windows never change a score** (ADR-0039 §12). Windows, pins,
  suggestions, refilling, carrying forward and sort order never change
  what is due or any `DayScore`. The two exceptions are a user-saved
  "Do N of these" choice and the working hours that size the
  commitment share. **Points are never used to rank suggestions.**
- **Goals never grade a day** (ADR-0042). Goal progress is a running
  total with no pace line. A points goal is a running total, never a
  percentage of the points on offer. Streak goals follow the streak
  copy rules and never count events.
- The daily surface stays checklist-simple; complexity belongs in the
  periodic strategy layer.
- **The app ships no cryptography of its own, and adding any is a
  decision with legal consequences** (ADR-0020, ADR-0046). Backups are
  plain files, so nothing in the app encrypts, which is what lets
  `app.json` declare `usesNonExemptEncryption: false` honestly. A
  bundled cipher, or encryption brought back for backups, silently
  makes that declaration false and puts the app under EAR reporting.
  If you genuinely need one, say so, write an ADR and update
  [docs/release.md](docs/release.md); do not add it quietly. The
  backup's CRC-32 is a checksum, not cryptography.

## Conventions

- Tech stack, repo layout, and tooling are decided in ADR-0001/0002 —
  follow them once accepted.
- **The app is called Life Strategy.** It was Life Strategy, became
  Glide, and was renamed back on 2026-08-13. The home-screen label is
  the shorter **"Strategy"** so iOS does not truncate it. Only
  user-facing strings moved. **Every internal `glide` identifier
  deliberately stayed** — the bundle id `com.glidelifestrategy.app`
  (changing it costs every tester their data), the Expo slug, the
  `glide://` URL scheme and the `@glide/*` package names. Do not
  "finish" the rename by
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
- **Never run `npm audit fix --force`.** After the SDK 57 upgrade
  (2026-10-13) `npm audit` reports about 83 findings. They come from
  seven advisory packages (braces, decode-uri-component, esbuild,
  node-forge, tinypool, uuid, `@vitest/mocker`), all in build and dev
  tooling: the Expo CLI, the test runner and file globbing. The count
  is high because each one is listed again under every Expo package
  that depends on it. Nothing that ships in the app is affected and
  nothing here is network-exposed in production. The esbuild advisory
  (a website can reach the dev server) matters only while
  `npm run mobile` runs on an untrusted network. `--force` would pull
  mismatched versions out from under the Expo SDK; take fixes through
  Expo SDK patch releases (`npx expo install expo@latest --fix`).
