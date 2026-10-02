# ADR-0031: The semester score

> **Status:** **Withdrawn 2026-09-11, never accepted**\
> **Date:** 2026-09-08 (proposed) · withdrawn 2026-09-11\
> **Deciders:** Henry

> **Withdrawn before acceptance. Do not implement.**
>
> A term-length score needed a **term**, and the term was the most
> irreducibly academic thing in the whole design. Once commitments
> generalised to cover a club, a job or a team
> ([ADR-0035](0035-commitments-are-custom-units.md)), a semester-shaped
> horizon stopped fitting the model: a basketball club does not have
> one, and inventing a term for it to be scored against would have been
> the academic module reasserting itself through the back door.
>
> What replaced it is smaller and more general. A commitment is a
> scoring bucket with its own band
> ([ADR-0032](0032-the-commitment-band.md)), so "how much am I putting
> into school" is answered by the same daily and weekly numbers that
> answer it for everything else. Per-goal progress (ADR-0015) covers
> the rest, and generalises to a club for free.
>
> Two things here are worth keeping in mind if a second scale is ever
> proposed again:
>
> - **The refusals in §5** — no marks, no absence record, no attendance
>   percentage, no comparison — were right, and ADR-0035 §§2–3 carry
>   them forward as properties of the model rather than of a score.
> - **The elapsed-denominator idea** in §2 (count only weeks that have
>   finished; never count the current one) is a good answer to "what
>   does a long-horizon number read in week two," and it is not
>   recorded anywhere else.
>
> The body below is kept unedited as the record of a decision
> considered and dropped.

> **What Henry decided (2026-08-21), and what is drafted around it.**
> Two calls are his: school gets **its own score** — *"a semester grade
> which is a compilation of your work/effort over the semester"* —
> rather than academic work feeding the daily number; and that score is
> **weighted by what each assessment is worth**. The band split, the
> elapsed denominators, the ceiling, the version stamp and every
> refusal in §5 were drafted around those calls.

## Context

ADR-0035 §4 keeps academic work out of the daily grade by construction:
a course reaches a day only as an ordinary one-off task the user
planned. That is the right answer for the *day* and it leaves the
*term* unmeasured — and a semester is the unit a student's life
actually runs on.

The app already has three horizons: daily, weekly, monthly. A semester
is a fourth, and the thinnest thing about the existing set is that the
weekly rhythm carries one question (ADR-0024 §4 says so). A term-length
number is not a fourth grade competing with the first; it is a second
scale on a horizon the first cannot see.

The hard part is that a school score is the place this app is most
likely to break its own rules. Every course app measures marks; marks
are outcomes; and AGENTS.md is explicit that daily grades measure
consistency and that achievements — outcomes — feed monthly summaries
only, never the number.

Constraints already in force:

- **Coverage decides the ceiling** (ADR-0027): a number that can exceed
  its own maximum cannot carry meaning, and the weight of something you
  hold nothing in is **not** redistributed.
- **The app never shames**, and **kindness is ambient, never targeted**
  (ADR-0008): nothing may condition on a shortfall.
- **No adherence statistic** (ADR-0024 §2).
- **History never silently restates** (ADR-0002).
- **A mode is presentation and grammar, never arithmetic**
  (ADR-0034 §3).

## Open questions

1. What does the number measure?
2. What is its denominator, and what does it read in week one?
3. What happens to a course you enrolled in and never opened?
4. Does it reach back into the daily grade, ever?
5. What settles it when the term ends?

## Options considered

### Candidate 1 — "Every course, every week"

    cells = elapsed teaching weeks × courses
    score = 100 × (cells where that course saw any effort) ÷ cells

One sentence a person can hold, and impossible to make punitive. It
inherits the "one tag anywhere in the day earns the full share"
precedent from ADR-0025 §3.

Rejected on two counts. It is binary per cell, so a five-minute skim
buys a whole week and the number drifts to 100 and stops
discriminating — the twin of the failure ADR-0027 was written to fix,
since a number that saturates carries as little meaning as one that
overflows. And it has no way to say "you did the routine *and* real
work beyond it," which is the distinction ADR-0027 §1 says a good scale
must draw. It also ignores Henry's call that weighting matters.

### Candidate 2 — Two bands, mirroring ADR-0027

**Chosen**, and detailed below. The decisive argument is not the
arithmetic but the coherence: someone who has internalised "80 is a
full ordinary day, 90+ means you went beyond your plan" gets the
semester number for free. Candidate 1 would be a second,
differently-shaped scale in the same app, and two scales that disagree
about what a number means is worse than one that takes a paragraph to
explain.

## Decision

### 1. Two bands, out of 100

Pure, in `packages/scoring/src/semester.ts`, tested with vitest and
free of React Native imports (ADR-0001).

**Consistency — 60.** Showing up, week by week. The band is split
equally across enrolled courses with `largestRemainder`
(`packages/scoring/src/rounding.ts`) so the sub-budgets sum to exactly
60; a course earns its share of the elapsed teaching weeks in which it
saw any effort at all.

Equal shares because the app does not know your degree's credit points
and should not ask. Recorded as the assumption to revisit when a thesis
sits beside a six-credit elective.

**Assessment — 40.** This is where *weighted by what each assessment is
worth* lives. Within a course, `assessment.weighting` is normalised
across assessments to sum to 1. For each assessment whose due date has
**elapsed**:

    landed  = 1 if submitted_on is set, else 0
    effort  = min(1, work sessions done ÷ work sessions planned)
              (none planned → effort = landed)
    score_a = 0.5 · landed + 0.5 · effort

    courseBand = Σ (w · score_a) ÷ Σ w        over elapsed assessments
    assessment = 40 × mean(courseBand across active courses)

