# ADR-0002: Data model and persistence

> **Status:** Accepted\
> **Date:** 2026-07-15 (amended 2026-07-15: monthly goal/task review)\
> **Deciders:** Henry

## Context

ADR-0001 fixed the platform: Expo + TypeScript, SQLite on device via
`expo-sqlite` with Drizzle ORM, device as source of truth, encrypted
cloud backup in v1 and possible live sync later. This ADR fixes the
entities, their relationships, and the modeling rules that keep
history stable while the user reshapes their system.

Core tension: nearly everything in this app is editable (taxonomy,
weights, tasks, point values), but grades and portfolio history must
remain **reproducible forever**. The model resolves this by making
identities immutable, denormalizing values at the moment they affect a
grade, and materializing anything a formula produces.

## Decisions on the open questions

1. **Goal-less habit tasks: goals are optional on tasks.** Every task
   requires an SLU; `goal_id` is a nullable foreign key. Habits are
   unit-level maintenance; goals add focus when a finish line exists.
   No implicit "maintain" goals, no forced artificial goals.
2. **Taxonomy customization:** SLA/SLU rows are never deleted or
   re-keyed. Rename = label update. Hide = `archived_at`. Custom units
   are ordinary rows flagged `is_custom`. All history references unit
   ids, so snapshots and grades survive any taxonomy edit.
3. **Weights are materialized per snapshot,** not derived on the fly.
   Each diagnostic snapshot stores, per unit, the `derived` weight and
   an optional `override`. Effective weight = `override ?? derived`.
   Rationale: the formula will evolve (ADR-0003 tuning, ADR-0008
   calibration), and historical grades must not silently change when
   it does. Snapshots record the `formula_version` that produced them.
4. **Override lifecycle: reset with review.** A new diagnostic
   produces fresh derived weights and empty overrides; a review step
   shows the previous snapshot's overrides beside the new
   recommendations so the user consciously re-applies any they still
   want. The diagnostic stays authoritative.
5. **The monthly review is one ritual, opening with the diagnostic**
   (amended per ADR-0005). Monthly, the app prompts: run the full
   diagnostic, review new derived weights beside old overrides
   (decision 4's reset-with-review), settle goal statuses (complete /
   pause / revise / abandon), adjust the task lineup, and see the
   monthly grade and new achievements. Diagnostics never delete goals
   or tasks — everything carries over by default, with diff-driven
   prompts only where weights shifted. Everything also remains
   editable at any time — the review is the prompted ritual, not a
   lock.
6. **Per-SLA rollups are computed, never stored** — a query over child
   units (weight-weighted mean). Whether/how they're displayed is
   ADR-0005's call.
7. **Persistence:** SQLite + Drizzle with forward-only migrations, per
   ADR-0001.

## Schema

