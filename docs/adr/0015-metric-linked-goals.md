# ADR-0015: Metric-linked goals

> **Status:** Accepted\
> **Date:** 2026-08-16\
> **Deciders:** Henry

> **What Henry decided (2026-08-16), and what is drafted around it.**
> His calls: **two metric kinds** — cumulative and target reading (§1);
> progress is **manual, plus an optional auto-count from one linked
> task** (§2); a passed deadline **does nothing** — the date is context,
> never a status (§4); and goal progress **never appears on the daily
> checklist** (§6). Rough deadlines and retroactive milestone tracking
> were asked for the same day and are designed here. Everything else —
> no auto-completion (§3), milestone thresholds (§5), the `YYYY-MM`
> granularity in §4, and the schema — was drafted around those calls and
> **accepted with them on 2026-08-16**.

## Context

ADR-0007 §2 deferred metric-linked goals explicitly: *"Metric-linked
goals (target value + progress entries, auto-completion) are deferred;
`goal.target_value` already sits in the schema for when they arrive."*
The reserved trigger was "manual completion proves limiting in real
use."

**The trigger fired on 2026-08-16**, from a different direction than
expected. Rather than manual completion chafing, Henry asked for rough
deadlines and planned-or-retroactive milestone tracking, and defended
output-shaped goals ("read 24 books this year") against the drafting
argument that they risk the Etkin measurement effect. That exchange is
recorded in
[ADR-0025 §11](0025-communal-units-are-dimensions.md); the residual
question it flagged is answered here in §6.

`goal.target_value` is already plumbed — `createGoal` accepts it and
`loadGoal` reads it back — and nothing consumes it. Two of vision.md's
own worked examples need this ADR to work at all: "bench press 225 lb"
with milestones 135 → 185 → 225 is a metric goal with metric
milestones, and "read 24 books this year" is a metric goal with a
deadline.

Constraints in force:

- **Daily grades measure consistency, never one-time achievements**
  (AGENTS.md). Achievements feed monthly and yearly summaries only.
- **The daily surface stays checklist-simple** (PRODUCT.md principle
  2).
- **Ambient kindness** (ADR-0008): nothing may condition on a
  shortfall. A missed date is a shortfall.
- **Completion is a deliberate act with a three-path exit**
  (ADR-0007 §2) — archive, follow-up, or transition to maintenance.
- **Nothing is a clock** (ADR-0024 §1, reaffirmed in ADR-0025 §7).

## Decision

### 1. Two metric kinds

`goal.metric_kind`: **`cumulative` | `target`**, nullable. **Null means
no metric** — a plain goal, exactly as goals work today. Every existing
goal stays valid and unchanged.

- **Cumulative** sums entries toward a total. "24 books," "100 hours,"
  "12 sessions." Progress is `Σ entries ÷ target`.
- **Target reading** logs readings and is met when one reaches the
  target. "Bench 225 lb," "weigh 80 kg."

**Direction is inferred, not asked.** For a target reading, compare the
**earliest** progress entry against the target: below it, the goal
ascends; above it, it descends. So weight loss and strength gain use
one metric kind and one input, and the user is never asked which way
they're going.

Until the first entry exists there is no direction and therefore no
progress bar — the goal shows its target as text. This is honest rather
than a gap: a progress bar with no readings would be inventing a
starting point.

*Fragility to accept:* deleting the earliest entry can flip the
inferred direction. Rare, recoverable, and cheaper than a column the
user has to fill in. If it bites in real use, store the direction at
first entry.

`goal.metric_unit` carries the label — "books," "lb," "kg," "hours" —
as free text. The app does not know what a kilogram is and does not
need to.

### 2. Progress: manual entries, plus one optional auto-count

A **progress entry** is a date, a value, and an optional note, added
from the goal screen. This works for every metric kind and keeps goals
in the strategy layer.

Additionally, a **cumulative** goal may nominate **one task** whose
completion increments it by one (`goal.autocount_task_id`). A "gym
sessions" goal counts its gym task without a second act of recording.

