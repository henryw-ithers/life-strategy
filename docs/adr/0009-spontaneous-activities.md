# ADR-0009: Spontaneous activities and bonus credit

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

> **Amended 2026-07-17 (formula v3):** the fill-then-overflow split
> and `BONUS_CAP` (§3) are retired. Activity credit and extra-run
> credit add **directly to the day's earned points** — one additive
> score, no separate "+N" pool, consistent with formula v2's rule
> that days may exceed 100. Sizing (§2) keeps its three credit rates
> (25/50/100% of unit weight) but is asked **qualitatively** — "How
> significant was it?" A little / Fairly / Very — with no time
> anchors; the schema enum `quick|normal|big` is unchanged. Revisit:
> if real use shows activity credit inflating grades (the risk §3's
> cap existed to bound), reintroduce a cap as a formula-version bump.

## Context

Planned tasks can't cover a life. A round of golf, a movie with a
friend, an afternoon helping a neighbor — none of these were on the
checklist, all of them are exactly the kind of intentional living the
app exists to encourage. The grade should reward *doing things and
being mindful of how time is spent*, not just executing a plan. This
also deepens the life-log principle (ADR-0004): the day's record
should show what you actually did.

The risk is grade inflation: unlimited self-declared points make the
metric meaningless. The design must be encouraging *and* bounded.

## Decision

### 1. Activities are a first-class log entry

An **activity** is a one-off logged event on a day: title, optional
note, and **1–3 SLU tags** (the app suggests tags from the title —
"golf" → Physical health/sports, Friendship, Offline entertainment).
Activities are logged from the daily surface in a few taps and obey
the ADR-0004 edit window (3 days back).

An activity may also be logged **without credit** (no size selected) —
a pure journal line. This subsumes ADR-0004's `day_entry`: special-day
and rest-day entries are simply creditless activities.

### 2. Sizing: size classes scaled by unit weight

When logging with credit, the user picks a size:

| Size | Rough meaning | Credit per tagged unit |
| ------ | --------------- | ------------------------ |
| Quick | ~30 minutes | 25% × unit weight |
| Normal | ~1–2 hours | 50% × unit weight |
| Big | half a day or more | 100% × unit weight |

Each tagged unit is credited independently (hence the 3-tag cap).
Credit scales with unit weight by design: doing something aligned with
what matters most is worth more — consistent with the entire scoring
philosophy. Credited points are denormalized at log time (ADR-0002
rule: history never restates).

### 3. Fill unearned first, bonus overflow capped

Activity credit lands in two stages:

1. **Fill:** credit to a tagged unit first fills that unit's
   *unearned daily-task points* for that day — golf can stand in for
   the workout you skipped. (Tasks are not marked complete; the points
   are simply covered.)
2. **Overflow → bonus:** credit beyond the tagged units' unearned
   daily slots (including credit to units with no daily tasks that
   day) pools into a **daily bonus, capped at +10** (`BONUS_CAP`, a
   named tunable). The day displays as e.g. **"92 +6"**.

Multiple activities apply chronologically. The cap means a day's
number stays comparable day-to-day while spontaneity is always worth
logging — even on a perfect day.

### 4. Aggregation and day kinds

- Bonus points join weekly/monthly numerators; denominators are
  unchanged (ADR-0004 §4). A week can therefore marginally exceed 100
  — rare, earned, and honest.
- **Rest days:** activities log (they're part of the life record) but
  credit doesn't count — the day is excluded from aggregates entirely.
- **Special days:** activities log creditlessly; the satisfaction
  rating governs the day's grade.
- Activity credit counts as unit effort for the portfolio graph's
  bubble size (input to ADR-0005).

## Schema (amends ADR-0002)

- **`activity`** — id, local_date, title, note, size
  (`quick|normal|big`, nullable = no credit), created_at
- **`activity_tag`** — activity_id, unit_id, points_credited
  (denormalized at log time); max 3 rows per activity
- **`day_entry` is removed** (superseded by creditless activities).

## Consequences

- **Easier:** spontaneous living is rewarded without a planning step;
  the daily log reads as what the day actually held (tasks +
  activities); skipped-workout guilt has an honest escape valve (golf
  genuinely was exercise); tag data enriches bubble-size effort and
  future recommendations.
- **Harder:** the fill-then-overflow computation adds real logic to
  the grade engine; tag suggestion needs at least a keyword map in v1;
  "size" is self-reported — the cap, not honesty policing, is the
  integrity mechanism.
- **Revisit when:** calibration (ADR-0008) can test whether
  activity-heavy days correlate with contentment (they should — if
  not, sizing needs work); if users route everything through
  activities and abandon tasks, the fill mechanic is too generous.

## Action items

1. [x] Implement fill-then-overflow credit in the `scoring` package;
       property tests (bonus ≤ BONUS_CAP; fill never exceeds a unit's
       unearned daily points; creditless activities never touch
       grades). *(grade.ts + tests, incl. extra-run bonus pooling.)*
2. [x] Replace `day_entry` with `activity`/`activity_tag` in the
       schema.
3. [x] Build the v1 tag-suggestion keyword map (title → SLUs).
       *(content/tagKeywords.ts.)*
4. [x] Fold activity credit into ADR-0005's bubble-size effort metric
       when that ADR is resolved. *(`trailingEffort()` in
       `apps/mobile/src/db/diagnostic.ts` sums `activity_tag` credit
       alongside task completions before freezing it into
       `rating.effort_points`.)*
