# @glide/scoring

The scoring engine for Life Strategy. Every rule that turns your
priorities into weights, a plan into a day's expected work, and a
day's completions into a grade lives here, as pure TypeScript
functions. So do the rules that lay a day out in windows and count
achievements, which never change a grade.

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

The current model is formula version 11
([ADR-0029](../../docs/adr/0029-a-day-is-the-fraction-you-got-through.md),
with weights from tiers in
[ADR-0041](../../docs/adr/0041-priorities-are-tiers.md) and the
commitment share from
[ADR-0044](../../docs/adr/0044-a-commitment-share-comes-from-your-day.md)).
Each stored grade records the formula version that produced it, and
past grades are never recalculated.

## Modules

| File | What it does |
|---|---|
| `weights.ts` | Derives each unit's share of the 100 from its tier and its order within the tier ([ADR-0041](../../docs/adr/0041-priorities-are-tiers.md)) |
| `rounding.ts` | Largest-remainder rounding, so whole-number weights always sum to exactly 100 |
| `tasks.ts` | Divides a unit's weight across its tasks by their order |
| `schedule.ts` | Which days a task is due on: weekly counts, weekday pins, fortnightly tasks, series that end or skip |
| `dayLoad.ts` | What a day expects: work due that day in full, plus flexible work spread over the days left in the week |
| `grade.ts` | The day's score (90 planned, 10 unplanned, extra runs), rest days, special days, and weekly and monthly totals |
| `bands.ts` | The planned and unplanned bands, and the commitment share and how it divides between commitments |
| `partial.ts` | Partial completion in 25% steps |
| `days.ts` | Calendar rules: the 3 a.m. day rollover, week and month boundaries, the edit window |
| `hours.ts` | A day's windows from working hours, gaps, that day's edits and events ([ADR-0039](../../docs/adr/0039-work-windows-come-from-your-hours.md)) |
| `pins.ts` | Where a pinned task lands as the day's windows change |
| `fill.ts` | Filling windows with pins and live suggestions; never reads a point |
| `windows.ts` | Task sizes, parts of the day and their bounds. Its ADR-0033 window functions are no longer called by the app |
| `effort.ts` | Each unit's share of completed work over the last four weeks, for Life's effort bars |
| `streak.ts` | Days in a row for an every-day task, shown and never enforced |
| `achievements.ts` | The achievement series, their five ranks and progress ([ADR-0047](../../docs/adr/0047-achievements-replace-goals.md)) |
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
