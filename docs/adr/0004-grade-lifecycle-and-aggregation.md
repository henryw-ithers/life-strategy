# ADR-0004: Grade lifecycle and aggregation

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

## Context

The daily grade (points out of 100) is the app's emotional core: a
scoring system that feels punitive drives churn; one that's too soft
means nothing. vision.md's principles: measure consistency of
intentional behavior, never punish planned rest, smooth over bad days
at the weekly/monthly level. A further principle emerged while
deciding this ADR: **the grade log is a log of your life** — days
should be able to say what they were, not just what they scored.

## Decisions

### 1. Day lifecycle: 3 AM rollover, week-aligned edit window

- The day rolls over at **3:00 AM local time** (configurable) — a
  late night still belongs to the day it felt like.
- **The editable past is the current week and the week before**
  (amended 2026-07-17; replaces the original rolling 3-day window,
  aligning the edit window with the weekly accounting unit that the
  times-per-week task model established). Completions can be
  back-filled or corrected and day designations changed anywhere in
  that span. When a week ends, the days of the week-before-last get
  `finalized_at` stamped and become immutable forever. *(The
  immutability half of this was removed on 2026-07-30 — see the
  amendment below.)*
- Weeks start on **Sunday** and run to Saturday (**amended
  2026-07-27**; originally Monday-first). One definition serves task
  windows, weekly grades, the edit window, the calendar grid, and
  contentment check-in keys — a weekly task whose window disagreed
  with the week its grade lands in would be indefensible. Fortnights
  re-anchor to even weeks from an epoch Sunday. Existing
  `contentment_checkin` rows were keyed by Monday; a one-time fixup
  (`migrateToSundayWeeks`) moves each back a day to the Sunday opening
  the week it described, so six of its seven days are unchanged and no
  score is altered.
- Forgetting to log is not the same as not doing the thing; a full
  prior week is enough to be honest, and the hard two-week horizon
  still prevents retro-fiction.
- Timezone rule: days bucket by the device's local time at logging.
  Travel does not restate past days.

> **Amended 2026-07-30 (no edit horizon):** the two-week hard horizon
> is removed. **Every day that has happened stays editable, however far
> back**; only the future is off-limits. The horizon existed to prevent
> retro-fiction, but its practical effect was the opposite of honesty:
> a fortnight you forgot to log could never be corrected, so the record
> was permanently wrong in a way the user could see and not fix.
>
> `finalized_at` and `isFinalized` survive as a **marker, not a lock** —
> they mean "this day has settled," which lets the UI say so and flag a
> late edit. `isEditable` alone decides whether an edit is allowed.
>
> **What this costs, accepted:** weekly and monthly grades are no
> longer stable once computed. Editing a day in June changes June's
> grade in August, and reproducible history was the reason for the
> original window. The day-level record stays true — that is the trade.
> The calendar gained month-to-month navigation in the same change,
> since permission to edit any past day is meaningless if the UI cannot
> reach it.

### 2. Completion is binary (v1)

Done or not done — one tap, checklist feel. The
`task_completion` schema anticipates a partial-credit fraction column;
it gets added only if ADR-0008 calibration shows all-or-nothing
grading diverges from felt contentment.

### 3. Day kinds: normal, rest, special

Every day has a kind, declarable in advance or retroactively within
the edit window:

- **Normal** — graded on task points as usual.
- **Rest** — excluded from aggregates entirely: no grade, no penalty,
  no streak break. Tasks stay visible and completions still log. A
  vacation is a date range of rest days. A soft guideline (not a rule)
  discourages overuse.
- **Special** — the life-log day. It carries a **title and note**
  ("Backpacking in Yosemite", "Sarah's wedding"), regular tasks are
  suspended, and the day is graded by a **day-satisfaction rating**:
  the user rates the day 1–10 and the grade is `rating × 10`. Special
  days **count in aggregates** — a wonderful day is not a hole in your
  month. Creditless activity entries (ADR-0009) record what the day
  held.

Special-day satisfaction ratings double as direct contentment data
for ADR-0008 — days graded by felt experience rather than task
completion are exactly what the calibration needs more of.

### 4. Weekly-task accounting