Assessments with no weighting recorded share equally in whatever weight
is unaccounted for, so the band works before a syllabus is fully typed
in.

    score = consistency + assessment

`landed` is **submitted**, not submitted *on time*. The app cannot
verify lateness and has no business pricing it. Effort is what is
scored.

### 2. The denominators are what make it gentle

- **Only elapsed teaching weeks count, and the current week never
  does** — only weeks whose `weekStart` is strictly before
  `weekStart(today)`. This mirrors `periodDays`' "days count once
  they're over" and Home's "This week, through yesterday." It is what
  stops the number dropping every Monday morning and reporting the
  calendar rather than the person.
- **Break weeks are excluded** — a week counts as a break when a
  `term_break` covers four or more of its seven days. Reading week
  cannot lower the score.
- **Only elapsed assessments count.** A denominator spanning the whole
  semester reads 4 in week two, which is not honest, merely early.
- **No elapsed teaching weeks yet → `score` is `null`, not `0`**,
  exactly as `PeriodGrade.base` is null with no graded days.

Alongside the number, `weeksCounted` says what it stands on — doing for
a semester what `gradedDays` does for a week.

### 3. Coverage decides the ceiling; withdrawal is the valve

    ceiling = Σ consistency budgets of courses with any effort all term
              + 40

A course you enrolled in and never once opened leaves its share
unearnable, and **nobody else receives it**. That is ADR-0027 §2
applied verbatim, for its reason: redistributing it would mean a plan
covering two courses of five could still read 100.

The honest way out is the same one ADR-0027 gives — archive
(withdraw) the course, and the budgets re-split **at read time,
writing nothing.** The copy states that consequence plainly rather than
implying it.

### 4. It never touches the daily grade, and carries its own version

`SEMESTER_FORMULA_VERSION` lives in `semester.ts`, **not**
`FORMULA_VERSION` in `constants.ts`. Two scales that move independently
need two stamps, or bumping the daily formula silently marks every past
semester as a different era.

Nothing imports `semester.ts` from `grade.ts` or `bands.ts`. Building
this ADR moves no daily number, and `FORMULA_VERSION` does not change.

A live term computes at read time. A term whose `end_date` has passed
writes **`term_result`** once and reads it back forever — the
`day_grade` pattern, for the ADR-0002 reason: changing these constants
in 2027 must not restate 2026's semesters. This is the semester
analogue of the `finalized_at` guard ADR-0023 added to
`recacheAllDayScores`.

### 5. The refusals

Each of these is the obvious next addition, and each is prohibited by
name.

- **No marks, results or grades — enforced by the type signature.**
  `SemesterInput` has nowhere to put one. `assessment.weighting` sizes
  copy and sets this band's shares; it is never a stand-in for a
  result. Test: the module exports no symbol containing `mark`,
  `grade` or `result`.
- **No absence record, so no shortfall to notice.** ADR-0035 §3 keeps
  the model structurally incapable of seeing a missed lecture. That is
  stronger than the copy rule ADR-0008 would otherwise require.
- **No attendance percentage and no adherence statistic** — ADR-0024
  §2, restated because a timetable makes `attended ÷ scheduled` look
  computable for the first time.
- **No target, no red, no "behind."** It renders as the daily number
  does: a figure and a neutral band. No copy anywhere conditions on it
  being low.
- **No comparison, ever** — not against other people, not against
  another term. ADR-0027's own note applies: change what is included
  and the number changes meaning without changing arithmetic.

`SUBMISSION_WEIGHT` (the 0.5) and the 60/40 split are **tunables**, in
the sense `GAP_COEFFICIENT` is: named constants with no research behind
them, movable by calibration without a rewrite.

## Consequences

**Easier.** The term becomes legible, on a horizon the daily number
cannot reach, and it does so in the app's own existing vocabulary —
bands, coverage, a ceiling that explains rather than grades.

**Harder.** There are now two 100-point scales in one app, and the copy
has to keep them apart on every surface that shows both. `term_result`
is a second materialization path with a second version stamp to
maintain.

**Accepted cost.** Equal course weighting will feel wrong to anyone
carrying an honours thesis beside an elective, and the fix — asking for
credit points — is a question the app does not otherwise need to ask.
Taken deliberately: a wrong-feeling weight is a smaller cost than a
setup form nobody finishes.

If this ADR proves wrong, it is the 60/40 split that was wrong, and the
symptom will be a number that moves too little when a hard week goes
well.

**Revisit when:** a term ends and the settled number does not match how
the term felt — which is the semester-scale version of the calibration
question ADR-0008 asks of days.

## Action items

> **Not done, and not to be done:** this ADR was withdrawn before it
> was accepted. The list is kept as the record of what it would have
> taken.


1. [ ] `packages/scoring/src/semester.ts` + tests + export from
       `index.ts`; `SEMESTER_FORMULA_VERSION`.
2. [ ] `term_result` and its migration; write-once on term end.
3. [ ] The score on the Courses segment, with its `weeksCounted`
       caption.
4. [ ] Tests for the gentleness properties, each one executable:
       `null` before the first elapsed week; break weeks excluded; the
       current week never counted; an untouched course lowering the
       ceiling with nobody receiving its share; archiving that course
       re-splitting the budgets; consistency never above 60 and the
       assessment band never above 40; a settled term unmoved when the
       constants change.
5. [ ] Amend ADR-0027 with a pointer: this borrows its band and
       coverage shape, carries its own stamp, and moves no daily
       number.
