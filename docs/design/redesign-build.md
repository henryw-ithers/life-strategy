# Building the redesign

Where the windows redesign stands, phase by phase, and what the next
phase has to do. The decisions are in ADRs 0039–0046, the
[redesign spec](redesign-spec.md) and
[windows-and-pins.md](windows-and-pins.md); this file only tracks the
build. Kept current at the end of each phase.

Last updated 2026-10-21, during Phase 11.

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
| 5a | Windows and schedule data: hours, edits, pins, choices, skips, Clear today, Away | Merged, PR #14 |
| 5a+ | Every transaction in `src/db` atomic | Merged, PRs #15, #16 |
| 5b | Scoring from the stored data; formula 11 | Merged, PR #17 |
| 5b+ | One completion per tap; deleting a commitment in one read | Merged, PR #18 |
| 5c | Goal kinds stored; old goals erased; goal screens hidden until Phase 10 | Merged, PR #19 |
| 6 | Priorities: the tiers screen; satisfaction out of the diagnostic | Merged, PR #20 |
| 7 | Events: repeat ends and skipped weeks; Clear today; Away | Merged, PR #21 |
| 8 | Plan: week strip and day view, hours editor, weekly pass, the New task form | Merged, PRs #22–#25 |
| 9 | Home: windows, swiping between days, the one list, evening card, quiet score | Merged, PRs #26, #27 |
| 10 | Life: rows, unit and commitment screens, achievements (ADR-0047) | Merged, PRs #28, #29, #31 |
| **11** | **Onboarding: welcome, tiers, commitments and events, hours, first tasks, the first week** | **In progress** |
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

## Phase 11: Onboarding

Built from ADR-0045 and spec §5.11, as one PR rather than the three
planned (the steps share one screen and one load).

`app/onboarding.tsx` is seven steps: welcome (with the privacy line),
Priorities, commitments, working hours, a few tasks, your first week,
and the daily reminder (with the Support resources line). The step
order, where an old stored step resumes, and which steps can be skipped
are `lib/onboardingFlow.ts`. Priorities is required only until tiers
exist; a re-run from Settings ("Run setup again") opens at Priorities
and deletes nothing. Finishing goes to Home, not Life.

