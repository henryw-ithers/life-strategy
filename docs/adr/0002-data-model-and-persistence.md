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

   > **Amendment (2026-08-19): the review is a checkpoint, not a
   > ceremony.**
   >
   > This decision specified five stages in sequence: run the
   > diagnostic, review new weights beside old, settle every goal,
   > adjust the task lineup, then see the monthly grade. Built that way
   > it is a wizard, and a wizard is the wrong shape for the moment it
   > serves — twelve times a year, a person opening this wants to
   > re-gauge how they feel and how they want to use the app, not clear
   > a five-step queue of bookkeeping.
   >
   > What ships instead is a **checkpoint on Portfolio**: the month's
   > grade, how many days stand behind it, and what the month actually
   > held (notes, photos, goals reached), above the entry that re-runs
   > the diagnostic. Every adjustment the five stages listed still
   > exists — re-ranking is the list on that same screen, goal statuses
   > live on the goal, the task lineup lives on Tasks — but they are
   > reached rather than marched through. The checkpoint is a place you
   > look, and it hands you back to wherever the change belongs.
   >
   > **What this keeps:** the prompt to revisit monthly, the diagnostic
   > as the thing that opens it, and "everything remains editable at any
   > time — the review is the prompted ritual, not a lock", which this
   > shape honours more literally than a wizard would.
   >
   > **What it gives up:** the guarantee that a user who completes the
   > review has consciously touched every goal. Goals can now go stale
   > without a forced prompt. If that proves to matter, the fix is a
   > nudge inside the checkpoint naming the stale ones, not a return to
   > the sequence.
   >
   > **Also fixed here:** the diagnostic had no entry point outside an
   > empty state, so the loop this decision describes could not be run a
   > second time at all. `loadMonthGrade` had been written and called by
   > nothing; the checkpoint is its first caller.
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

