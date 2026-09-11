# ADR-0007: Goal lifecycle and milestones

> **Status:** Accepted\
> **Date:** 2026-07-15\
> **Deciders:** Henry

> **Note added 2026-09-11.** A *commitment*
> ([ADR-0029](0029-commitments-are-custom-units.md)) is deliberately
> **not** a goal. An intermediate draft made it a goal kind; a thing
> that carries weight and holds tasks is unit-shaped, and goals do not
> carry weight. Ordinary goals still live inside a commitment — "get
> better at basketball" under Basketball Club — and this lifecycle
> governs them unchanged.

## Context

Goals sit between SLUs and tasks: specific, measurable, temporary.
The schema (ADR-0002) gives them states and a self-reference; the
monthly review (ADR-0002/0005) is their natural venue; "gentle by
design" (vision.md) requires that abandoning and revising be
first-class outcomes, not failures. Goals end; the units they serve
don't — so the lifecycle must answer what a goal leaves behind.

## Decisions

### 1. States and transitions

    active ⇄ paused
    active | paused → abandoned → active (revival allowed)
    active → revised   (terminal; spawns a linked successor)
    active → completed (terminal; three-path completion flow)

- **Pause** is freely reversible.
- **Abandon** is revivable — life changes back sometimes, and a
  revived goal keeps its history. Copy is neutral by rule: "set
  aside," never "failed."
- **Revise** never mutates: it creates a **new goal** linked to the
  old (the old one closes as `revised`), so the log stays true —
  "Bench 225 by June" and its gentler successor both exist, honestly.
- **Completed and revised are terminal.** Going again means a new
  linked goal.