All tables use UUID primary keys, `created_at`/`updated_at`
timestamps (ISO-8601 UTC), and soft deletes (`archived_at`) — chosen
now so a future sync layer (Turso/PowerSync) needs no re-keying.
Calendar bucketing uses the user's **local date** stored as `TEXT
'YYYY-MM-DD'`; timezone edge cases are ADR-0004's problem.

### Taxonomy

- **`life_area`** — id, name, sort_order, archived_at
- **`life_unit`** — id, area_id → life_area, name, sort_order,
  is_custom, archived_at

Seeded with the 6 SLAs / 16 SLUs from vision.md.

### Diagnostic

- **`snapshot`** — id, taken_at, formula_version, note
- **`rating`** — snapshot_id, unit_id, importance (1–10),
  satisfaction (1–10), effort_points (trailing-28-day effort frozen at
  snapshot time, ADR-0005); PK (snapshot_id, unit_id)
- **`unit_weight`** — snapshot_id, unit_id, derived, override
  (nullable); PK (snapshot_id, unit_id)

The "current" weights are simply the latest snapshot's rows.

### Goals

- **`goal`** — id, unit_id → life_unit, title, description,
  target_value (nullable), status
  (`active|paused|revised|abandoned|completed`), status_changed_at,
  linked_from_goal_id (nullable self-reference) + link_kind
  (`revision|follow_up`, per ADR-0007)
- **`milestone`** — id, goal_id → goal, title, sort_order, status
  (`pending|current|completed`)

State-transition rules and milestone semantics are ADR-0007's scope;
the model just gives them columns to land in.

### Tasks and completions

- **`task`** — id, unit_id → life_unit (required), goal_id → goal
  (nullable), title, cadence (`daily|weekly`), point_value,
  rank_in_unit (per ADR-0003's ranking flow), active, archived_at
- **`task_completion`** — id, task_id, local_date, completed_at,
  points_earned

`points_earned` is **denormalized at completion time**: editing a
task's point value affects the future only; past days never restate.
(A partial-credit fraction column may be added if ADR-0004 adopts
partial completion.)

### Grades and tracking

- **`day_grade`** — local_date (PK), kind (`normal|rest|special`),
  points_earned, points_possible, satisfaction_rating (1–10, special
  days), title, flagged (memory flag), finalized_at (nullable) —
  kind/title/rating semantics per ADR-0004.
- **`journal_entry`** — id, local_date, text, created_at. Multiple
  entries per day; **append-only** — adding a note never overwrites or
  deletes an earlier one.
- **`photo`** — id, local_date, file_uri (app-managed on-device copy),
  caption, created_at. Included in encrypted backup as a separately
  toggleable (and much larger) payload.

Journal entries, photos, and flags stay addable after finalization:
**grades finalize; memories don't.** An entry or photo added after the
day's 3-day edit window is displayed with a **retroactive marker**
("added later") — derived from `created_at` vs. the window, no extra
column. What you recorded at the time stays distinguishable from what
you added from memory.
- **`activity`** — id, local_date, title, note, size
  (`quick|normal|big`, nullable = journal-only), flagged (memory
  flag), created_at (ADR-0009)
- **`activity_tag`** — activity_id, unit_id, points_credited
  (denormalized at log time; ≤ 3 tags per activity) (ADR-0009)
- **`achievement`** — id, goal_id, milestone_id (nullable),
  title_snapshot, achieved_at
- **`contentment_checkin`** — id, week_start_date, score (1–10)
- **`app_setting`** — key (PK), value

`day_grade` is a materialized cache for fast history rendering and is
always recomputable from completions; finality semantics (when
`finalized_at` gets stamped, grace windows) are ADR-0004's decision.
`achievement.title_snapshot` copies the goal title at completion so
later goal edits don't rewrite trophy history.

## Backup (v1)

- Whole-database export, encrypted **client-side** (AES-256-GCM via a
  vetted library) before leaving the device.
- Key held in the platform keychain (`expo-secure-store`); an optional
  user passphrase derives a recovery key so a lost phone doesn't mean
  lost data.
- Ciphertext uploaded to commodity object storage; the server never
  holds a decryption key. Restore = download + decrypt + replace.
- Live multi-device sync remains deferred; the UUID/soft-delete/
  updated_at conventions above are the pre-payment for it.

## Consequences

- **Easier:** history is immutable by construction — no
  recompute-the-past bugs; taxonomy edits are fearless; the scoring
  engine (ADR-0003) reads ratings and writes `unit_weight` rows
  through a clean seam; sync can be added without a schema rewrite.
- **Harder:** denormalization means "fix history" requires explicit
  migration tooling if a real bug ever corrupts grades; materialized
  weights add a review-step UI obligation (the override reset flow);
  UUIDs and soft deletes are mild storage/query overhead on-device.
- **Revisit when:** partial credit lands (ADR-0004 → completion
  fraction column); live sync becomes real (conflict policy);
  templates (future) need import/export of goal/task bundles.

## Action items

1. [ ] Define the Drizzle schema for the tables above; generate
       migration 0001; seed the 6×16 taxonomy.
2. [ ] Write the snapshot flow as a transaction: ratings →
       scoring-engine call → `unit_weight` rows.
3. [ ] Prove backup round-trip on device: export → encrypt → decrypt →
       restore.
4. [ ] Resolve ADR-0003 (scoring formula) — `unit_weight.derived` and
       `formula_version` are waiting on it.
