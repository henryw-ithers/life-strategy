# Building the redesign

Where the windows redesign stands, phase by phase, and what the next
phase has to do. The decisions are in ADRs 0039–0046, the
[redesign spec](redesign-spec.md) and
[windows-and-pins.md](windows-and-pins.md); this file only tracks the
build. Kept current at the end of each phase.

Last updated 2026-10-17, during Phase 5a.

## Phases

| Phase | What | State |
|---|---|---|
| D | Design: research brief, spec, prototype | Done |
| 1 | ADRs 0039–0045 | Accepted 2026-10-13 |
| 0 | Expo SDK 57 and the EAS development build | Merged, PR #2 |
| 2 | Fixes that stand under any design | Merged, PR #3 |
| 3a | The Prism look and the 12-colour palette | Merged, PR #4 |
| 3b | Native tabs, nav bars and toolbar | Merged, PR #5 |
| 3c | Native sheets, menus and nav bars on pushed screens | Merged, PR #6 |
| 3d | Native menus, alerts and Undo | Merged, PR #7 |
| 3e | Liquid Glass controls and the constellation icon | Merged, PR #8 |
| 3f | Plain backups with no passphrase (ADR-0046) | Merged, PR #9 |
| 4a | Tier weights; due rules for bounds, skips and Away | Merged, PR #10 |
| 4b | Windows, pins and live suggestions | Merged, PR #11 |
| 4c | The commitment share from the day | Merged, PR #12 |
| 4d | The four goal kinds | Merged, PR #13 |
| **5a** | **Windows and schedule data: hours, edits, pins, choices, skips, Clear today, Away** | **In progress** |
| 5b | Scoring from the stored data; formula 11 | |
| 5c | Goal kinds stored; old goals erased; goal screens hidden until Phase 10 | |
| 6 | Priorities: the tiers screen; satisfaction out of the diagnostic | |
| 7 | Events: repeat ends and skipped weeks; Clear today; Away | |
| 8 | Plan: week strip and day view, hours editor, weekly pass, the New task form | |
| 9 | Home: windows, swiping between days, the one list, evening card, quiet score | |
| 10 | Life: commitments, goals (templates), units, the Priorities link | |
| 11 | Onboarding: welcome, tiers, commitments and events, hours, first tasks, the first week | |
| 12 | Hardening: test coverage, a device walk of every edge case, a code review | |

Each phase ships as one or more PRs off `main`. Every PR passes
`npm test`, `npm run typecheck` and `npm run lint` (lint at 0
warnings), and any change to scoring, grading, copy, commitments,
events or the data model goes past the `invariant-reviewer` agent.
A dev build is checked on the iPhone in light, dark and Increase
Contrast, with the phase's edge cases. The web preview should still
load after Phase 9.

Phases 6–11 each run: `/ecc:plan` citing the spec's sections, the
build, `/ecc:refactor-clean` for what the phase replaces, the
`react-reviewer` agent, the `invariant-reviewer` agent, the
`accessibility` skill, `/ecc:quality-gate`, and a walk of the matching
prototype flow on the phone. What gets removed along the way: DayGrid,
`dayGridLayout`, the List/Hours toggle, the old planning role of
`app/day/[date].tsx`, the portfolio graph, the condition UI and the
split switch. Phase 12 runs the `pr-test-analyzer` agent,
`/ecc:test-coverage`, a device walk of the whole edge-case catalogue,
`/code-review high` and `/ecc:update-docs`.

## Phase 4: what the engine gives Phase 5

Everything is in `packages/scoring`, pure and tested, and **dormant**:
nothing in the app calls it yet.

| Module | Gives |
|---|---|
| `weights.ts` | `deriveTierWeights`, `isTier`, `hasPlannedUnit` (ADR-0041) |
| `schedule.ts` | `ScheduleBounds`, `inScheduleOn`, `untilForWeeks`, `boundsError` (ADR-0040) |
| `dayLoad.ts`, `grade.ts` | bounds and skips in what's due, Away days in `computeDayLoad`, `emptiedToday` in `isRestDay` |
| `hours.ts` | `dayHours` (windows from hours, gaps, day edits and events), `dayPhase`, `dayMinute` |
| `pins.ts` | `PinRule`, `pinsOn`, `resolvePin`, `nextPinState` |
| `fill.ts` | `planDay` (pins, timed tasks, suggestions), `sortOpenTasks`, `spreadFlexibleRuns` |
| `bands.ts` | `commitmentShare`, `commitmentDayFromShare`, `shareLimit` (ADR-0044) |
| `goalKinds.ts` | `entryFor`, `goalProgress`, `goalStreak`, `goalProblem`, `clampTookAbout` (ADR-0042) |

`FORMULA_VERSION` is still 10. The note beside it in `constants.ts` says
what 11 covers.

## Phase 5 checklist

The plan's list, updated with everything decided since. Sources in
brackets. Phase 5 ships as three PRs (5a, 5b, 5c). Henry's calls on
2026-10-17:

- Tiers are seeded once from the current priority order, in thirds:
  the first 6 Top, the next 6 Important, the last 6 Background, and
  excluded units Not now, keeping the order inside each tier (5b).
- Commitment shares are all automatic. The old `commitment.band`
  setting and the relative `commitment_share` are retired (5b).
- The goal screens are hidden from 5c until Phase 10 rebuilds them,
  with no interim UI.
- Database tests run on better-sqlite3 (a dev dependency) through
  `src/db/__tests__/harness.ts`, which runs the real migrations.