> **Amended 2026-07-17:** task cadence is now a frequency — *N times
> per week* (1–7, 7 = daily). Tasks are not date-scheduled: a 3×/week
> task can be done on any three days, so a missed Tuesday is not a
> schedule violation. `times_per_week = 0` encodes once every two
> weeks (budget: `point_value` per fortnight). Accounting: a task's
> weekly budget is `point_value × times_per_week`; each completion
> earns `point_value`; the daily checklist shows tasks with
> completions remaining this week (or fortnight).
>
> **Amended 2026-07-17 (checklist build):** the deferred decisions
> land. A task completes **at most once per day** — 3×/week means "on
> three days"; a genuine second round the same day is an ADR-0009
> activity. The weekly goal is **exceedable**: runs beyond it credit
> `EXTRA_RUN_RATE` (50%, a named tunable) of the task's point value
> into the ADR-0009 bonus pool, under the same +10 cap.
>
> **Amended 2026-07-17 (formula v2 — unified denominator):** the
> daily/weekly split below is superseded. Every task contributes a
> flat per-day share of its weekly commitment to every day's
> denominator: `point_value × times_per_week ÷ 7` (fortnightly:
> `point_value ÷ 14`). The denominator is therefore **constant across
> days** — total weekly commitment ÷ 7. Any within-goal completion
> earns its **full point value on its day**, so every check moves
> today's number, and **a day may exceed 100** when several weekly
> runs land together (planned work shows honestly; only self-declared
> activity bonus stays capped). Consequences: the **weekly grade is
> the plain average of normal-day grades** (special days enter at
> `rating × 10`), the daily-vs-weekly copy problem disappears, and a
> day completing only its daily tasks scores below 100 by design —
> the number reads "on pace" only when weekly work gets daily-ish
> attention. ADR-0009 fill applies against a unit's unearned share of
> the day's denominator. `FORMULA_VERSION` bumps to 2.
>
> **Amended 2026-07-17 (formula v3):** ADR-0009's fill/bonus pool is
> retired — extra-run credit (still 50%) and activity credit add
> directly to the day's earned points. One additive score, displayed
> with a percent sign. `FORMULA_VERSION` bumps to 3.

Task point values (ADR-0003) are daily-slot values. Let `D` = sum of a
day's daily-task points and `W` = sum of weekly-task points
(`D + W = 100` for a fully tasked portfolio).

- **The daily grade ignores weekly slots:** daily grade =
  `earned daily-task points ÷ D × 100`. Your day is judged on your
  daily commitments; a weekly task you haven't done yet doesn't drag
  Tuesday down.
- **The weekly grade accounts for everything.** Over a week with `n`
  normal days: each normal day contributes its daily-task points
  earned (out of `D`), each weekly task contributes a budget of
  `n × p` and pays `n × p` when completed, and each special day
  contributes `rating × 10` out of 100. Rest days contribute nothing
  to either side.

      weekly grade = total earned ÷ total possible × 100

- Completing a weekly task is celebrated in the UI on its completion
  day, but lands arithmetically in the week.

### 5. Aggregation: straight totals, no curves

- Weekly and monthly grades are **points earned ÷ points possible** —
  transparent, predictable, computable in your head.
- Consistency is *shown*, not *enforced*: streaks, variance, and
  best/worst days are separate statistics that never bend the grade.
- No floors, curves, or weighting tricks anywhere: the grade is purely
  additive. If calibration later argues for consistency-sensitivity,
  that's a formula-version change, not a silent tweak.
- Monthly grade = same computation over the calendar month, presented
  at the monthly review (ADR-0002 decision 5).

