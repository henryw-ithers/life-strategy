# ADR-0029: The academic module is a parallel model

> **Status:** Proposed\
> **Date:** 2026-08-21\
> **Deciders:** Henry

> **What Henry decided (2026-08-21), and what is drafted around it.**
> The call recorded here is his, and it was the first of four: the
> academic layer is a **parallel module** — courses, terms and
> timetables as their own first-class model — rather than courses
> modelled as goals inside the `education-learning` unit. The schema,
> the refusal of a `course.unit_id`, the assessment/task seam in §4
> and the importer seam in §6 were drafted around it.

## Context

The hierarchy is `SLA → SLU → Goal → Task`, and it has held every
object the app has needed. A university course looks, at first glance,
like a goal: it is specific, it is temporary, it has checkpoints.

It is not one, in three ways that matter:

- **A goal is something you chose; a course has a timetable somebody
  else set.** ADR-0007 defines goals as "specific, measurable,
  temporary" objectives the user sets and may pause, revise or set
  aside. None of those verbs apply to a lecture at 9am on Tuesday.
- **A goal has no term.** Courses arrive and expire in cohorts, on
  dates that are facts about an institution rather than intentions.
- **A goal's checkpoints are milestones the user invents.** A course's
  are assessments with due dates and weightings that already exist
  before the user opens the app.

Modelling a course as a goal would mean bending `goal.target_date`
(month granularity, by ADR-0015 §4, and deliberately inert when it
passes) into a deadline, and `milestone` into an assessment with a
weighting. Both would then mean two things.

Constraints already in force:

- **The daily surface stays checklist-simple** (PRODUCT.md principle 2).
- **Planned work is what pays** (ADR-0023): a new credit source must
  declare which side of the planned/unplanned line it falls on.
- **Coverage decides the ceiling** (ADR-0027): a day's number is
  bounded by the units a plan actually covers.
- **Areas are presentational** (ADR-0021), and a soft attribute may
  never become a stored score.
- Schedule mode (ADR-0028) decides whether any of this renders.

## Open questions

1. Is a course a goal, or its own entity?
2. How does an assessment reach the daily checklist, if at all?
3. Does academic work feed the daily grade?
4. Where does the module live, given the tab bar is full?
5. What keeps a later timetable importer from reshaping the model?

## Options considered

### Courses as goals in `education-learning`

Cheapest — reuses the goal lifecycle, milestones, the Goals screen and
`goal_progress` wholesale. Rejected for the three mismatches above, and
for a fourth that only shows up later: five courses would put five
goals in one unit, and ADR-0027's coverage arithmetic prices a unit's
tasks against that unit's weight. A semester would quietly reprice
every other thing the person does in `education-learning`.

### A parallel model, fully separate

**Chosen.** Courses, terms, commitments and assessments are their own
tables, and the seam to the existing model is deliberately narrow and
one-directional (§4).

### A parallel model that cross-references units

Rejected as the default, and the reasoning is worth recording because
the column is tempting: a `course.unit_id` would let a term's work feed
unit effort and show up in the portfolio graph. It is also the single
most likely route by which academic work leaks into the daily grade,
because the next person to read that column will wire it into coverage.
The designed path, if the cross-reference is ever wanted, is in §5.

## Decision

### 1. Courses, terms and assessments are their own model

    term → course → assessment
    term → fixed_commitment

Seven tables, in `apps/mobile/src/db/schema.ts`, following ADR-0002
conventions throughout — text UUID keys, ISO-8601 timestamps, soft
delete via `archived_at`, local dates as `TEXT 'YYYY-MM-DD'`:

| Table | What it holds |
|---|---|
| `term` | A semester: name, `start_date`, `end_date` |
| `term_break` | Reading week and mid-semester breaks |
| `course` | Code, title, `hue_index`; withdrawal is `archived_at` |
| `fixed_commitment` | Timetabled blocks — the terrain of a week (ADR-0030) |
| `assessment` | A deadline: `due_date`, optional `due_minute`, `weighting` |
| `study_session` | Effort that is not a checklist task |
| `term_result` | A finished term's settled score (ADR-0031) |

**"Current term" is derived from the dates, never stored.** A stored
`is_current` flag is a value that restates.

`course.hue_index` indexes a `COURSE_HUES` array drawn from the six
existing area hues, and carries ADR-0021's rule verbatim: it may decide
colour and grouping, never weight, rank, points or any stored score.

### 2. There is no mark, grade or result column, anywhere

Every course app has one. This one must not.

The app measures effort and consistency, never outcomes — AGENTS.md
states it for daily grades and PRODUCT.md principle 3 states it for
presentation. A mark column is the shame surface arriving through the
schema, and it would arrive in the one place where the number is not
even the app's to report.

`assessment.weighting` exists and is **not** a stand-in. It sizes the
copy ("worth 40% of the course"), orders the list, and sets the shares
inside ADR-0031's assessment band. It is never a result.

### 3. There is no absence record, and no attendance percentage

`study_session` records that you *did* something. Nothing anywhere
records that you did not.

This is stronger than a copy rule: it makes the module **structurally
incapable** of noticing a missed lecture, which is what ADR-0008
requires of anything that could otherwise condition on a shortfall, and
what ADR-0024 §2 means by refusing adherence as a statistic this app
keeps. It also closes ADR-0024's still-open action item 4 rather than
reopening it.

`attended ÷ scheduled` is the obvious next addition and it is
prohibited here by name.

### 4. An assessment is not a task, and does not become one automatically