Three constraints on the auto-count, because it is the part that can go
wrong:

- **Cumulative only.** A task completion carries no reading, so it
  cannot feed a target-reading goal.
- **One task, nominated explicitly.** Not "all tasks under this goal" —
  that would make progress a silent function of the task list, and
  editing tasks would rewrite goal history.
- **Auto-counted entries are ordinary progress entries** with
  `source = 'task'`, visible in the list and individually deletable.
  Nothing accrues invisibly.

If the nominated task is archived, the link nulls and existing entries
stay. They are history and history does not restate (ADR-0002).

### 3. No auto-completion. Reaching the target prompts.

Hitting a target **never completes a goal by itself**. It surfaces an
invitation to complete, and completing runs ADR-0007 §2's existing
three-path flow — archive, follow-up, or transition to maintenance.

This is forced rather than chosen: that flow asks a question only the
user can answer, so silent completion would either skip it or pick for
them. It is also right on the merits — "I benched 225 once" and "I am
now a person who benches 225" are different claims, and only the user
knows which happened.

The invitation appears on the goal screen, and it may condition on this
event, because ADR-0008 permits conditioning on **positive** events.

### 4. Rough deadlines: `YYYY-MM`, and a passed date changes nothing

`goal.target_date`, nullable, stored at **month granularity** —
`TEXT 'YYYY-MM'`. "By October," "this year" (`2026-12`). A month picker,
never a date picker and never a time.

The granularity is proposed rather than decided, and the reasoning is
consistency: ADR-0024 established that this app plans roughly and owns
no clocks. A goal deadline is the longest-horizon commitment in the
product, so it is the *last* place precision earns its keep — and
`YYYY-MM` makes roughness structural rather than a matter of
discipline.

**When the date passes, nothing happens.** No "overdue," no colour
change, no badge, no prompt, no auto-pause. The date renders as
information wherever the goal renders.

It comes up in the monthly review because that is where goals are
reviewed anyway (ADR-0007 §4's load nudge already lives in that
neighbourhood) — as part of the normal pass over every active goal,
**never as an alert triggered by the date having passed**. A marker
that appears only when you are behind is conditioning on a shortfall,
which is precisely what ADR-0008 forbids, and "revise" and "abandon"
are already first-class, neutral outcomes for a goal that has drifted.

### 5. Milestones may carry thresholds, and may be recorded retroactively

**Thresholds.** `milestone.target_value`, nullable. vision.md's bench
example (135 → 185 → 225) is a metric goal whose milestones are
metric, and without this the rungs are just labels. A progress entry
that passes the current milestone's threshold **prompts** to advance
it — one tap, consistent with §3, not silent.

**Retroactive completion.** Completing a milestone lets the user say
*when* it happened, defaulting to today. The chosen date is written to
both `milestone.completed_on` and the minor achievement's
`achieved_at`, so look-back views place it in the month it actually
occurred rather than the month it was recorded.

This matters more than it looks: milestones are frequently noticed late
("I passed 185 a few weeks ago"), and ADR-0007 §3 already establishes
that editing milestones mid-climb is normal rather than cheating.
Recording one in the wrong month would put a false entry in the log of
a life, which is the one thing that log is for.

### 6. Progress never appears on the daily checklist

Goals and their progress live on the Goals screen. No task row, no
checklist section, and no header shows a goal's running count.

This answers the question ADR-0025 §11 flagged. Etkin's experiments
measured **continuous output display** — the count in front of you
while you do the thing — and that is what a progress bar on the daily
surface would be. A target you visit when you choose to is a different
object, which is exactly why §1 exists at all and why "read 24 books"
was accepted as a legitimate goal shape.

It is also design principle 2: the daily surface is a checklist and a
number.

### 7. Metrics never touch the grade

Progress entries are not scoring events. They earn no points, appear in
no denominator, and change no day's number — following AGENTS.md's
standing rule that daily grades measure consistency and achievements
feed monthly and yearly summaries only.

