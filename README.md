# Glide

A personal planning and reflection app that aligns daily action with
what actually matters to you.

Inspired by Rainer Strack's *Harvard Business Review* work on strategic
life planning, the app turns a periodic self-assessment into a living
daily system:

1. **Diagnose** — rate 18 Strategic Life Units (grouped into 6 Strategic
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

**Core loop closed; not yet in daily use by anyone but the builder.**
The design phase (vision + ten accepted ADRs) is complete, and the
loop runs end to end: diagnostic → derived weights → planned tasks →
daily checklist and grade → weekly and monthly aggregation →
contentment check-in → portfolio graph.

The workspace: `apps/mobile` (Expo SDK 54 — pinned, see
[ADR-0001](docs/adr/0001-platform-and-tech-stack.md) — with
Drizzle/SQLite), `packages/scoring` (the pure scoring engine, formula
v3, tested), and `packages/backup` (the backup envelope format).

**iOS only** ([ADR-0020](docs/adr/0020-backup-cryptography-and-export-exemption.md)).
Backup encryption is Apple's CryptoKit and CommonCrypto through a small
native module, which is what keeps the app clear of US export-control
paperwork — and which means backup and restore need a development or
TestFlight build rather than Expo Go.

Not built yet: the recommendation library
([ADR-0006](docs/adr/0006-task-and-goal-recommendations.md) — every
goal and task is currently hand-entered), the monthly review ritual,
any look-back over the life log, onboarding
(planned ADR-0011), and backup (ADR-0002 action item 3).

```
npm install          # once
npm test             # scoring, backup, and the app's pure-logic tests
npm run typecheck    # all three workspaces
npm run mobile       # Expo dev server (scan QR with Expo Go)
```

## Documentation

- [vision.md](vision.md) — the full vision: philosophy, mechanics,
  scoring design, and sequencing.
- [docs/adr/](docs/adr/) — architecture decision records. Several
  foundational ADRs are drafted as open questions to resolve before
  coding starts; see the [ADR index](docs/adr/README.md).
- [docs/release.md](docs/release.md) — how builds reach a device that
  isn't the dev machine: TestFlight, identity, versioning, and the
  names that must never be renamed.
- [AGENTS.md](AGENTS.md) — orientation for AI coding agents working in
  this repo.
- [docs/backburner.md](docs/backburner.md) — parked ideas and why.