An assessment is the **record** — deadline, weighting, submission. The
**work** is ordinary one-off `task` rows, minted on request by a *"Put
on my checklist"* action calling the existing
`addTask(unitIds, title, timesPerWeek, plannedWeekdays, partOfDay,
goalId, oneOff)` with `oneOff = { size, date, due }`, filed under
whichever unit the user picks — `education-learning` offered, never
forced.

Three consequences, and the first is the one that makes the whole
module safe to build in phases:

- **The foreign key points from `assessment` to `task`, never back.**
  No column is added to `task`, `goal`, `life_unit`, `day_grade` or any
  scoring table. `loadDay`, `loadPlan`, `bandPointValues`,
  `computeDayScore`, `recomputeAllUnitPoints` and the backup format
  stay entirely ignorant of academia.
- **"No new credit source" is true without argument.** The only route
  from a course to a day's number is a one-off the user deliberately
  placed in their own plan, which is the definition of planned work.
  ADR-0023 is undisturbed; ADR-0027's ceiling does not move.
- `assessment.task_id` nulls when the task archives, exactly as
  `goal.autocount_task_id` does (ADR-0015 §2). Deleting an assessment
  does **not** delete its tasks — the same reasoning ADR-0007's
  deletion amendment gives: the work outlives the scaffolding.

Study sessions minted this way earn ordinary daily points from their
unit, like any other one-off. **If schoolwork paid nothing daily, a
student's daily grade would collapse every exam period** — precisely
the divergence between grade and felt contentment that the calibration
experiment (ADR-0008) exists to close.

### 5. The seam is one-directional, and there is no `course.unit_id`

If a course ever needs to name a unit, the path is a **`course_unit`
join table** copying `task_unit`'s `membership` discriminator with only
the `note` value permitted (ADR-0025 §5) — it feeds effort and the log,
takes no rank slot, and earns nothing.

Recorded here so it is not reinvented as a bare foreign key, which is
what it will look like it should be.

### 6. The module lives in the Goals tab, and editing is pushed

Browsing is tab-resident: `(tabs)/goals/index.tsx` gains a
`Goals · Courses` segment using the existing `Segmented` control.
Editing is pushed, under `app/study/` — course, assessment, term and
timetable — following the tab layout's own stated rule that focused
tasks sit outside the tab group rather than beside it, as the
diagnostic, calibration and backup already do.

**A sixth tab is rejected**, not merely unchosen. The bar is "the most
expensive space in the app" by its own header comment, the fifth slot
was contested as recently as 2026-08-19 when Settings was evicted for
Log, and the module is seasonal — it would sit dead four months a year
in the app's most valuable real estate. A tab that appears only during
term is worse: navigation that moves is navigation you cannot learn.

### 7. Timetable import is deferred, and the seam is paid for now

Manual entry only. Three cheap things keep an importer addable without
reshaping anything:

- `fixed_commitment` is already the **expanded, explicit** form an
  importer produces. Nothing about the schema assumes a human typed it.
- Two inert nullable columns land now — `source` (`manual | import`)
  and `external_id` — so the importer needs no migration against live
  rows. `external_id` is the `.ics` `UID`, which is what makes
  re-import an upsert rather than a duplicate storm.
- **One write seam:** every commitment is created through
  `createCommitment()` in `db/academic.ts`, never inline. An importer
  becomes a second caller of one function.

When it lands, `.ics` comes first — most universities publish a feed,
it is exact, it is testable, and it needs no model. On-device
extraction is the second pass and reopens the privacy story
(`docs/privacy.md` promises no server and no third-party SDK); planned
ADR-0017 already reserves that question. No importer may bundle a model
or call a network service without going through it.

## Consequences

**Easier.** A course can have exactly the shape a course has, without
`goal` and `milestone` acquiring second meanings. Each phase ships
alone because §4 keeps `task` ignorant of the module. And the refusals
in §§2, 3 and 5 are written down, so the three most tempting additions
each have an answer already.

**Harder.** There are now two hierarchies in an app whose README has
advertised one, and AGENTS.md has to say so. Anything that wants to
reason across both — "how much of my life went to study this month" —
has to go through effort and the log rather than through a join.

**Accepted cost.** Refusing `course.unit_id` means a term's work does
*not* show up in the portfolio graph until someone builds `course_unit`.
That is a real loss, taken deliberately: the graph is a monthly
reflection surface and the cost of getting the leak wrong is the daily
grade, which is the app's one quantitative claim.

**Revisit when:** the `course_unit` question comes up twice; or a
second non-academic module wants the same parallel treatment, which
would mean the app needs a general answer rather than this one.

## Action items

1. [ ] Migrations for the seven tables, one per phase, generated by
       `npm run db:generate -w apps/mobile`.
2. [ ] **Fix `TABLES_IN_DELETE_ORDER` in `db/reset.ts`** before adding
       to it: it lists 19 tables against the schema's 20, missing
       `goal_progress`, `task_completion_tag` and `planned_occurrence`,
       so `eraseAllData` leaves those rows behind today and the
       constant's own "children before parents" comment is already
       false.
3. [ ] `db/academic.ts` with `currentTerm()` derived, and a single
       `createCommitment()` write seam.
4. [ ] The `Goals · Courses` segment; promote `Segmented` from
       `components/plan/` to `components/ui/`.
5. [ ] Amend ADR-0002 with the seven-table schema block, and ADR-0007
       with a note that a course is deliberately not a goal.
6. [ ] `docs/backburner.md`: the timetable-import entry, pointing at
       planned ADR-0017.
