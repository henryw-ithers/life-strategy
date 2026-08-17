# The content library — goals and tasks

**Source of truth.** `npm run content:build` regenerates
`apps/mobile/src/content/library.ts`.

This is ADR-0006's content package: the goals and tasks the app draws a
starter plan from after the first diagnostic. Write it here; the build
turns it into typed data and tells you what's missing.

**Read [library-outline.md](library-outline.md) first** — it carries
the editorial rules, the profile-tag guidance, and the launch bar.
This file is where the writing goes.

## Format

    ## <unit-id> — <Display name>

    ### Goals

    #### <goal-id> · <Goal title>
    profiles: gap-closing, light
    milestones: Run 1k, Run 3k, Run 5k
    metric: cumulative, km, 5

    What finishing looks like. One line, optional.

    ### Tasks

    #### <task-id> · <Task title>
    frequency: 3
    profiles: gap-closing, maintenance
    goal: run-5k

    What counts as done. Optional, and it is the self-contract —
    the fine print behind the title.

**Field lines** go directly under the `####` heading, one per line,
`key: value`. Everything after the blank line is the description.

| Field | Applies to | Values |
|---|---|---|
| `profiles` | both | `gap-closing`, `maintenance`, `light` — one or more. Required. |
| `frequency` | tasks | `0`–`7`. 7 is daily, 0 is once a fortnight. Required. |
| `goal` | tasks | A goal id in the same unit. Optional — habit tasks attach straight to the unit. |
| `milestones` | goals | Comma-separated rung titles, in order. Optional. |
| `metric` | goals | `<kind>, <unit>, <target>` where kind is `cumulative` or `target` (ADR-0015 §1). Optional. |

**Task order within a unit is `defaultRank`** — the order you write
them in. Rank 1 is the task you would keep if you could only keep one.
Proposed tasks arrive pre-ranked so onboarding needs no pairwise
comparisons (ADR-0006 §2).

## Two rules the build enforces

- **Communal units take goals but no tasks** — Significant other,
  Family, Friendship (ADR-0025 §5). The library never proposes a
  checklist task for a relationship. A task written under one of those
  units is a build error, not a warning.
- **Ids must be unique within their unit**, and a task's `goal:` must
  name a goal in the same unit.

## The bar

Every unit needs **≥3 goals**; the 15 non-communal units need **≥6
tasks**; and each unit's set should cover all three profile tags, since
the same unit looks different to different people. `content:build`
prints what is short.

---

## exercise-fitness — Exercise & fitness

> Worked example, so the format is concrete. Written to the bar's
> shape, not to the bar's count — this unit still needs more before
> launch. Delete or rewrite freely.

### Goals

#### run-5k · Run 5k without stopping
profiles: gap-closing
milestones: Run 1k without stopping, Run 3k without stopping, Run 5k without stopping
metric: target, km, 5

A single continuous 5k, at any pace.

#### strength-base · Build a strength base
profiles: gap-closing, maintenance
milestones: Two sessions a week for a month, Add weight to every main lift, Three sessions a week for a month

Squat, hinge, push, and pull all part of a regular week.

#### stay-active · Stay as active as you are now
profiles: maintenance, light

Hold the routine that already works, through a busy stretch.

### Tasks

#### strength-session · Strength training session
frequency: 3
profiles: gap-closing, maintenance
goal: strength-base

Squat, hinge, push, pull. Warm-up counts as part of it.

#### easy-run · Easy run
frequency: 2
profiles: gap-closing
goal: run-5k

Conversational pace. Distance does not matter.

#### daily-walk · Walk
frequency: 7
profiles: maintenance, light

Twenty minutes or more, in one go or spread out.

#### mobility · Mobility work
frequency: 3
profiles: maintenance

Ten minutes. Hips, shoulders, ankles.

#### long-effort · One longer effort
frequency: 1
profiles: gap-closing, maintenance
goal: run-5k

The week's one session that goes past comfortable.

#### move-break · Get up and move
frequency: 7
profiles: light

Break up a sitting day. Any movement counts.