Nor do they feed **effort** (ADR-0025 §8): bubble size counts
completions and logged activities, which are things done on a day. A
progress entry is a *measurement* of a thing done, often days later,
and counting it would double-count the session it describes.

An auto-counted entry (§2) is the one case where a single act produces
both a task completion and a progress entry. The completion scores; the
entry does not. That separation is what keeps the two meanings apart.

## Schema

Amends ADR-0002; `goal.target_value` already exists and finally gets a
consumer.

- **`goal.metric_kind`** — nullable text, `cumulative | target`. Null =
  plain goal.
- **`goal.metric_unit`** — nullable text, free-form label.
- **`goal.target_date`** — nullable text, `'YYYY-MM'` (§4).
- **`goal.autocount_task_id`** — nullable, references `task.id`;
  nulls on archive (§2).
- **`goal_progress`** — id, goal_id, local_date, value (real), note,
  `source` (`manual | task`), created_at. Deletable, like journal
  entries.
- **`milestone.target_value`** — nullable real (§5).
- **`milestone.completed_on`** — nullable text, `'YYYY-MM-DD'` (§5).

No scoring tables change (§7), and nothing here bumps
`FORMULA_VERSION`.

## Consequences

**Easier.** Two of vision.md's own worked examples become expressible
for the first time. `goal.target_value` stops being a column that
promises something the app cannot do. Direction inference (§1) means
weight loss and strength gain share one input with no branching in the
UI. And §4's granularity choice makes "rough" structural — there is no
date picker to be tempted by later.

**Harder.** Two metric kinds means two progress renderings and two
completion checks. The auto-count link (§2) is the piece most likely to
produce surprise, which is why it is capped at one explicitly nominated
task and why its entries are visible and deletable. §5's retroactive
dating has to reach `achievement.achieved_at` as well as the milestone,
and any look-back view built later must read the former.

**Accepted costs.** §1's inferred direction can flip if the earliest
entry is deleted. §4 means a goal can quietly drift years past its date
with the app never mentioning it — deliberate, and the monthly review
is the designed remedy. §6 means the strongest available motivational
surface (progress in front of you daily) is left on the table on
purpose.

**Revisit when:** real use shows the one-task auto-count limit chafing;
month granularity proves too coarse for a real goal; or the monthly
review, once built, turns out to be the wrong venue for date-passed
goals.

## Action items

1. [x] Migration: the six new columns and `goal_progress` (§Schema).
       (Shipped in migration `0009`.)
2. [x] Progress entry UI on the goal screen — add, list, delete; §1's
       two renderings; no bar before the first entry. (Shipped:
       `components/goals/GoalMetricPanel.tsx`; the arithmetic is
       `packages/scoring/src/metrics.ts` with 17 tests.)
3. [ ] Auto-count **UI**: nominating the task in the goal editor. The
       *mechanism* is shipped — `setGoalAutocountTask`,
       `autocountForTask`, and `removeAutocountForTask`, wired into
       `toggleCompletion` both ways — but nothing on screen sets the
       link yet, so it is unreachable.
4. [ ] Completion invitation on reaching target, routed into
       ADR-0007 §2's existing three-path flow (§3). `metricState().met`
       is the signal and is tested; the panel shows "Target reached"
       but does not yet offer to complete.
5. [x] Month picker for `target_date` — not a date picker (§4).
       (Shipped: `GoalMetricSheet` — three year chips and twelve month
       chips, so there is no day field to be tempted by.)
6. [~] Milestone thresholds and the advance prompt; retroactive date
       written to both `milestone.completed_on` and
       `achievement.achieved_at` (§5). **Data layer done** —
       `addMilestone` takes a threshold, `completeMilestone` takes the
       day and writes both places, `milestonesReached` computes the
       prompt. **No UI yet** for entering a threshold or picking a past
       date.
7. [x] Amend ADR-0007 §2: metric-linked goals are no longer deferred;
       point it here.
8. [x] Update the ADR index — 0015 moves out of Planned ADRs.