- **Old placements and pools move with their screens**, not in 5a. A
  placement can say "Anytime, just today", which has no window to pin
  to, so `planned_occurrence` is copied and retired in Phase 9 and
  `pool` in Phase 8, when the screens that write them go. Until then
  5b scores "Do N of these" from `pool`.

Found in 5a: drizzle's expo-sqlite driver commits a transaction as
soon as its callback returns, so an `async` callback commits after its
first statement and an error after an `await` never rolls back. The 5a
writers use synchronous callbacks (`.run()`, `.all()`), which are
atomic on both drivers. The older writers were converted the same way
in PR #15, and a test in `db/__tests__/transactions.test.ts` fails if
an async callback comes back.

### New tables

- [x] `work_hours`: working-hour groups and named gaps, one row per
      version keyed by its first day, stored as JSON since a version
      is read and written whole (`HoursVersion`, `NamedGap`). Saving
      from a date replaces later versions [ADR-0039 §1] (5a)
- [x] `work_day_override`: one date's own ranges ("Just this week")
      [ADR-0039 §1] (5a)
- [x] `day_window_edit`: add, remove, change, **in sequence**, with
      `made_on` so an edit made on the day itself reads as
      `onTheDay` [ADR-0044 §5 clarification] (5a)
- [x] `window_placement` and `window_placement_exception`: pins, with
      **one live pin per task per day** kept by `db/pins.ts`
      [windows-and-pins.md §2] (5a)
- [x] `window_choice` and `window_choice_member`: "Do N of these"
      [ADR-0039 §6] (5a)
- [x] `schedule_skip`: skipped occurrences, one task's weeks, a whole
      commitment's weeks, with `made_on`; `skippedDatesFor` expands
      them [ADR-0040 §2] (5a)
- [x] `day_clear`: Clear today, with Undo until the day ends
      [ADR-0040 §4] (5a)
- [x] `away_range`: start, end, optional label [ADR-0040 §5] (5a)
- [ ] Goal entries: each counted tick saved when made (`GoalEntry`)
      [ADR-0042 §1] (5c)

### New columns

- [x] `task.repeat_from`, `task.repeat_until`, set by `setRepeatBounds`
      [ADR-0040 §1] (5a)
- [ ] `task_completion.actual_minutes` ("Took about…") [ADR-0042 §5]
- [x] `life_unit.tier` and `tier_order` (5a). Seeding them and the
      tier on snapshots come with the weights in 5b [ADR-0041]
- [ ] Goal kind, scope and target; goal–task links; a commitment's set
      share [ADR-0042, ADR-0044 §3]
- [ ] Each day's starting working hours stored beside its grade, so the
      commitment share can be worked out again exactly [ADR-0044 action
      item 2]

### Migrations and data

- [ ] Copy old placements and pools into the new tables; retire, don't
      drop, the old ones. **Moved:** pools in Phase 8, placements in
      Phase 9, with the screens that write them
- [ ] **Erase existing goals** with their progress, conditions,
      milestones and achievements; keep the tasks, clearing `goal_id`
      and `condition_id`; drop `goal_condition` and `milestone`
      [ADR-0042 §6]
- [ ] `plan_snapshot` records repeat bounds and skips [ADR-0040]
- [x] New tables in `db/reset.ts` (5a)
- [x] **Delete a pin for one date once its day has ended**, unless it's
      a pin until done still carrying an open task, so no "how often
      pins were kept" figure can be derived: `pruneEndedPins` at
      launch [windows-and-pins.md §7] (5a)
- [x] Archiving a task or commitment removes its pins; deleting a
      commitment removes its pins, choices and skips
      [windows-and-pins.md §2.11] (5a)
- [ ] Forward-only migrations via `npm run db:generate -w apps/mobile`;
      never hand-edit one [ADR-0002]

### Wiring the engine in

- [ ] Weights from `deriveTierWeights` [ADR-0041]
- [ ] Bounds, skips and Away into `LoadTask` and `computeDayLoad`
      (one mapper, typed with `Required<ScheduleBounds>` so nothing is
      forgotten); `boundsError` on write
- [ ] `emptiedToday` set from Clear today and same-day skips; it's
      `false` in `db/today.ts` until now [ADR-0040 §3]
- [ ] The commitment band from `commitmentShare`, replacing the user-set
      band; an undated commitment one-off counts toward the share only
      on the day it's ticked [ADR-0044 §2 clarification]
- [ ] Pass bounds and skips into `coverage` and `scheduledDateFor` in
      `db/commitmentPlan.ts` (EC-22)
- [ ] **Bump `FORMULA_VERSION` to 11** once the app scores with all of
      it at once; settled grades are never restated [constants.ts]
- [ ] **Removing a commitment's last sub-commitment must move its work
      back onto the commitment**; today it deletes the work
      [ADR-0044 §7, found in Phase 3d]

### Tests Phase 5 owes

- [ ] EC-20: the same day, scored from stored rows with two different
      sets of pins, gives the same `DayScore` [ADR-0039 §12]
- [ ] Restoring a backup from before the migration on the dev build:
      old placements copied, goals erased, past grades unchanged (EC-42)

### Commands

In order: `/ecc:plan`, `npm run db:generate -w apps/mobile`, `/ecc:tdd-workflow`,
the `silent-failure-hunter` agent, the `invariant-reviewer` agent,
`/ecc:quality-gate`.