- **Priorities and Hours stay their own screens**, pushed from the
  flow. Coming back, a new snapshot or changed hours moves it on;
  backing out stays on the step. `hours?setup=1`, sent when no hours are set yet, saves from today with
  no "Just this week" question, and `template=` fills in hours not yet
  set (`draftFrom`'s fallback).
- **Commitments step** (`CommitmentsStep`): Student, 9–5 job, Shift
  work or Nothing fixed (`lib/onboardingTemplates.ts`), then up to three
  commitments with their events, weekly for 12 weeks by default. The
  choice only fills in hours and, for shift work, turns on
  `events_default_once`; it creates nothing. The sub-commitments switch
  is left out here (`askSplit={false}`).
- **A few tasks** (`StarterTasksStep`, `lib/starterTasks.ts`): the
  library's three best-ranked tasks for each Top unit, tap to add, a
  starter you have already ticked, and Add your own.
- **Your first week** (`FirstWeekStep`): Plan's week strip and day view,
  live, with the ADR's line about the score.
- **The score sheet explains the score on its first open**
  (`scoreExplained`), from the engine's constants.
- Removed: the method, weights and rhythm screens, `/diagnostic`,
  `AreaInfoSheet` and `PermissionPrescreen` (the reminder ask is
  `askForNudge`/`declineNudge` in `notifications/dailyNudge.ts`).

Template hours (free time, with events cut out of it): Student weekdays
8–18 and weekends 10–16; 9–5 job weekdays 7–21 and weekends 9–17; Shift
work every day 8–20; Nothing fixed every day 9–17.

Left open:

- **No suggested sort** (Henry, 2026-10-21; ADR-0041 §1 and ADR-0045
  step 2 amended): a first run starts every unit in an Unsorted
  section above Top (`board.ts`), shown only while it holds a unit. A
  tap on an unsorted unit asks which tier, and Done waits until every
  unit has one (`sortedPlacement`).
- **Step 7 asks for the existing daily reminder**, not a morning
  summary: the only notification is ADR-0010's nudge. A summary would
  be new notification content.
- **The hours preview shows today**, not the whole week.
- **The three Relationships units have no library tasks**, so as Top
  units they show only Add your own.
- `content/areas.ts` (from `docs/content/areas.md`) is now read by
  nothing; Phase 12's dead-code pass, with the goal templates.
- On the web preview Priorities can't be saved, so the steps after it
  are walked on the phone.

## Phase 10: Life

Three PRs: **10a** Life as rows and a unit screen, **10b** the
commitment screen and its share, **10c** achievements, which replaced
goals (ADR-0047, accepted 2026-10-21; it supersedes ADR-0042, so goals
from templates were never built).

Built in 10a: Life as a list of rows (spec §5.4): commitments, then
units by tier in your order, each with its task count and a bar of its
share of the time spent in the last 4 weeks (`loadWorkShares`, shared
with the weekly pass), drawn against the largest share and never a
target. A unit's screen (spec §5.4.2) has its tier and weight, with the
recommended weight beside one you set (AGENTS.md), its tasks to
reorder, its events, Need ideas? and what it covers. Removed:
`FirstRunCard`, `CoverageBar`, and the fold-open unit rows.

Built in 10b: a commitment's Share of your day (spec §5.5): automatic,
or a share you set between 10% and the limit, with a typical day's
automatic share beside it, never above the limit. Adding the first
sub-commitment splits the commitment, moving its work into General, so
the sub-commitments switch is gone (ADR-0044 §7).

Built in 10c (spec §5.6): goals are gone, and the app awards
achievements itself. The engine's series, ranks and runs are
`achievements.ts` in `@glide/scoring` (it replaced `goals.ts` and
`goalKinds.ts`, keeping `clampTookAbout` and `tickMinutes`). What each
series stands at is `db/achievementRules.ts`, pure, from completions,
tasks, units, stored grades, activities, Away and skips (the every-day
streak reuses the old streak goal's reading of skips and days off).
`db/achievements.ts` awards new ranks (insert-only) and serves the
screens. Migrations 0027 (drops `goal`, `goal_task`, `goal_entry` and
the old `achievement`) and 0028 (creates the new `achievement`, unique
on series, subject and rank). Screens: Life → Achievements
(`goals/achievements.tsx`), a rank and a flame on Life's unit rows and
the unit screen, a celebration card on Home (`useCelebration`), and
the month review's list. `setTookAbout` moved to `completions.ts`;
suggestions no longer rank by goal (`goalLinked` and "For your goal"
are gone).

Left open after 10c:

- **Nothing writes "Took about…" yet** (the long-press menu, spec
  §5.7). Hours count each tick's size or event length until it lands.
- **The ☆ day flag has no writer either**, so "Worth remembering"
  counts flagged activities until it does.
- **The goal templates in `content/library.ts`** are dead data: nothing
  reads `goals` now. Its source is `docs/content/library.md` and its
  generator; removing them is Phase 12's dead-code pass.
- **Migration 0027 drops `goal` before `goal_entry` and `goal_task`**,
  as drizzle-kit generated it. With foreign keys on and goal rows
  present that order would fail, but the app's connection doesn't turn
  them on and nobody has goal rows.
- **Plan-week ranks stay off Home's celebration card.** ADR-0047 §6
  puts the card on Home without excluding a series, but AGENTS.md keeps
  the plan-week exception off Home; the invariant won. Worth a line in
  the ADR if Henry wants it the other way.
- **A day with no stored grade counts as nothing** for the score series,
  as `periodDays` does. A day that asked nothing but was never opened
  past the edit window has no row, so it breaks a great-day run. An
  automatic rest day scores 70, so it breaks one too.
- Ranks are awarded on Home and Life coming into view and after a tick.
  A rank earned only by a week ending waits for the next open, as the
  ADR says.

Open for an ADR (invariant review): a share you set is scaled with the
others on a day another commitment has work too, as ADR-0044 §3's
"within the same limits" allows. Whether a set share should hold while
the others shrink is undecided; the sheet says they're scaled to fit.

Henry, 2026-10-21: he'll stop for a phone walk before Phase 12.

## Phase 9: Home

Two PRs: **9a** Home's today on windows, and **9b** other days (swipe
between days, a future day as Plan's compact day view, the Today
button) with the quiet score.

Built in 9a (`HomeToday`, `HomeWindow`, `homeDay.ts`,
`MoveToWindowSheet`): today's windows in time order with events, named
gaps and timed tasks between them; the open window with its time left;
closed windows as done or task counts; tick, swap (shown, not saved),
Move to… another window; Show all, Add from open, Next up, That's this
window and Pull in another; Other open tasks in three groups, and the
one list with a remembered sort once no window is left; the weekly pass
card (Sunday 6 pm to Monday's first window, Not now for the week); the
evening card; Window in the + menu; Clear today, Day type and Plan this
week in the ⋯ menu. On today a row shows its size, not its points. A
past day shows only what was done, and "Add something you did that
day".

Removed in 9a: the List/Hours toggle and its setting, DayGrid and
`dayGridLayout`, `SectionedChecklist` and `checklistLayout`,
`TailSection`, `MoveTaskSheet`, `arrangeDay`, the part-of-day carry
helpers, `placements.ts`, `reorderDayTasks`, `setTaskPartOfDay` and
`planned_occurrence` (migration 0026). `task.day_order` stays, unread.

Left for 9b: swiping between days, a future day on Home, the Today
button, the score's breakdown, and the ☆ flag on the evening card
(there's no day flag writer yet). The web preview can't reach Home (onboarding needs Priorities,
which saves on the phone only), so 9a is checked by tests and reviews
until the phone walk.

Built in 9b: swiping between days on Home and a Today button (spec
§5.2); a future day, up to four weeks ahead, shown in place as Plan's
day view (`PlanDayView`, now shared with the Plan tab); the week strip
and Plan ahead off Home (the date still opens the month); and tapping
the day's number for how it adds up (`ScoreSheet`).

**The score is just the number** (Henry, 2026-10-21): no ring, and no
Settings → Home → Show score. Spec §5.1 had both; tapping the number
for the breakdown stays. The spec should say so.

Still open after 9b: the ☆ flag on the evening card, which needs a
writer for `day_grade.flagged`; and a phone walk of Phases 8 and 9,
since Home can't be reached in the web preview.

## Phase 8: Plan

Four PRs, each off `main`:

| PR | What | Spec |
|---|---|---|
| 8a | The day as Plan shows it, the week strip, copying last week's events; "Do N of these" from `window_choice`, `pool` dropped | §§3.2, 3.5, 4.3–4.4 |
| 8b | Plan tab: week strip and day view, window edits, Day type, the hours editor; the unit list moves to Life | §§5.3, 5.3.1 |
| 8c | The weekly pass, with "Still happy with your tiers?" | §5.3.2 |
| 8d | The New task form: unit from the title, Not now greyed out; shift work's one-time events | §5.7 |

Henry's calls on 2026-10-20:

- **The unit list moves to the Life tab now** (8b), not to a stopgap
  screen, so Plan's tab is only the week. Phase 10 still rebuilds Life.
- **"Do N of these" lives on Plan only until Phase 9.** Dropping `pool`
  took it off Home, whose screens Phase 9 rebuilds.

Built in 8a: `db/dayPlan.ts` (`loadDayPlan`, `loadWeek`),
`db/dayPlanRules.ts`, `copyLastWeeksEvents`, and `planDay`'s
`plannedLater` / `plannedAhead`: work planned for a later day is never
suggested, shows where pinned, and is listed to do early. A future
day's flexible runs are spread over its week's roomiest days. A
cleared, Away or day-off day sets its windows aside. Migration 0025
drops `pool` and `pool_member`.

Decided while building 8a:

- **The week strip runs Sunday to Saturday**, the app's week (ADR-0004
  §1), though spec §5.3 draws Monday to Sunday. The spec should be
  corrected, or Henry should say otherwise.
- **Copying last week's events onto today** changes today's commitment
  share and can end a rest day, exactly as adding that event by hand
  does (invariant review). Copies never land on a past day. Open: copy
  only from tomorrow, if Henry prefers today's band never to move.
- A tick whose time can't be placed (logged afterwards, or unreadable)
  is still done: it sits in no window and is never suggested again.

Built in 8b: the Plan tab as the week (`app/(tabs)/plan/index.tsx`,
`PlanWeekStrip`, `WindowCard`, `WindowTimesSheet`, `AddFromOpenSheet`,
`ChoiceSheet`, `dayView.ts`), the working-hours editor (`app/hours.tsx`,
`hoursDraft.ts`), and Life holding the units with Priorities and
commitments. Removed: `app/day/[date].tsx` (a future day opens on
Plan), `CommitmentTasks`, `planLoadHours`. The + menu gains Window on
Plan; Home gets it in Phase 9.

Decided while building 8b:

- **"This week and after" saves from today**, not the week's Sunday, so
  earlier days keep the hours they had (EC-15, invariant review).
- **Only the latest load lands on Plan**, and the day on screen is
  always the one chosen: writes wait until it has loaded (React review).
- Window sheets are named by the window's start, never its place in the
  list, so a reload can't move an open sheet to another window.
- Open: Day type can be set on any past day from Plan's strip, as on
  Home's calendar. Limit it to the edit window if Henry wants.
- Still to check on the phone: the window cards with real tasks, the
  native menus and sheets, and VoiceOver on the strip and the stepper.
  The web preview can't save Priorities, so it shows no tasks.

Built in 8c: the weekly pass (`app/weekly-pass.tsx`, a full-screen
sheet from Plan's ⋯ menu), `db/weeklyPass.ts`, `db/weeklyPassRules.ts`
and `workShares` in the engine.

Decided while building 8c, and open for Henry:

- **Shares are measured in time, not points** (open): a tick counts
  its size times how much was done, an event its length, and a sized
  activity is split across its tags. Points would only show the tiers
  back. A commitment is one row beside the units. ADR-0041 §5 names no
  measure, so this wants a short amendment before Life's bars (Phase
  10) use it too (invariant review).
- Turning an event off for the week is a skipped run on each of its
  days left, the same path as Home's Skip this one, so turning today's
  off on the day empties it as ADR-0040 §3 says.
- Offering the tiers step marks the month, so finishing at once still
  uses it up; Priorities is always on Life.

Left for later: offering the pass on Home from Sunday 6 pm until the
week's first window (ADR-0039 §11) comes with Home in Phase 9. "Goals
that moved" in Last week went with goals (ADR-0047).

Built in 8d: the New task form's unit guess (`guessUnit`: a
commitment named in the title as a whole word, then the keyword match,
never a Not now unit), Not now units greyed in the unit picker with
"Move it up in Priorities to add tasks", and new events starting
one-time when Settings → Your days says so (`events_default_once`,
which onboarding's shift-work template sets in Phase 11).

Left as it was in 8d: the form keeps Size and part of day where they
are. Spec §5.7 puts Size up top and part of day under More; moving them
changes the edit sheet too, which shares the picker, and ADR-0026 keeps
an unsized task first-class. Revisit with a phone walk.

Phase 8 is done when 8d merges. Next is Phase 9, Home: windows, swiping
between days, the one list, the evening card, the quiet score, the
weekly pass offered from Sunday 6 pm, Window in Home's + menu, "Do N of
these" back on Home, and dropping `planned_occurrence`, DayGrid,
`dayGridLayout` and the List/Hours toggle.

## Phase 7: events, skips, Clear today and Away

The data and engine came in 4a, 5a and 5b; Phase 7 is the screens and
the rules they needed. Henry's calls on 2026-10-20, written into
ADR-0040 as clarifications:

- **This event only** skips that date and adds a one-off event with the
  new details. From Plan or a commitment, "this event" is the series'
  next run from today (`nextRun`).
- **Clear today on a day that began empty** stays a rest day.
- **An ended series** is archived once its end is before the edit
  window (`archiveEndedSeries`, at launch), so its ticks stay on
  settled days.
- **Bounds that take today's run away** record a same-day skip, so the
  day counts as emptied on the day.
- **Clear today** is in a ⋯ menu on Home (with Day type) and in
  Settings until Phase 9.
- **Past days keep their plan** (from the invariant review): a series
  can end yesterday at the earliest and a started series keeps its
  first day (`pastChangedBy`), so no past day can lose a run and score
  70. "This event" passes over runs already ticked, so an edit never
  reopens a paid session.

Built: `seriesRules.ts`, `seriesWrites.ts` (This event only, This and
following moving skips and goal links, repeat lengths), the event
sheet's repeat length and Skip weeks, one save path that asks the
scope (`saveEvent.ts`), a commitment's Skip a week…, Home's ⋯ menu,
Today's cleared. Undo, the Away line, holding an event to skip it, and
Settings → Time away (`app/away.tsx`).

Fixed on the way: streak goals used `isDueOn`, which reads an
unpinned every-day task as due on no particular day, so a missed day
never ended a run (5c). Streaks now count every scheduled day of an
every-day task, minus skipped days.

Copy: spec §4.7 shows "Today's cleared. Undo" and also says
"cleared" never appears. ADR-0040 §4 uses that line and bans only
"sick" and "bad day", so the ADR's copy is used; the spec's line
should be corrected.

Left for Phase 8: "Copy last week's events" (Plan's day view and the
weekly pass), and the shift-work default to one-time events.

## Phase 6: Priorities as tiers

Built from ADR-0041 and spec §5.4.1 and §8.2, with Henry's calls on
2026-10-19:

- **Overrides.** An overridden unit keeps exactly the weight you set,
  and the units you didn't override share what's left in proportion to
  their recommended weights (`applyWeightOverrides`), still adding to
  100. A set that leaves no room is refused (`overrideProblem`). Your
  own weight equal to the recommended one is no override.
- **`unitProfile`** reads tier: Top gap-closing, Important and
  Background maintenance, a unit too small for two tasks light.
- **A first run** started with every unit in Important, in the default
  order. Since Phase 11 it starts every unit Unsorted, and you sort
  them all before Done (Henry, 2026-10-21).
- **Not now** pauses a unit's tasks (archived, marked
  `paused_for_not_now`, pins dropped) and moving it back restores them.
  Priorities is the only way in or out of the plan: the Plan tab's
  "Not in my plan" toggle (`setUnitScoring`) is gone, and its unit
  panel links to Priorities instead.

What's built: `db/priorities.ts` (one snapshot per Done with each
unit's tier, recommended weight and override), the screen as one
list with the tier headers as fixed rows (`components/priorities/
board.ts`), `UnitSheet` (tier, Move up and Move down, your own weight,
for anyone who can't drag, WCAG 2.2 SC 2.5.7), and `/diagnostic` as a
redirect to Priorities. Removed: the rank-and-rate diagnostic, the
portfolio graph, the re-rank board, the interim thirds rule, `seedTiers`
and the rank derivation in scoring (`deriveWeights`, `WEIGHT_SPREAD`).

Left for later:

- **Phase 8:** the unit picker greys out a Not now unit with "Move it
  up to add tasks" in the New task form; today it leaves it out.
- **Phase 8:** "Still happy with your tiers?" in the month's first
  weekly pass.
- **Phase 10:** the effort bars on Life.
- **Phase 11:** onboarding's own Priorities step; until then it opens
  `/diagnostic`, which is Priorities.
- **Web preview:** the nav bar's Done is native only, so Priorities
  can't be saved on web; the database tests cover saving.
- **Dynamic Type:** rows keep a fixed height for the drag maths, so
  very large text is cut to one line.

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
  with no interim UI. (Phase 10c replaced goals with achievements
  instead, ADR-0047; the goal notes below are history.)
- Database tests run on better-sqlite3 (a dev dependency) through
  `src/db/__tests__/harness.ts`, which runs the real migrations.
- **Old placements and pools go with their screens**, not in 5a:
  `planned_occurrence` in Phase 9 and `pool` in Phase 8, when the
  screens that write them go. Until then 5b scores "Do N of these"
  from `pool`.

**No users yet (Henry, 2026-10-19):** "nobody is using the app right
now so migration is not a concern." Every remaining phase plans on
that:

- Nothing on a device is copied, kept or converted. An old table or
  column is **dropped** with the screen that used it, not retired, and
  its rows go with it. Phases 8 and 9 drop `pool` and
  `planned_occurrence` rather than copying them into windows.
- Schema changes still ship as generated, forward-only migrations
  (`npm run db:generate -w apps/mobile`, never hand-edited), so an
  install upgrades cleanly. When a change would need data moved first,
  the migrations drop the old table and create the new one instead.
- EC-42 (restoring a backup from before a migration) is withdrawn: no
  backup from before the redesign holds anything to keep.
- Rules about grades are not migration rules and still hold: settled
  grades are never restated.

Found in 5a: drizzle's expo-sqlite driver commits a transaction as
soon as its callback returns, so an `async` callback commits after its
first statement and an error after an `await` never rolls back. The 5a
writers use synchronous callbacks (`.run()`, `.all()`), which are
atomic on both drivers. The older writers were converted the same way
in PR #15, and a test in `db/__tests__/transactions.test.ts` fails if
an async callback comes back. PR #16 marks grades stale inside the same
transaction as each write.

Decided while building 5b:

- Until Phase 6, the old Priorities screen and the diagnostic set
  tiers from their order with the same thirds rule, so they keep
  working. Overrides written by the old re-rank were that order's rank
  weights and are cleared; manual weight overrides return with Phase 6.
- The Life tab's band sheet and per-commitment percent are gone, since
  shares are automatic. `life_unit.set_share` holds a share you set,
  for Phase 10's screen; `commitment_share` stays only as the column
  that marks a unit as a commitment.
- Setting the hours on a day itself ("This week and after" from today,
  or a day's own hours) doesn't change that day's share: the hours it
  began with are kept first.
- A commitment one-off carried past its day leaves the later day's
  band and is paid at its own day's value, as AGENTS.md has it for
  carried work.
- **Done in Phase 7:** an ended series is archived once its days have
  settled (ADR-0040 §1, clarified 2026-10-20).

Open questions from the 5b reviews, to settle before the screens that
reach them:

- **Bounds changed on the day:** settled in Phase 7. A change that
  takes today's run away records a same-day skip.
- **Clear today on a day that began empty:** settled in Phase 7. It
  stays a rest day.
- **Weight overrides** (Phase 6): weights no longer read
  `unit_weight.override`. Nothing is lost, since no screen ever wrote
  a user override, but the tiers screen needs somewhere to keep them,
  with the recommended value shown beside each.
- **A set share** (Phase 10): the screen that writes `set_share` must
  show the automatic value beside it (`DayShare.automatic`).
- **Removing the last sub-commitment** counts live siblings only. A
  commitment split with an archived sub left over from older data
  could, on unarchive, hold its own work and a sub at once. Rare; check
  when Phase 10 reworks the commitment screen.

Decided while building 5c (the plan Henry approved on 2026-10-19):

- `task.goal_id` is dropped. A goal reaches its tasks through
  `goal_task` only, and a task can count toward several goals.
- **Only active goals collect ticks.** A paused, finished or set-aside
  goal doesn't. Pausing or finishing a goal leaves its tasks exactly as
  they were: they belong to their units, and a goal only watches them
  (the old goals deactivated their tasks).
- A tick's points are its stored `points_earned`, split across the
  units it scores in by its weight there, so a goal's total and the
  days it came from agree. A part-done tick counts that part of its
  size or event length toward a time goal; "Took about…" counts as
  entered.
- Every achievement was erased with the old goals: only goals ever
  made them. An end date stays a month (ADR-0015 §4).
- A streak counts the days its task is due by its repeat bounds;
  skipped occurrences aren't yet read, which Phase 7 should add with
  the skip screens.
- Suggestions boost **linked** tasks only (`loadGoalLinkedTaskIds`,
  for `planDay` in Phase 9), not every task under a points goal.
- Deleting a commitment deletes its goals; removing its last
  sub-commitment moves that sub's goals onto it.
- A goal links only its own unit's tasks, a commitment's
  sub-commitments included (EC-41), and is never left counting
  nothing: its last chosen task, or a streak's one task, can't be
  unlinked.
- Changing how much of a task was done rewrites its tick, and the new
  tick keeps the old one's goals and "Took about…"
  (`carryGoalEntries`), whatever the goals' status or links are now.

Open from the 5c reviews (`silent-failure-hunter`,
`invariant-reviewer`; no invariant broken):

- **A paused streak goal** collects no ticks, so resuming it finds the
  run broken (Phase 10). Either let a paused streak keep collecting,
  or read a streak from completions rather than entries.
- **Activity credit and points goals:** ADR-0042 §1 says a points goal
  counts "the whole unit, always", but only task ticks reach it. No
  ADR says whether activity credit should (Phase 10).
- **Revise** is still a goal status (ADR-0007), but nothing revises
  until Phase 10's goal screen.
- **Two older issues the review found, not 5c's, fixed in PR #18:**
  two quick taps could write two ticks, and `deleteCommitment` read
  outside its transaction. A unique index on a tick's task and day was
  left until 5c's migrations landed, and is still to generate.
- The tests run with foreign keys on (better-sqlite3); the app's
  expo-sqlite connection doesn't turn them on, so a device can hold an
  orphan the tests would refuse.
- The goal half of the content library (`content/library.ts`) stays
  until Phase 10 rewrites it as templates; the Ideas sheet shows its
  tasks only.
- **The erase is two generated migrations, no hand-written SQL.**
  0022 only drops (`goal`, `goal_condition`, `goal_progress`,
  `milestone`, `achievement`, and `task.goal_id`/`condition_id`);
  0023 only creates (the new `goal`, `goal_task`, `goal_entry`,
  `achievement`, and `task_completion.actual_minutes`). Splitting
  them keeps drizzle-kit from asking whether a new table renames an
  old one, which it can only ask in a terminal. Dropping the tables is
  what erases the old goals. Checked on a database holding old goals,
  conditions, milestones, progress and achievements, migrated the way
  drizzle does (one transaction, foreign keys off): the goals and
  achievements go, tasks and ticks stay, nothing is left dangling.

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
- [x] Goal entries: each counted tick saved when made (`goal_entry`),
      in the tick's own transaction and removed with it [ADR-0042 §1]
      (5c)

### New columns

- [x] `task.repeat_from`, `task.repeat_until`, set by `setRepeatBounds`
      [ADR-0040 §1] (5a)
- [x] `task_completion.actual_minutes` ("Took about…", `setTookAbout`)
      [ADR-0042 §5] (5c)
- [x] `life_unit.tier` and `tier_order` (5a). Seeding them and the
      tier on snapshots come with the weights in 5b [ADR-0041]
- [x] A commitment's set share (`life_unit.set_share`) [ADR-0044 §3]
      (5b)
- [x] Goal kind, scope and target (`goal.kind`, `unit_id`,
      `target_value`, `counts_whole_unit`); goal–task links
      (`goal_task`) [ADR-0042] (5c)
- [x] Each day's starting working hours stored beside its grade
      (`day_grade.starting_hours`), so the commitment share can be
      worked out again exactly [ADR-0044 action item 2] (5b)

### Migrations and data

- [ ] Drop old placements and pools with the screens that write them:
      pools in Phase 8 (done in 8a, migration 0025), placements in
      Phase 9. Nothing is copied (no users yet, 2026-10-19)
- [x] **Erase existing goals** with their progress, conditions,
      milestones and achievements; keep the tasks, dropping `goal_id`
      and `condition_id`; drop `goal_condition`, `milestone` and
      `goal_progress` [ADR-0042 §6] (5c, migrations 0022 and 0023)
- [x] `plan_snapshot` records repeat bounds and skips [ADR-0040] (5b)
- [x] New tables in `db/reset.ts` (5a)
- [x] **Delete a pin for one date once its day has ended**, unless it's
      a pin until done still carrying an open task, so no "how often
      pins were kept" figure can be derived: `pruneEndedPins` at
      launch [windows-and-pins.md §7] (5a)
- [x] Archiving a task or commitment removes its pins; deleting a
      commitment removes its pins, choices and skips
      [windows-and-pins.md §2.11] (5a)
- [x] Forward-only migrations via `npm run db:generate -w apps/mobile`;
      never hand-edit one [ADR-0002] (0020 in 5a, 0021 in 5b, 0022 and
      0023 in 5c, all generated)

### Wiring the engine in

- [x] Weights from `deriveTierWeights`, tiers seeded once from the old
      order (`seedTiers`) [ADR-0041] (5b)
- [x] Bounds, skips and Away into `LoadTask` and `computeDayLoad`
      (`withSchedule`, typed with `Required<ScheduleBounds>`);
      `boundsError` on write (5b)
- [x] `emptiedToday` set from Clear today and same-day skips
      [ADR-0040 §3] (5b)
- [x] The commitment band from `commitmentShare`, replacing the user-set
      band; an undated commitment one-off counts toward the share only
      on the day it's ticked [ADR-0044 §2 clarification] (5b)
- [x] Pass bounds and skips into `coverage` and `scheduledDateFor` in
      `db/commitmentPlan.ts` (EC-22): the task rows carry them (5b)
- [x] **Bump `FORMULA_VERSION` to 11** once the app scores with all of
      it at once; settled grades are never restated [constants.ts] (5b)
- [x] **Removing a commitment's last sub-commitment moves its work
      back onto the commitment** [ADR-0044 §7, found in Phase 3d] (5b)

### Tests Phase 5 owes

- [x] EC-20: the same day, scored from stored rows with two different
      sets of pins, gives the same `DayScore` [ADR-0039 §12] (5b,
      `db/__tests__/scoringFromStore.test.ts`)
- [x] ~~Restoring a backup from before the migration (EC-42)~~:
      withdrawn, no users yet (2026-10-19)
- [x] Goals from stored rows: entries with ticks, links from now on,
      the four kinds, "Took about…", goals going with a deleted
      commitment, EC-36, EC-38, EC-41 (5c, `db/__tests__/goals.test.ts`)

### Commands

In order: `/ecc:plan`, `npm run db:generate -w apps/mobile`, `/ecc:tdd-workflow`,
the `silent-failure-hunter` agent, the `invariant-reviewer` agent,
`/ecc:quality-gate`.
