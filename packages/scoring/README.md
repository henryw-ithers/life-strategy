# @glide/scoring

The scoring engine for Life Strategy. Every rule that turns a
diagnostic into weights, a plan into a day's expected work, and a day's
completions into a grade lives here, as pure TypeScript functions.

(`@glide` is the app's former name. Internal package names were kept
on purpose when it was renamed; see [docs/release.md](../../docs/release.md).)

## Why it is a separate package

The scoring rules are the part of the app most likely to be wrong in a
way nobody notices, so they are kept where they can be tested without
a phone. The package has **no React Native or database imports**
([ADR-0001](../../docs/adr/0001-platform-and-tech-stack.md)): the app
reads rows from SQLite, passes plain values in, and displays what comes
back. The app reads rules such as which days a task is due from here
rather than reimplementing them.

The current model is formula version 10
([ADR-0029](../../docs/adr/0029-a-day-is-the-fraction-you-got-through.md)
with the commitment band from
[ADR-0032](../../docs/adr/0032-the-commitment-band.md)). Each stored
grade records the formula version that produced it, and past grades
are never recalculated.

## Modules

| File | What it does |
|---|---|
| `ranking.ts` | Turns a priority ranking into a 10…1 score per unit |
| `weights.ts` | Derives each unit's share of the 100 from priority alone, with the 2:1 spread ([ADR-0028](../../docs/adr/0028-priority-is-the-only-input.md)) |
| `rounding.ts` | Largest-remainder rounding, so whole-number weights always sum to exactly 100 |
| `tasks.ts` | Divides a unit's weight across its tasks by their order |
| `schedule.ts` | Which days a task is due on: weekly counts, weekday pins, fortnightly tasks |
| `dayLoad.ts` | What a day expects: work due that day in full, plus flexible work spread over the days left in the week |
| `grade.ts` | The day's score (90 planned, 10 unplanned, extra runs), rest days, special days, and weekly and monthly totals |
| `bands.ts` | The commitment band and how it divides between commitments |
| `windows.ts` | Splitting a day into windows and working out what fits in each |
| `partial.ts` | Partial completion in 25% steps |
| `days.ts` | Calendar rules: the 3 a.m. day rollover, week and month boundaries, the edit window |
| `goals.ts` | The goal lifecycle as a state machine |
| `metrics.ts` · `streak.ts` | Progress on goals that track a number or a habit |
| `effort.ts` | Bubble sizes for the portfolio graph, from logged work |
| `profile.ts` · `taskGuidance.ts` | How a unit's situation is described, used to pick suggestions |
| `calibration.ts` | Comparing weekly grades with contentment check-ins |
| `constants.ts` | The tunable numbers, each with the ADR that set it |

## Tests

```bash
npm test -w packages/scoring        # or `npm test` from the root
npm run typecheck -w packages/scoring
```

Tests live in `src/__tests__/` and run on vitest. Many are written
around a specific case from an ADR (for example, that no task is left
worth zero while its unit can afford a point), so a change that brings
back an old bug fails with a test that says which rule it broke.