> **Amendment (2026-08-18): goals can also be deleted.**
>
> This lifecycle deliberately had no delete: the log stays true, so a
> goal you stopped pursuing is *set aside* rather than erased, and a
> revision spawns a successor rather than mutating its parent. That
> reasoning is about **outcomes**, and it stands — "Set aside" is
> still the honest end for a goal you genuinely tried, and it is still
> the wording the screen leads with.
>
> What it did not cover is the goal with no outcome at all: the
> mistyped one, the duplicate, the one created while working out how
> the app works. Refusing to remove those does not protect a record,
> it just accumulates clutter in the one place the app asks you to be
> deliberate. Henry asked for it directly on 2026-08-18 ("everything
> should be editable, deletable").
>
> **`deleteGoal` removes the goal, its milestones, and its progress
> entries — and nothing else.** Specifically:
>
> - **Achievements survive, detached.** `achievement.goal_id` became
>   nullable (migration 0010) and is nulled here. They carry
>   `title_snapshot`, which §2 added so history could outlive goal
>   edits, and PRODUCT.md principle 5 files them in the life log
>   beside journals and photos. Deleting a goal must not quietly
>   rewrite a month.
> - **Tasks detach to their unit** (`goal_id → null`) — the same exit
>   §2 already calls "transition to maintenance". Deleting a goal is
>   not a reason to stop doing what it started.
> - **Completions and grades are untouched.**
>
> The screen asks before doing it — the only confirm on that surface,
> because it is the only irreversible act there — and the copy says
> what survives, not just what goes.

**Schema amendment (ADR-0002):** `revised_from_goal_id` generalizes to
`linked_from_goal_id` + `link_kind` (`revision | follow_up`), covering
both revision chains and post-completion follow-ups.

### 2. Completion: manual, with a three-path exit flow

Completion is a deliberate act — mark the goal (or final milestone)
done. The app celebrates, records an **achievement**, and asks what
the goal leaves behind:

1. **Archive** — the goal's tasks retire with it.
2. **Follow-up goal** — bench 225 becomes bench 275: a new goal linked
   (`follow_up`), inheriting whichever tasks still serve it, ranks
   intact.
3. **Transition to maintenance** — the goal completes, but its habits
   outlive it: tasks detach to the unit (`goal_id → null`, the
   ADR-0002 optional-goal model doing exactly what it was built for).
   The strength sessions continue; they just no longer point at a
   number.

~~Metric-linked goals (target value + progress entries, auto-completion)
are deferred; `goal.target_value` already sits in the schema for when
they arrive.~~

**Amended 2026-08-16 — no longer deferred. See
[ADR-0015](0015-metric-linked-goals.md).** One clarification it makes
to this section: there is **no auto-completion**. Reaching a target
*invites* completion and the invitation routes into the three-path flow
above, because that flow asks a question only the user can answer —
silent completion would either skip it or pick for them. "I benched 225
once" and "I am now a person who benches 225" are different claims.

### 3. Milestones: flat, ordered, one in focus

- An ordered list of checkpoints inside a goal; statuses
  `pending | current | completed`. Exactly one is `current`;
  completing it advances the next and records a (minor) achievement;
  completing the last triggers the goal's completion flow.
- Milestones are editable anytime — adding a rung mid-climb is
  normal, not cheating.
- **No recursive trees.** Flat lists cover the real cases; trees
  invite the project-management complexity the vision explicitly
  avoids. If a plan genuinely needs nesting, it's usually two goals.

### 4. Concurrent goals: soft guidance, no cap

Recommended load is **1–2 active goals per unit**. At 3+ the app
nudges — "3 active goals in Physical health; consider pausing one" —
in the monthly review and on the unit screen, but never blocks. A
tool, not a taskmaster.

### 5. What happens to tasks on each transition

Rank shares (ADR-0003) make all of this automatic-by-math: whenever a
task leaves or rejoins a unit's active list, the remaining points
re-share; nothing needs re-pricing.

| Goal transition | Its tasks |
|-----------------|-----------|
| Paused | Suspend with it; remember their rank neighbors and reinsert on resume |
| Abandoned | Per-task prompt: detach to unit as a habit worth keeping, or archive |
| Revised | Carry to the successor by default (ranks intact); per-task opt-out |
| Completed | The three-path flow above |

### 6. Achievements

Recorded as in ADR-0002 (`title_snapshot`, `achieved_at`, goal and
optional milestone refs). They surface in the monthly review and
year-in-review, feed look-back views alongside memory-flagged moments
(ADR-0004/0002), and never touch daily grades. Goal completions are
major entries; milestone completions minor ones.

## Consequences

- **Easier:** every ending is honest and none is destructive — the
  revision chain preserves history like the append-only journal does;
  maintenance transition closes the loop on "goals are temporary,
  units aren't"; rank-based points mean no lifecycle event ever asks
  the user to renumber anything.
- **Harder:** the completion flow is a real three-branch UI; suspended
  tasks' reinsert-by-neighbor logic needs care around concurrently
  edited ranks; neutral copy for abandonment needs actual writing
  discipline (see AGENTS.md's never-shame invariant).
- **Revisit when:** metric-linked goals get designed (their own small
  ADR or a §2 amendment); if goal sprawl shows up despite nudges,
  reconsider the soft cap; if revision chains grow long, the history
  UI may need a lineage view.

## Action items

1. [x] Amend ADR-0002: `linked_from_goal_id` + `link_kind` replace
       `revised_from_goal_id`. (Already the live schema —
       `apps/mobile/src/db/schema.ts`.)
2. [x] Implement the state machine as pure functions with the task
       side-effects table above; property tests (terminal states stay
       terminal; task ranks always re-share to the unit weight).
       (Shipped: `packages/scoring/src/goals.ts`
       (`nextGoalStatus`/`advanceMilestone`), tests in
       `__tests__/goals.test.ts`; task side-effects wired in
       `apps/mobile/src/db/goals.ts`.)
3. [x] Design the completion flow UI (three paths) and the neutral
       abandonment copy. (Shipped:
       `components/goals/CompleteGoalModal.tsx`,
       `AbandonGoalModal.tsx`.)
4. [x] Surface goal-load nudges in the monthly review. (Shipped on the
       Goals list screen instead — `apps/mobile/src/app/goals/index.tsx`
       — no monthly-review surface exists yet to host it.)