Seeded with the 6 SLAs / 18 SLUs from vision.md.

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
  (nullable), title, times_per_week (1–7, 7 = daily; 0 = once every
  two weeks; evolved from `daily|weekly` → `interval_days` →
  frequency on 2026-07-17),
  point_value, rank_in_unit (per ADR-0003's ranking flow), active,
  archived_at
- **`task_completion`** — id, task_id, local_date, completed_at,
  points_earned

`points_earned` is **denormalized at completion time**: editing a
task's point value affects the future only; past days never restate.
(A partial-credit fraction column may be added if ADR-0004 adopts
partial completion.)

### Grades and tracking

- **`day_grade`** — local_date (PK), kind (`normal|rest|special`),
  points_earned, points_possible, satisfaction_rating (1–10, special
  days), title, flagged (memory flag), finalized_at (stamped when the
  day's week is two weeks old — ADR-0004's week-aligned edit window;
  since 2026-07-30 this **marks** a settled day rather than locking it,
  and every past day stays editable) — kind/title/rating semantics per
  ADR-0004.
- **`journal_entry`** — id, local_date, text, created_at. Multiple
  entries per day; ~~**append-only**~~ — see the amendment below.
- **`photo`** — id, local_date, file_uri (app-managed on-device copy),
  caption, created_at. Included in encrypted backup as a separately
  toggleable (and much larger) payload.

  > **Amended 2026-08-13: `file_uri` is app-relative** (`photos/<id>
  > .<ext>`), resolved against `documentDirectory` at read time. It
  > previously stored the absolute URI, which **loses every photo on
  > an app update**: iOS containers live at
  > `…/Containers/Data/Application/<UUID>/Documents/` and that UUID is
  > reassigned on reinstall and can change across updates, so the
  > stored path points at a directory that no longer exists. Reads
  > keep only the tail after `photos/`, so rows written before this
  > heal themselves without a data migration guessing at a stale
  > container path. **Never store an absolute container path.**

Journal entries, photos, and flags stay addable after finalization:
**grades finalize; memories don't.** An entry or photo added after the
day's 3-day edit window is displayed with a **retroactive marker**
("added later") — derived from `created_at` vs. the window, no extra
column. What you recorded at the time stays distinguishable from what
you added from memory.

> **Amended 2026-08-13 (journal entries are editable and deletable):**
> the append-only rule above is **retired**. Notes can be rewritten in
> place and removed, and photos can be removed; both are reached by
> pressing and holding the item in the day's record.
>
> Append-only was there to keep the log a faithful record. In practice
> it protected nothing and cost something real: there was no editing
> affordance at all, so a typo was permanent and the day's record could
> only grow. Fidelity that cannot be corrected reads as a bug, and the
> log is only trustworthy if the person who wrote it recognises it.
>
> Deletes are **hard deletes**, not the soft deletes used elsewhere in
> this ADR. A journal entry has no downstream reader — see the ADR
> index's "nothing reads the life log back" — so there is no
> referential integrity to preserve and nothing a tombstone would
> serve. Removing a photo also unlinks its file: the row is the only
> record of where the app-managed copy lives.
>
> Neither is gated on the edit window. Grades finalize; memories don't,
> and a note touches no score.
>
> **The retroactive marker above is still unbuilt**, and this makes it
> slightly less meaningful — an edited entry keeps its original
> `created_at`, so "added later" will describe when a note was first
> written, not when it was last changed. Worth deciding when the
> look-back views that consume the marker actually get built.
- **`activity`** — id, local_date, title, note, size
  (`quick|normal|big`, nullable = journal-only), flagged (memory
  flag), created_at (ADR-0009)
- **`activity_tag`** — activity_id, unit_id, points_credited
  (denormalized at log time; ≤ 3 tags per activity) (ADR-0009)
- **`achievement`** — id, goal_id (**nullable since 2026-08-18**),
  milestone_id (nullable), title_snapshot, achieved_at
- **`contentment_checkin`** — id, week_start_date, score (1–10)
- **`calibration_suggestion`** — id, insight_text, proposed_change,
  status (`proposed|accepted|dismissed`), created_at, resolved_at —
  dismissed suggestions never re-surface automatically (ADR-0008)
- **`app_setting`** — key (PK), value

`day_grade` is a materialized cache for fast history rendering and is
always recomputable from completions; finality semantics (when
`finalized_at` gets stamped, grace windows) are ADR-0004's decision.
`achievement.title_snapshot` copies the goal title at completion so
later goal edits don't rewrite trophy history.

**`achievement.goal_id` is nullable (migration 0010, 2026-08-18)**
because goals became deletable ([ADR-0007](0007-goal-lifecycle.md), as
amended). Deleting a goal nulls this and keeps the achievement: the
snapshot above is exactly what makes that survivable, and a deleted
goal is the limiting case of the "later goal edits" it was written
for. `milestone_id` behaves the same way when a rung is deleted.

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

> **Amended 2026-07-26 (manual local export; passphrase is mandatory,
> not optional):** shipping the round-trip without waiting on ADR-0012
> changed one thing above. The keychain-plus-*optional*-passphrase
> model assumes a cloud account can restore the key to a replacement
> device. Without that account, a key held only in this device's
> keychain dies with this device — which is the exact case a backup
> exists for. It would look like a backup and be a brick. **The
> passphrase is therefore the only key**, derived with Argon2id; no
> key is persisted anywhere. `expo-secure-store` is not used and is
> not a dependency. When ADR-0012 lands and an account can hold a
> wrapped key, the optional-passphrase model can return as an
> *addition* — the envelope already carries its KDF parameters, so
> that is a format-compatible change.
>
> Also settled, all within this ADR's scope rather than ADR-0012's:
>
> - **Transport is the share sheet**, not a server. Export writes one
>   `.lsbk` file and hands it to `expo-sharing`; the user puts it in
>   Files, iCloud Drive, or anywhere else. No provider, no account, no
>   retention policy — ADR-0012 stays parked and untouched.
> - **Cipher and library:** ~~AES-256-GCM from `@noble/ciphers`,
>   Argon2id from `@noble/hashes`. Both pure JS. The native alternative
>   (`react-native-quick-crypto`) is faster but needs a development
>   build, which would end the Expo Go workflow the SDK 54 pin exists
>   to protect (ADR-0001). Speed was not worth that.~~
>   **Superseded by [ADR-0020](0020-backup-cryptography-and-export-exemption.md):**
>   AES-256-GCM from CryptoKit and PBKDF2-HMAC-SHA256 from
>   CommonCrypto, via a local native module. Shipping only Apple's
>   cryptographic frameworks is what makes the app export-exempt;
>   bundling any JavaScript cipher puts it back under EAR reporting.
>   The reasoning above was sound on its own terms and simply did not
>   price export compliance, which was not visible until the first
>   submission. Backup consequently does not work in Expo Go.
> - **KDF parameters travel in the file header**, not in a constant, so
>   they can be raised later without stranding existing backups. The
>   defaults were OWASP's Argon2id minimum (19 MiB, t=2, p=1);
>   [ADR-0020](0020-backup-cryptography-and-export-exemption.md) makes
>   them OWASP's PBKDF2-HMAC-SHA256 minimum (600,000 iterations). This
>   header-carries-its-own-parameters design is what made that swap
>   survivable, and it still wants re-benchmarking on the test device.
> - **Database only.** Photos stay excluded per the `photo` note above,
>   so a restore onto a fresh device leaves `file_uri` rows pointing at
>   files that do not exist; the day view renders those as a
>   "photo not in this backup" placeholder. The header reserves room to
>   add the payload later.
> - **The image comes from `sqlite.serializeAsync()`**, SQLite's own
>   serialize — consistent with the live connection, with no file copy
>   to race and no `-wal` sidecar to miss. Restore writes the bytes
>   back, deletes the stale `-wal`/`-shm`, and requires an app
>   relaunch, since `db` is a module-level singleton the screens
>   already hold.
> - **Restore is ordered so failure never costs data:** authenticate
>   before touching disk, refuse a schema newer than the running build
>   (the header carries the migration count), and copy the live
>   database to `.pre-restore` before replacing it.
>
> *(`packages/backup` — pure, tested, no React Native imports per
> ADR-0001; device half in `apps/mobile/src/backup/backupFile.ts`; UI
> at `apps/mobile/src/app/backup.tsx`.)*

## Consequences

- **Easier:** history is immutable by construction — no
  recompute-the-past bugs; taxonomy edits are fearless; the scoring
  engine (ADR-0003) reads ratings and writes `unit_weight` rows
  through a clean seam; sync can be added without a schema rewrite.
  *(Narrowed 2026-07-30: **snapshots and their derived weights** are
  still immutable, which is what the fearless-taxonomy-edit property
  rests on. Day records are not — ADR-0004 dropped the edit horizon, so
  weekly and monthly grades can move when an old day is corrected.)*
- **Harder:** denormalization means "fix history" requires explicit
  migration tooling if a real bug ever corrupts grades; materialized
  weights add a review-step UI obligation (the override reset flow);
  UUIDs and soft deletes are mild storage/query overhead on-device.
- **Revisit when:** partial credit lands (ADR-0004 → completion
  fraction column); live sync becomes real (conflict policy);
  templates (future) need import/export of goal/task bundles.

## Action items

1. [x] Define the Drizzle schema for the tables above; generate
       migration 0001; seed the 6×18 taxonomy. (Shipped:
       `apps/mobile/src/db/schema.ts`, `db/seed.ts`, migrations in
       `apps/mobile/drizzle/`.)
2. [x] Write the snapshot flow as a transaction: ratings →
       scoring-engine call → `unit_weight` rows. (Shipped:
       `saveDiagnostic()` in `apps/mobile/src/db/diagnostic.ts`.)
3. [~] Prove backup round-trip on device: export → encrypt → decrypt →
       restore. (Built and unit-tested — `packages/backup` covers seal,
       open, tamper detection, and format rejection; the device half
       and UI are wired. **Still unproven on device**, which is the
       half of this item that matters: Argon2id timing in Hermes, the
       share sheet, `File.pickFileAsync`, and the relaunch-after-
       restore path have never run on hardware.)
4. [x] Resolve ADR-0003 (scoring formula) — `unit_weight.derived` and
       `formula_version` are waiting on it. (Accepted; the formula has
       since reached v3 via the ADR-0004 amendments.)