> **Amended 2026-07-26 (which days are in the period):** the formula
> above is unchanged; what needed stating is its *input*. A `day_grade`
> row is only written when the user touches a day, so aggregating the
> stored rows alone dropped every ignored day out of the denominator —
> a week of four good days and three skipped ones graded as a flawless
> four-day week, and the inflated weeks fed straight into ADR-0008's
> divergence statistic. A period is therefore built from its calendar
> days, not from the rows that happen to exist:
>
> - An elapsed normal day with no row counts as **zero earned against
>   the standard denominator** — that denominator is constant across
>   days, so no history reconstruction is involved.
> - **Days before the first diagnostic never count.** There was no plan
>   to fall short of yet.
> - **A day counts once it is over.** The current day is excluded from
>   both numerator and denominator, extending the same reasoning §4
>   already applies inside a week ("a missed Tuesday is not a miss until
>   the week is out"). Counting an unfinished day would drop the period
>   grade at every 3am rollover and walk it back up as the day is
>   worked — a loss-aversion mechanic this app excludes by design. The
>   cost is that today's work lands in the weekly number tomorrow; the
>   daily number, which is the primary one on the checklist, still moves
>   on every check. The Today caption reads "This week, through
>   yesterday" so the lag is stated rather than inferred.
>
> Rest days remain {0, 0} and stay neutral; a fully rested week still
> grades null. `FORMULA_VERSION` does **not** bump — no stored grade
> changes meaning, and no day's own number changes. *(Pure function:
> `periodDays` in `packages/scoring/src/grade.ts`, with tests; consumed
> by `loadWeekGrade`/`loadMonthGrade`.)*
>
> Left open: the calendar tint (`loadMonthGrades`) still renders an
> untouched past day as blank rather than as a zero, so a week can now
> read below 100% with no visibly imperfect day behind it. Rendering
> twenty skipped days as a wall of red is exactly the presentation this
> product avoids, so the tint is a deliberate design question, not an
> oversight — decide it when the monthly review gets built.

> **Amended 2026-07-30 (missed days earn half):** an elapsed day with
> no row now counts as **half the standard denominator earned**
> (`MISSED_DAY_CREDIT = 0.5`), not zero. Zero was arithmetically honest
> and read as punishment: a fortnight away returned a number in the
> teens, which is the shape of a streak-shame mechanic even though
> nothing was subtracted. Half credit keeps missed days inside the
> denominator — the 2026-07-26 amendment's whole point — while making
> absence cost something rather than everything.
>
> **This is a floor, and §5's "no floors, curves, or weighting tricks"
> above no longer holds without qualification.** It applies to days the
> user never touched; every day with a row still scores exactly what it
> earned, and no stored grade is altered.
>
> **The incentive it accepts, knowingly:** a day nobody opened (50%)
> out-scores a day someone opened and half-finished (say 30%). The
> alternative considered was halving the day's *weight*
> (`{ earned: 0, possible: half }`), which never rewards absence but
> grades a sparse month far harder. Half credit was chosen for the
> friends test on the grounds that a forgiving number is likelier to
> keep someone using the app than a strictly-ordered one. **Watch for
> testers who stop logging on bad days**; that is the signal the
> incentive is biting, and the weight variant is a one-line switch in
> `constants.ts`.
>
> `FORMULA_VERSION` does **not** bump: it records how *weights* were
> derived for a snapshot, and this changes only how finished days
> aggregate. A pinned test asserts the untouched-beats-poor ordering so
> the trade stays deliberate.

> **Amended 2026-08-13 (a missed day is a zero):** the half-credit
> fill is **retired**; `MISSED_DAY_CREDIT` is gone. An elapsed day with
> no row **occupies a full denominator and earns nothing.**
>
> This is the third answer to one question, and the reasoning matters
> more than the number. Zero was the original. Half credit replaced it
> on 2026-07-30 as too punishing. **N/A replaced that earlier the same
> day** — the argument being that real use had put a scale on the
> numbers where 50 means "you did the basics; it's a pass," so filling
> an unopened day with exactly 50 reported a passing day that never
> happened. That argument still holds and is why 0.5 is not coming
> back. But N/A made skipping *free*, which is the opposite incentive
> from the one the product wants: the weekly and monthly numbers
> should reward showing up every day.
>
> **What makes zero fair rather than punitive is that there is an
> opt-out, and it is now a real one.** A declared day off
> ([ADR-0023](0023-planned-work-is-what-pays.md) §4) is stored as
> {0, 0} and leaves the aggregate entirely, and it covers rest,
> illness, travel, a wedding, a funeral. The rule is therefore
> **record something, or mark the day off** — only silence costs you.
> Critically, `isEditable` is `date <= today` (2026-07-30, above):
> there is no window past which a day locks, so a forgotten fortnight
> can always be marked off after the fact.
>
> That last point had a bug. The finalized-day freeze introduced by
> ADR-0023 made `cacheDayScore` read a settled day's *stored* score,
> so marking an old day off changed its kind and left its cached
> points in place — the day kept counting. `loadDay` now takes a
> `recompute` flag that only `cacheDayScore` passes: settling a day
> protects it from weights drifting underneath it, never from its
> owner correcting it.
>
> `FORMULA_VERSION` still does not bump — this changes how finished
> days aggregate, not how weights derive. `PeriodGrade.gradedDays`
> stays, now as an honest count of what is behind a number rather than
> a warning about absence.
>
> **This is not the retune the scale needs.** The planned side is
> still too generous — a completion pays `7 ÷ times_per_week` of its
> share of the day — and that stays in
> [backburner.md](../backburner.md).

