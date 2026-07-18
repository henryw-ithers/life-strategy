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
  `finalized_at` stamped and become immutable forever.
- Weeks start on **Monday** by default (configurable via
  `app_setting`).
- Forgetting to log is not the same as not doing the thing; a full
  prior week is enough to be honest, and the hard two-week horizon
  still prevents retro-fiction.
- Timezone rule: days bucket by the device's local time at logging.
  Travel does not restate past days.

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
       finalization stamps lazily on app open.)*
2. [ ] Implement daily/weekly/monthly grade computation per §4–5 with
       the worked denominators. *(Daily done — `computeDayScore` in
       grade.ts; weekly/monthly land with the review surfaces.)*
3. [x] Amend the Drizzle schema: `day_grade` columns + `day_entry`.
4. [x] Design UI copy for the daily-vs-weekly denominator difference.
       *("This week · counts in the week's grade" on the checklist.)*
