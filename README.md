# Life Strategy

A personal planning and reflection app that aligns daily action with
what actually matters to you.

Inspired by Rainer Strack's *Harvard Business Review* work on strategic
life planning, the app turns a periodic self-assessment into a living
daily system:

1. **Diagnose** — rate 17 Strategic Life Units (grouped into 6 Strategic
   Life Areas) on importance and satisfaction, 1–10 each.
2. **Derive** — the app converts your ratings into a personal scoring
   system: 100 points per day, weighted primarily by importance with a
   boost for units where satisfaction lags.
3. **Do** — set goals within each unit; goals generate simple daily and
   weekly tasks (app-recommended or your own). Completing tasks earns
   points.
4. **Track** — daily grades roll into weekly and monthly grades. Repeat
   the diagnostic monthly and watch your portfolio graph shift over
   time.
5. **Calibrate** — a weekly one-question check-in ("how content did you
   feel?") tunes the grading so your score converges with your actual
   felt experience — not just your completion rate.

## The hierarchy

    Strategic Life Area → Strategic Life Unit → Goal → Task

Strategy is thoughtful and periodic; execution is a checklist and a
number out of 100.

## Status

**Scaffolded.** The design phase (vision + nine accepted ADRs) is
complete and the workspace is up: `apps/mobile` (Expo SDK 57 +
Drizzle/SQLite, migration and taxonomy seed in place) and
`packages/scoring` (the pure scoring engine, formula v1, tested).

```
npm install          # once
npm test             # scoring engine tests
npm run typecheck    # both packages
npm run mobile       # Expo dev server (scan QR with Expo Go)
```

## Documentation

- [vision.md](vision.md) — the full vision: philosophy, mechanics,
  scoring design, and sequencing.
- [docs/adr/](docs/adr/) — architecture decision records. Several
  foundational ADRs are drafted as open questions to resolve before
  coding starts; see the [ADR index](docs/adr/README.md).
- [AGENTS.md](AGENTS.md) — orientation for AI coding agents working in
  this repo.
- [docs/backburner.md](docs/backburner.md) — parked ideas and why.