> **Amended 2026-08-13 (history is re-derivable, and only on
> purpose):** two columns on `day_grade` settle how scoring changes
> meet existing data.
>
> - **`formula_version`** — which formula produced the stored points,
>   mirroring what `snapshot.formula_version` has always recorded for
>   weights. Null means "unknown era, do not compare."
> - **`plan_snapshot`** — the day's own task set as JSON
>   (`taskId, unitId, pointValue, timesPerWeek`), rewritten on every
>   `cacheDayScore` so the last touch before a day settles is the plan
>   that sticks to it.
>
> **The second is the load-bearing one.** Re-scoring a past day needs
> the tasks *that day* had. `recacheAllDayScores` never had them: it
> re-derived against the *current* plan, so a task added last week got
> applied to a day last month and a deleted one vanished from days it
> was part of. That was tolerable as a cache reconciliation and is not
> tolerable as a migration — "update all past scores" would have meant
> "pretend today's plan was always in force."
>
> With the snapshot, `recomputeAllGrades()` re-derives each day from
> stored history alone: tasks from the snapshot, completions from
> `task_completion`, and activity credit recomputed from each
> activity's `size` against *that day's* unit shares rather than the
> credit denormalized under whatever rule was in force then.
>
> **It is explicit, and it is the only way in.** Nothing calls it
> automatically; a formula change must never restate history on its
> own. It lives in Settings → Recompute past grades, and it reports
> how many days it could not re-derive — days written before these
> columns existed keep their stored grade rather than being
> approximated. An honest gap beats an invented number.

## Schema amendments (to ADR-0002)

- `day_grade` gains: `kind` (`normal|rest|special`), `title`, `note`,
  `satisfaction_rating` (1–10, special days), with `finalized_at`
  stamped at the third rollover.
- Free-form day entries are handled by ADR-0009's creditless
  activities.
- `app_setting` holds the rollover time.

## Consequences

- **Easier:** the grade is explainable in one sentence per layer; rest
  and special days remove the two biggest sources of unfair-feeling
  grades (planned rest, extraordinary days); the 3-day window makes
  logging forgiving without making history untrustworthy; special
  days start accumulating contentment ground truth from day one.
- **Harder:** three day-kinds and the edit window add real state
  machinery (finalization job at rollover, retro-designation rules);
  ~~the daily-vs-weekly denominator difference needs careful UI copy~~
  *(resolved by the formula-v2 amendment: one denominator, weekly =
  average of days)*.
- **Revisit when:** calibration (ADR-0008) weighs in on binary
  completion, consistency-sensitivity, or special-day grading; if
  users overuse rest days, reconsider the soft guideline.

## Action items

1. [x] Implement day lifecycle in the `scoring` package: rollover,
       edit window, finalization; property tests (finalized days never
       change; rest days never affect aggregates). *(days.ts + tests;
       finalization stamps lazily on app open. **The "finalized days
       never change" property was retired on 2026-07-30** — see the
       amendment to decision 1. Settling is now a marker, and the tests
       assert the opposite: a settled day is still editable.)*
2. [x] Implement daily/weekly/monthly grade computation per §4–5 with
       the worked denominators. *(Daily: `computeDayScore`; weekly and
       monthly: `aggregateGrade` (same reduce, either period) —
       `packages/scoring/src/grade.ts`. Queried via `loadWeekGrade`/
       `loadMonthGrade` in `apps/mobile/src/db/grades.ts`. The weekly
       grade surfaces on the Today screen; monthly has no screen to
       land on yet — the full monthly-review ritual (ADR-0002 decision
       5) is still unbuilt.)*
3. [x] Amend the Drizzle schema: `day_grade` columns + `day_entry`.
4. [x] Design UI copy for the daily-vs-weekly denominator difference.
       *("This week · counts in the week's grade" on the checklist.)*
